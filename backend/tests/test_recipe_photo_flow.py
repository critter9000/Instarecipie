"""Photo pipeline integration tests for recipe import, migration verification, and refresh behavior."""

import os
import time
from io import BytesIO
from pathlib import Path

import pytest
import requests
from PIL import Image
from dotenv import dotenv_values


# Module: API photo workflows (import/poll/refresh/migration safety)
def _backend_url():
    value = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "").strip()
    if value:
        return value
    env_path = Path(__file__).resolve().parents[2] / "frontend" / ".env"
    env = dotenv_values(str(env_path)) if env_path.exists() else {}
    return (env.get("EXPO_PUBLIC_BACKEND_URL") or "").strip()


BASE_URL = _backend_url().rstrip("/")
API = f"{BASE_URL}/api"
LEGACY_RECIPE_ID = "61624a40-29d1-477a-bb01-229dc524e82a"
LEGACY_HOUSEHOLD_ID = "c71d39fb-00b0-4f87-93a9-aba45690e770"
LEGACY_SOURCE = "https://i.ytimg.com/vi/vAzMBfiVDaY/maxresdefault.jpg"
SHORT_URL = "https://www.youtube.com/shorts/ysaHg7qzoK0"


def _wait_recipe_ready(client: requests.Session, rid: str, timeout_sec: int = 120):
    deadline = time.time() + timeout_sec
    last = None
    while time.time() < deadline:
        response = client.get(f"{API}/recipes/{rid}", timeout=20)
        assert response.status_code == 200, response.text
        last = response.json()
        if last.get("image_status") != "pending":
            return last
        time.sleep(2)
    return last


@pytest.fixture(scope="module")
def client():
    if not BASE_URL:
        pytest.skip("EXPO_PUBLIC_BACKEND_URL is required")
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def kitchen(client: requests.Session):
    response = client.post(
        f"{API}/households",
        json={"name": "TEST_PhotoKitchen", "member_name": "Photo QA"},
        timeout=20,
    )
    assert response.status_code == 200, response.text
    data = response.json()
    return {
        "hid": data["household"]["id"],
        "member_id": data["member_id"],
        "code": data["household"]["code"],
    }


def test_legacy_recipe_repaired_and_unchanged(client: requests.Session):
    before = client.get(f"{API}/recipes/{LEGACY_RECIPE_ID}", timeout=20)
    assert before.status_code == 200, before.text
    first = before.json()
    assert first["household_id"] == LEGACY_HOUSEHOLD_ID
    assert first.get("image_source_url") == LEGACY_SOURCE
    assert isinstance(first.get("ingredients"), list) and len(first["ingredients"]) > 0
    assert isinstance(first.get("steps"), list) and len(first["steps"]) > 0

    time.sleep(4)
    after = client.get(f"{API}/recipes/{LEGACY_RECIPE_ID}", timeout=20)
    assert after.status_code == 200, after.text
    second = after.json()

    assert second["ingredients"] == first["ingredients"]
    assert second["steps"] == first["steps"]
    assert second["title"] == first["title"]
    assert second.get("image_source_url") == first.get("image_source_url")
    assert second.get("image_url") == first.get("image_url")


def test_import_short_pending_then_ready_with_exact_source(client: requests.Session, kitchen):
    response = client.post(
        f"{API}/households/{kitchen['hid']}/recipes/import",
        json={"source": SHORT_URL, "member_id": kitchen["member_id"]},
        timeout=180,
    )
    assert response.status_code == 200, response.text
    created = response.json()
    assert created["source_url"] == SHORT_URL
    assert created["source_type"] == "link"
    if created.get("image_status") == "pending":
        assert created.get("image_url") is None

    recipe = _wait_recipe_ready(client, created["id"], timeout_sec=140)
    assert recipe is not None
    assert recipe.get("image_status") == "ready", recipe
    assert "ysaHg7qzoK0" in (recipe.get("image_source_url") or "")
    assert recipe.get("image_url", "").startswith(
        f"/api/households/{kitchen['hid']}/recipes/{created['id']}/image?v="
    )
    assert "all-my-meals/uploads/" not in (recipe.get("image_url") or "")
    assert "storage_key" not in (recipe.get("image_url") or "")


def test_recipe_image_endpoint_returns_decodable_jpeg(client: requests.Session, kitchen):
    response = client.get(f"{API}/households/{kitchen['hid']}/recipes", timeout=20)
    assert response.status_code == 200, response.text
    imported = next((r for r in response.json() if r.get("source_url") == SHORT_URL), None)
    assert imported, "Expected imported shorts recipe in test kitchen"
    assert imported.get("image_url")

    image_response = client.get(f"{BASE_URL}{imported['image_url']}", timeout=30)
    assert image_response.status_code == 200, image_response.text
    assert image_response.headers.get("Content-Type", "").lower().startswith("image/jpeg")
    assert "image_storage_path" not in image_response.text
    assert "all-my-meals/uploads/" not in image_response.text

    with Image.open(BytesIO(image_response.content)) as img:
        img.verify()


def test_refresh_photo_pending_then_ready_with_new_revision(client: requests.Session, kitchen):
    list_response = client.get(f"{API}/households/{kitchen['hid']}/recipes", timeout=20)
    recipe = next((r for r in list_response.json() if r.get("source_url") == SHORT_URL), None)
    assert recipe and recipe.get("image_url")
    old_image_url = recipe["image_url"]

    refresh = client.post(
        f"{API}/households/{kitchen['hid']}/recipes/{recipe['id']}/refresh-image",
        timeout=30,
    )
    assert refresh.status_code == 200, refresh.text
    assert refresh.json().get("image_status") == "pending"

    ready = _wait_recipe_ready(client, recipe["id"], timeout_sec=140)
    assert ready.get("image_status") == "ready", ready
    assert ready.get("image_url") and ready["image_url"] != old_image_url
    assert "image_storage_path" not in ready


def test_wrong_household_and_deleted_recipe_refresh_rejected(client: requests.Session, kitchen):
    wrong = client.post(f"{API}/households", json={"name": "TEST_Wrong", "member_name": "X"}, timeout=20)
    assert wrong.status_code == 200
    wrong_hid = wrong.json()["household"]["id"]

    recipes = client.get(f"{API}/households/{kitchen['hid']}/recipes", timeout=20).json()
    imported = next((r for r in recipes if r.get("source_url") == SHORT_URL), None)
    assert imported

    wrong_refresh = client.post(
        f"{API}/households/{wrong_hid}/recipes/{imported['id']}/refresh-image",
        timeout=20,
    )
    assert wrong_refresh.status_code == 404

    temp = client.post(
        f"{API}/households/{kitchen['hid']}/recipes",
        json={"title": "TEST_DeleteImage", "ingredients": [], "steps": []},
        timeout=20,
    )
    assert temp.status_code == 200, temp.text
    rid = temp.json()["id"]
    delete_res = client.delete(f"{API}/recipes/{rid}", timeout=20)
    assert delete_res.status_code == 200

    deleted_refresh = client.post(
        f"{API}/households/{kitchen['hid']}/recipes/{rid}/refresh-image",
        timeout=20,
    )
    assert deleted_refresh.status_code == 404

    deleted_image = client.get(
        f"{API}/households/{kitchen['hid']}/recipes/{rid}/image",
        timeout=20,
    )
    assert deleted_image.status_code == 404


def test_manual_recipe_refresh_returns_400_no_stock_substitution(client: requests.Session, kitchen):
    response = client.post(
        f"{API}/households/{kitchen['hid']}/recipes",
        json={
            "title": "TEST_ManualNoSource",
            "description": "manual",
            "ingredients": [{"name": "Salt", "quantity": "1 tsp", "aisle": "Spices"}],
            "steps": ["Mix"],
        },
        timeout=20,
    )
    assert response.status_code == 200, response.text
    recipe = response.json()
    assert recipe.get("source_type") == "manual"
    assert recipe.get("image_status") == "unavailable"
    assert recipe.get("image_url") is None

    refresh = client.post(
        f"{API}/households/{kitchen['hid']}/recipes/{recipe['id']}/refresh-image",
        timeout=20,
    )
    assert refresh.status_code == 400
