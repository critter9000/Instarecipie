"""Tests for real-URL recipe import bug fix (recipetineats JSON-LD,
bbcgoodfood reader fallback, YouTube embed detection, calorie accuracy)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://recipe-saver-56.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def hid(client):
    r = client.post(f"{API}/households", json={"name": "TEST_URLImportKitchen", "member_name": "URL"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["household"]["id"]


def _import(client, hid, source, timeout=120):
    # Ingress can 502 on cold LLM calls; retry once.
    last = None
    for _ in range(3):
        r = client.post(
            f"{API}/households/{hid}/recipes/import",
            json={"source": source},
            timeout=timeout,
        )
        last = r
        if r.status_code == 200:
            return r
        # transient gateway
        if r.status_code in (502, 503, 504):
            continue
        return r
    return last


# ---- Real recipe with JSON-LD schema.org markup ----
class TestRecipetineatsImport:
    @pytest.fixture(scope="class")
    def data(self, client, hid):
        r = _import(client, hid, "https://www.recipetineats.com/chicken-stir-fry/", timeout=120)
        assert r.status_code == 200, r.text
        return r.json()

    def test_title_matches_dish(self, data):
        t = (data.get("title") or "").lower()
        assert "chicken" in t and "stir" in t, f"unexpected title: {data.get('title')}"

    def test_has_real_ingredients(self, data):
        assert isinstance(data["ingredients"], list) and len(data["ingredients"]) > 0
        for ing in data["ingredients"]:
            assert ing["name"]
            assert ing["aisle"] in [
                "Produce","Dairy","Meat & Seafood","Pantry","Bakery","Frozen","Beverages","Spices","Other"
            ]

    def test_has_real_steps(self, data):
        assert isinstance(data["steps"], list) and len(data["steps"]) > 0

    def test_image_is_from_source_domain(self, data):
        img = data.get("image_url") or ""
        assert img, "no image_url"
        assert "images.unsplash.com" not in img, f"unsplash fallback used for a real URL: {img}"
        # Should come from recipetineats or its CDN (not a random stock image)
        assert "recipetineats" in img.lower() or "wp.com" in img.lower() or "wp-content" in img.lower(), (
            f"image does not look like source-domain image: {img}"
        )

    def test_source_metadata(self, data):
        assert data["source_type"] == "link"
        assert data["source_url"] == "https://www.recipetineats.com/chicken-stir-fry/"

    def test_calories_nonzero_and_aisles(self, data):
        assert data["calories"] > 0, "calories should be > 0 for a real recipe"
        # Aisles set on every ingredient
        assert all(ing.get("aisle") for ing in data["ingredients"])

    def test_persisted(self, client, data):
        r = client.get(f"{API}/recipes/{data['id']}", timeout=15)
        assert r.status_code == 200
        assert r.json()["title"] == data["title"]


# ---- Recipe site that blocks direct fetch -> reader fallback ----
class TestBbcGoodfoodImport:
    @pytest.fixture(scope="class")
    def data(self, client, hid):
        r = _import(client, hid, "https://www.bbcgoodfood.com/recipes/spaghetti-bolognese-recipe", timeout=120)
        assert r.status_code == 200, r.text
        return r.json()

    def test_title_matches_dish(self, data):
        t = (data.get("title") or "").lower()
        assert "bolognese" in t or "spaghetti" in t, f"unexpected title: {data.get('title')}"

    def test_ingredients_and_steps(self, data):
        assert len(data["ingredients"]) > 0
        assert len(data["steps"]) > 0

    def test_image_from_source(self, data):
        img = data.get("image_url") or ""
        assert img
        assert "images.unsplash.com" not in img, f"unsplash fallback used: {img}"
        # bbcgoodfood images are served from immediate.co.uk CDN
        assert "immediate.co.uk" in img.lower() or "bbcgoodfood" in img.lower(), (
            f"image does not look like source-domain image: {img}"
        )

    def test_calories_nonzero(self, data):
        assert data["calories"] > 0


# ---- YouTube embed detection ----
class TestYouTubeImport:
    def test_youtube_embed_url(self, client, hid):
        r = _import(client, hid, "https://www.youtube.com/watch?v=dQw4w9WgXcQ", timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["video_url"], "video_url missing"
        assert d["video_url"] == "https://www.youtube.com/embed/dQw4w9WgXcQ", d["video_url"]
        assert d["source_url"] == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        # Non-recipe YouTube URL: may or may not synthesize ingredients/steps.
        # The critical assertion is that the video embed url is set correctly.
        assert isinstance(d["ingredients"], list)
        assert isinstance(d["steps"], list)


# ---- Regression: pasted TEXT still works ----
class TestTextRegression:
    def test_text_import(self, client, hid):
        text = (
            "Quick Tomato Soup\nServes 2.\nIngredients:\n- 400g tomatoes\n- 1 onion\n- 2 cloves garlic\n"
            "- 1 tbsp olive oil\n- salt, pepper\nSteps:\n1. Saute onion.\n2. Add tomatoes and simmer.\n3. Blend."
        )
        r = _import(client, hid, text, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["source_type"] == "text"
        assert d["source_url"] is None
        assert len(d["ingredients"]) > 0
        assert len(d["steps"]) > 0
