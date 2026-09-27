"""Backend API tests for All My Meals."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://recipe-saver-56.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

RECIPE_TEXT = """Simple Garlic Butter Pasta
Serves 2. Prep 5 min, cook 12 min.
Ingredients:
- 200g spaghetti
- 3 cloves garlic, minced
- 3 tbsp butter
- 1/4 cup parmesan, grated
- 2 tbsp parsley, chopped
- salt and pepper
Instructions:
1. Boil spaghetti in salted water until al dente.
2. Melt butter, saute garlic until fragrant.
3. Toss pasta with butter, add parmesan and parsley.
4. Season and serve.
"""


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def household(client):
    r = client.post(f"{API}/households", json={"name": "TEST_Kitchen", "member_name": "Tester"}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "household" in data and "member_id" in data
    hh = data["household"]
    assert hh["name"] == "TEST_Kitchen"
    assert len(hh["code"]) == 6
    assert len(hh["members"]) == 1
    return {"hid": hh["id"], "code": hh["code"], "member_id": data["member_id"]}


# ---- Health ----
def test_root(client):
    r = client.get(f"{API}/", timeout=10)
    assert r.status_code == 200
    assert "All My Meals" in r.json().get("message", "")


# ---- Household ----
class TestHousehold:
    def test_get_household(self, client, household):
        r = client.get(f"{API}/households/{household['hid']}", timeout=10)
        assert r.status_code == 200
        assert r.json()["id"] == household["hid"]

    def test_get_household_404(self, client):
        r = client.get(f"{API}/households/does-not-exist", timeout=10)
        assert r.status_code == 404

    def test_join_household(self, client, household):
        r = client.post(f"{API}/households/join", json={"code": household["code"], "member_name": "Bob"}, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert len(d["household"]["members"]) >= 2
        assert any(m["name"] == "Bob" for m in d["household"]["members"])

    def test_join_household_bad_code(self, client):
        r = client.post(f"{API}/households/join", json={"code": "ZZZZZZ", "member_name": "X"}, timeout=10)
        assert r.status_code == 404


# ---- Recipe import (LLM) ----
class TestRecipeImport:
    @pytest.fixture(scope="class")
    def imported_recipe(self, client, household):
        r = client.post(
            f"{API}/households/{household['hid']}/recipes/import",
            json={"source": RECIPE_TEXT, "member_id": household["member_id"]},
            timeout=120,
        )
        assert r.status_code == 200, r.text
        return r.json()

    def test_import_shape(self, imported_recipe):
        d = imported_recipe
        assert d["title"]
        assert isinstance(d["ingredients"], list) and len(d["ingredients"]) > 0
        for ing in d["ingredients"]:
            assert "name" in ing and "aisle" in ing
        assert isinstance(d["steps"], list) and len(d["steps"]) > 0
        for k in ("calories", "protein_g", "carbs_g", "fat_g", "servings"):
            assert isinstance(d[k], int)
        assert d["category"] in [
            "Breakfast","Lunch","Dinner","Dessert","Vegan","Vegetarian","Quick","Healthy","Baking","Snack","Other"
        ]
        assert d["source_type"] == "text"
        assert d["image_url"]

    def test_get_recipe(self, client, imported_recipe):
        r = client.get(f"{API}/recipes/{imported_recipe['id']}", timeout=10)
        assert r.status_code == 200
        assert r.json()["id"] == imported_recipe["id"]

    def test_list_recipes(self, client, household, imported_recipe):
        r = client.get(f"{API}/households/{household['hid']}/recipes", timeout=10)
        assert r.status_code == 200
        ids = [x["id"] for x in r.json()]
        assert imported_recipe["id"] in ids

    def test_list_recipes_search(self, client, household, imported_recipe):
        # search by partial title word
        word = imported_recipe["title"].split()[0]
        r = client.get(f"{API}/households/{household['hid']}/recipes", params={"q": word}, timeout=10)
        assert r.status_code == 200
        assert any(x["id"] == imported_recipe["id"] for x in r.json())

    def test_list_recipes_category(self, client, household, imported_recipe):
        r = client.get(
            f"{API}/households/{household['hid']}/recipes",
            params={"category": imported_recipe["category"]},
            timeout=10,
        )
        assert r.status_code == 200


# ---- Meal plan ----
class TestMealPlan:
    def test_add_and_get_and_delete(self, client, household):
        # create a manual recipe for speed
        r = client.post(
            f"{API}/households/{household['hid']}/recipes",
            json={"title": "TEST_Manual", "ingredients": [{"name": "Egg", "quantity": "2"}], "steps": ["Cook"]},
            timeout=10,
        )
        assert r.status_code == 200
        rid = r.json()["id"]

        r = client.post(
            f"{API}/households/{household['hid']}/mealplan",
            json={"date": "2026-01-15", "meal_type": "Dinner", "recipe_id": rid},
            timeout=10,
        )
        assert r.status_code == 200
        mid = r.json()["id"]
        assert r.json()["recipe_title"] == "TEST_Manual"

        r = client.get(f"{API}/households/{household['hid']}/mealplan", timeout=10)
        assert r.status_code == 200
        assert any(m["id"] == mid for m in r.json())

        r = client.delete(f"{API}/mealplan/{mid}", timeout=10)
        assert r.status_code == 200

        r = client.get(f"{API}/households/{household['hid']}/mealplan", timeout=10)
        assert not any(m["id"] == mid for m in r.json())

    def test_mealplan_bad_recipe(self, client, household):
        r = client.post(
            f"{API}/households/{household['hid']}/mealplan",
            json={"date": "2026-01-15", "meal_type": "Dinner", "recipe_id": "nope"},
            timeout=10,
        )
        assert r.status_code == 404


# ---- Grocery ----
class TestGrocery:
    def test_grocery_crud(self, client, household):
        r = client.post(
            f"{API}/households/{household['hid']}/grocery",
            json={"name": "TEST_Milk", "quantity": "1L", "aisle": "Dairy"},
            timeout=10,
        )
        assert r.status_code == 200
        gid = r.json()["id"]
        assert r.json()["checked"] is False

        r = client.patch(f"{API}/grocery/{gid}", json={"checked": True}, timeout=10)
        assert r.status_code == 200
        assert r.json()["checked"] is True

        r = client.get(f"{API}/households/{household['hid']}/grocery", timeout=10)
        assert any(g["id"] == gid and g["checked"] for g in r.json())

        r = client.delete(f"{API}/households/{household['hid']}/grocery/completed", timeout=10)
        assert r.status_code == 200

        r = client.get(f"{API}/households/{household['hid']}/grocery", timeout=10)
        assert not any(g["id"] == gid for g in r.json())

    def test_grocery_from_recipe(self, client, household):
        r = client.post(
            f"{API}/households/{household['hid']}/recipes",
            json={
                "title": "TEST_FromR",
                "ingredients": [
                    {"name": "Flour", "quantity": "2 cups", "aisle": "Pantry"},
                    {"name": "Sugar", "quantity": "1 cup", "aisle": "Pantry"},
                ],
            },
            timeout=10,
        )
        rid = r.json()["id"]
        r = client.post(
            f"{API}/households/{household['hid']}/grocery/from-recipe",
            json={"recipe_id": rid},
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["added"] == 2

    def test_grocery_delete_item(self, client, household):
        r = client.post(
            f"{API}/households/{household['hid']}/grocery",
            json={"name": "TEST_ToDelete"},
            timeout=10,
        )
        gid = r.json()["id"]
        r = client.delete(f"{API}/grocery/{gid}", timeout=10)
        assert r.status_code == 200
        r = client.get(f"{API}/households/{household['hid']}/grocery", timeout=10)
        assert not any(g["id"] == gid for g in r.json())


# ---- Recipe soft delete ----
class TestRecipeDelete:
    def test_soft_delete(self, client, household):
        r = client.post(
            f"{API}/households/{household['hid']}/recipes",
            json={"title": "TEST_ToDelete", "ingredients": [], "steps": []},
            timeout=10,
        )
        rid = r.json()["id"]
        r = client.delete(f"{API}/recipes/{rid}", timeout=10)
        assert r.status_code == 200
        r = client.get(f"{API}/recipes/{rid}", timeout=10)
        assert r.status_code == 404
