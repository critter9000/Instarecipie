from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import json
import random
import logging
import requests
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

app = FastAPI()
api_router = APIRouter(prefix="/api")

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
AISLES = ["Produce", "Dairy", "Meat & Seafood", "Pantry", "Bakery", "Frozen", "Beverages", "Spices", "Other"]
CATEGORIES = ["Breakfast", "Lunch", "Dinner", "Dessert", "Vegan", "Vegetarian", "Quick", "Healthy", "Baking", "Snack", "Other"]
MEMBER_COLORS = ["#C84C31", "#2A5A39", "#7D5513", "#3B3D36", "#8A311D", "#6B2313"]

FOOD_PLACEHOLDERS = [
    "https://images.unsplash.com/photo-1490645935967-10de6ba17061?crop=entropy&cs=srgb&fm=jpg&q=80&w=1200",
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?crop=entropy&cs=srgb&fm=jpg&q=80&w=1200",
    "https://images.unsplash.com/photo-1467003909585-2f8a72700288?crop=entropy&cs=srgb&fm=jpg&q=80&w=1200",
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?crop=entropy&cs=srgb&fm=jpg&q=80&w=1200",
    "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?crop=entropy&cs=srgb&fm=jpg&q=80&w=1200",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def gen_code() -> str:
    return "".join(random.choices("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", k=6))


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class Member(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    color: str


class HouseholdCreate(BaseModel):
    name: Optional[str] = "My Kitchen"
    member_name: str = "Me"


class HouseholdJoin(BaseModel):
    code: str
    member_name: str = "Me"


class Ingredient(BaseModel):
    name: str
    quantity: str = ""
    aisle: str = "Other"


class RecipeImport(BaseModel):
    source: str
    member_id: Optional[str] = None


class RecipeCreate(BaseModel):
    title: str
    description: str = ""
    image_url: Optional[str] = None
    category: str = "Other"
    tags: List[str] = []
    servings: int = 2
    prep_time_minutes: int = 0
    cook_time_minutes: int = 0
    calories: int = 0
    protein_g: int = 0
    carbs_g: int = 0
    fat_g: int = 0
    ingredients: List[Ingredient] = []
    steps: List[str] = []
    member_id: Optional[str] = None


class MealPlanCreate(BaseModel):
    date: str  # YYYY-MM-DD
    meal_type: str  # Breakfast | Lunch | Dinner | Snack
    recipe_id: str


class GroceryCreate(BaseModel):
    name: str
    quantity: str = ""
    aisle: str = "Other"
    added_by: Optional[str] = None


class GroceryFromRecipe(BaseModel):
    recipe_id: str
    member_id: Optional[str] = None


class GroceryUpdate(BaseModel):
    checked: bool


# ---------------------------------------------------------------------------
# LLM recipe extraction
# ---------------------------------------------------------------------------
def fetch_url_context(source: str):
    if not re.match(r'^https?://', source.strip(), re.I):
        return None, None
    try:
        r = requests.get(
            source.strip(),
            timeout=12,
            headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"},
        )
        html = r.text[:250000]
    except Exception as e:
        logger.warning(f"url fetch failed: {e}")
        return None, None

    img = None
    for pat in [
        r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
    ]:
        m = re.search(pat, html, re.I)
        if m:
            img = m.group(1)
            break

    text = re.sub(r'<script.*?</script>', ' ', html, flags=re.S | re.I)
    text = re.sub(r'<style.*?</style>', ' ', text, flags=re.S | re.I)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return img, text[:9000]


def parse_json_block(raw: str):
    raw = raw.strip()
    raw = re.sub(r'^```(json)?', '', raw).strip()
    raw = re.sub(r'```$', '', raw).strip()
    start = raw.find('{')
    end = raw.rfind('}')
    if start != -1 and end != -1:
        raw = raw[start:end + 1]
    return json.loads(raw)


async def extract_recipe_via_llm(source: str) -> dict:
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    og_image, page_text = fetch_url_context(source)
    is_url = bool(re.match(r'^https?://', source.strip(), re.I))

    system = (
        "You are a professional recipe extraction and structuring engine for a recipe-keeper app. "
        "You always output ONLY a single valid minified JSON object and nothing else (no markdown, no commentary). "
        "You translate any non-English recipe fully into English. "
        "You estimate realistic per-serving nutrition when it is not stated. "
        "Every ingredient gets an aisle from this set exactly: " + ", ".join(AISLES) + ". "
        "category must be exactly one of: " + ", ".join(CATEGORIES) + "."
    )

    if is_url and page_text:
        context = f"The user saved this recipe URL: {source}\n\nExtracted page text:\n{page_text}"
    elif is_url:
        context = (
            f"The user saved this social/video recipe link: {source}\n"
            "The page content could not be fetched. Infer the most likely recipe from the URL, "
            "handle, slug and any dish name in the link, and produce a complete, realistic recipe."
        )
    else:
        context = f"The user pasted this recipe text/notes:\n{source}"

    schema = (
        '{"title": string, "description": string (1-2 appetizing sentences), '
        '"category": string, "tags": [string up to 4], "servings": integer, '
        '"prep_time_minutes": integer, "cook_time_minutes": integer, '
        '"calories": integer per serving, "protein_g": integer, "carbs_g": integer, "fat_g": integer, '
        '"ingredients": [{"name": string, "quantity": string, "aisle": string}], '
        '"steps": [string clear instruction per step], '
        '"translated_from": string language name or null}'
    )

    user_text = (
        f"{context}\n\n"
        f"Return a JSON object with EXACTLY this shape:\n{schema}\n\n"
        "Rules: ingredients must be individual items with quantities. steps must be numbered logically in order. "
        "If the recipe is in another language, set translated_from to that language and translate everything to English. "
        "Keep description under 200 characters. Output JSON only."
    )

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"recipe-{new_id()}",
        system_message=system,
    ).with_model("openai", "gpt-5.4")

    resp = await chat.send_message(UserMessage(text=user_text))
    data = parse_json_block(resp if isinstance(resp, str) else str(resp))

    # sanitize
    data.setdefault("title", "Imported Recipe")
    data.setdefault("description", "")
    cat = data.get("category", "Other")
    data["category"] = cat if cat in CATEGORIES else "Other"
    data["tags"] = [str(t) for t in (data.get("tags") or [])][:4]
    for k in ["servings", "prep_time_minutes", "cook_time_minutes", "calories", "protein_g", "carbs_g", "fat_g"]:
        try:
            data[k] = int(data.get(k) or 0)
        except Exception:
            data[k] = 0
    if data["servings"] <= 0:
        data["servings"] = 2

    clean_ings = []
    for ing in (data.get("ingredients") or []):
        if isinstance(ing, str):
            clean_ings.append({"name": ing, "quantity": "", "aisle": "Other"})
        elif isinstance(ing, dict):
            aisle = ing.get("aisle", "Other")
            clean_ings.append({
                "name": str(ing.get("name", "")).strip(),
                "quantity": str(ing.get("quantity", "")).strip(),
                "aisle": aisle if aisle in AISLES else "Other",
            })
    data["ingredients"] = [i for i in clean_ings if i["name"]]
    data["steps"] = [str(s).strip() for s in (data.get("steps") or []) if str(s).strip()]

    image = data.get("image_url") or og_image
    if not image:
        image = random.choice(FOOD_PLACEHOLDERS)
    data["image_url"] = image
    return data


# ---------------------------------------------------------------------------
# Household routes
# ---------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"message": "All My Meals API"}


@api_router.post("/households")
async def create_household(payload: HouseholdCreate):
    member = Member(name=payload.member_name or "Me", color=MEMBER_COLORS[0])
    code = gen_code()
    while await db.households.find_one({"code": code}):
        code = gen_code()
    doc = {
        "id": new_id(),
        "code": code,
        "name": payload.name or "My Kitchen",
        "members": [member.dict()],
        "created_at": now_iso(),
    }
    await db.households.insert_one(doc)
    doc.pop("_id", None)
    return {"household": doc, "member_id": member.id}


@api_router.post("/households/join")
async def join_household(payload: HouseholdJoin):
    doc = await db.households.find_one({"code": payload.code.strip().upper()}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="No kitchen found with that code")
    color = MEMBER_COLORS[len(doc["members"]) % len(MEMBER_COLORS)]
    member = Member(name=payload.member_name or "Me", color=color)
    await db.households.update_one({"id": doc["id"]}, {"$push": {"members": member.dict()}})
    doc["members"].append(member.dict())
    return {"household": doc, "member_id": member.id}


@api_router.get("/households/{hid}")
async def get_household(hid: str):
    doc = await db.households.find_one({"id": hid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Household not found")
    return doc


# ---------------------------------------------------------------------------
# Recipe routes
# ---------------------------------------------------------------------------
async def _store_recipe(hid: str, data: dict, source_url: Optional[str], source_type: str, member_id: Optional[str]):
    doc = {
        "id": new_id(),
        "household_id": hid,
        "title": data["title"],
        "description": data.get("description", ""),
        "image_url": data.get("image_url"),
        "category": data.get("category", "Other"),
        "tags": data.get("tags", []),
        "servings": data.get("servings", 2),
        "prep_time_minutes": data.get("prep_time_minutes", 0),
        "cook_time_minutes": data.get("cook_time_minutes", 0),
        "calories": data.get("calories", 0),
        "protein_g": data.get("protein_g", 0),
        "carbs_g": data.get("carbs_g", 0),
        "fat_g": data.get("fat_g", 0),
        "ingredients": data.get("ingredients", []),
        "steps": data.get("steps", []),
        "translated_from": data.get("translated_from"),
        "source_url": source_url,
        "source_type": source_type,
        "created_by": member_id,
        "created_at": now_iso(),
        "deleted_at": None,
    }
    await db.recipes.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.post("/households/{hid}/recipes/import")
async def import_recipe(hid: str, payload: RecipeImport):
    if not await db.households.find_one({"id": hid}):
        raise HTTPException(status_code=404, detail="Household not found")
    try:
        data = await extract_recipe_via_llm(payload.source)
    except Exception as e:
        logger.exception("recipe import failed")
        raise HTTPException(status_code=502, detail=f"Could not read that recipe. Try pasting the text directly. ({e})")
    is_url = bool(re.match(r'^https?://', payload.source.strip(), re.I))
    return await _store_recipe(hid, data, payload.source if is_url else None, "link" if is_url else "text", payload.member_id)


@api_router.post("/households/{hid}/recipes")
async def create_recipe(hid: str, payload: RecipeCreate):
    data = payload.dict()
    data["ingredients"] = [i if isinstance(i, dict) else i.dict() for i in payload.ingredients]
    return await _store_recipe(hid, data, None, "manual", payload.member_id)


@api_router.get("/households/{hid}/recipes")
async def list_recipes(hid: str, category: Optional[str] = None, q: Optional[str] = None):
    query = {"household_id": hid, "deleted_at": None}
    if category and category != "All":
        query["$or"] = [{"category": category}, {"tags": category}]
    if q:
        query["title"] = {"$regex": re.escape(q), "$options": "i"}
    docs = await db.recipes.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs


@api_router.get("/recipes/{rid}")
async def get_recipe(rid: str):
    doc = await db.recipes.find_one({"id": rid, "deleted_at": None}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return doc


@api_router.delete("/recipes/{rid}")
async def delete_recipe(rid: str):
    await db.recipes.update_one({"id": rid}, {"$set": {"deleted_at": now_iso()}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Meal plan routes
# ---------------------------------------------------------------------------
@api_router.get("/households/{hid}/mealplan")
async def get_mealplan(hid: str, start: Optional[str] = None, end: Optional[str] = None):
    query = {"household_id": hid, "deleted_at": None}
    if start and end:
        query["date"] = {"$gte": start, "$lte": end}
    docs = await db.mealplan.find(query, {"_id": 0}).to_list(1000)
    return docs


@api_router.post("/households/{hid}/mealplan")
async def add_mealplan(hid: str, payload: MealPlanCreate):
    recipe = await db.recipes.find_one({"id": payload.recipe_id, "deleted_at": None}, {"_id": 0})
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    doc = {
        "id": new_id(),
        "household_id": hid,
        "date": payload.date,
        "meal_type": payload.meal_type,
        "recipe_id": payload.recipe_id,
        "recipe_title": recipe["title"],
        "recipe_image": recipe.get("image_url"),
        "created_at": now_iso(),
        "deleted_at": None,
    }
    await db.mealplan.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.delete("/mealplan/{mid}")
async def delete_mealplan(mid: str):
    await db.mealplan.update_one({"id": mid}, {"$set": {"deleted_at": now_iso()}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Grocery routes
# ---------------------------------------------------------------------------
@api_router.get("/households/{hid}/grocery")
async def get_grocery(hid: str):
    docs = await db.grocery.find({"household_id": hid, "deleted_at": None}, {"_id": 0}).sort("created_at", 1).to_list(2000)
    return docs


@api_router.post("/households/{hid}/grocery")
async def add_grocery(hid: str, payload: GroceryCreate):
    doc = {
        "id": new_id(),
        "household_id": hid,
        "name": payload.name,
        "quantity": payload.quantity,
        "aisle": payload.aisle if payload.aisle in AISLES else "Other",
        "checked": False,
        "added_by": payload.added_by,
        "recipe_id": None,
        "created_at": now_iso(),
        "deleted_at": None,
    }
    await db.grocery.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.post("/households/{hid}/grocery/from-recipe")
async def grocery_from_recipe(hid: str, payload: GroceryFromRecipe):
    recipe = await db.recipes.find_one({"id": payload.recipe_id, "deleted_at": None}, {"_id": 0})
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    added = []
    for ing in recipe.get("ingredients", []):
        doc = {
            "id": new_id(),
            "household_id": hid,
            "name": ing.get("name", ""),
            "quantity": ing.get("quantity", ""),
            "aisle": ing.get("aisle", "Other"),
            "checked": False,
            "added_by": payload.member_id,
            "recipe_id": payload.recipe_id,
            "created_at": now_iso(),
            "deleted_at": None,
        }
        if doc["name"]:
            await db.grocery.insert_one(doc)
            doc.pop("_id", None)
            added.append(doc)
    return {"added": len(added), "items": added}


@api_router.patch("/grocery/{gid}")
async def update_grocery(gid: str, payload: GroceryUpdate):
    await db.grocery.update_one({"id": gid}, {"$set": {"checked": payload.checked}})
    doc = await db.grocery.find_one({"id": gid}, {"_id": 0})
    return doc


@api_router.delete("/grocery/{gid}")
async def delete_grocery(gid: str):
    await db.grocery.update_one({"id": gid}, {"$set": {"deleted_at": now_iso()}})
    return {"ok": True}


@api_router.delete("/households/{hid}/grocery/completed")
async def clear_completed(hid: str):
    await db.grocery.update_many(
        {"household_id": hid, "checked": True, "deleted_at": None},
        {"$set": {"deleted_at": now_iso()}},
    )
    return {"ok": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
