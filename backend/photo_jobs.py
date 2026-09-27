"""Background repair of old photos and non-blocking photo imports."""
import asyncio
import logging
import uuid
from datetime import datetime, timezone

from starlette.concurrency import run_in_threadpool

from object_storage import put_image
from recipe_photos import PHOTO_VERSION, resolve_photo

logger = logging.getLogger(__name__)
_tasks = {}
_semaphore = asyncio.Semaphore(3)


def public_recipe(doc):
    return {key: value for key, value in doc.items() if key not in {"_id", "image_storage_path"}}


async def refresh_photo(db, recipe, html_text=None):
    async with _semaphore:
        rid = recipe["id"]
        status = "unavailable"
        updates = {}
        try:
            photo = await run_in_threadpool(resolve_photo, recipe.get("source_url"), recipe.get("image_url"), html_text)
            if photo:
                revision = str(uuid.uuid4())
                path = f"all-my-meals/uploads/{recipe['household_id']}/{revision}.jpg"
                storage_path = await run_in_threadpool(put_image, path, photo["bytes"])
                updates = {
                    "image_storage_path": storage_path,
                    "image_url": f"/api/households/{recipe['household_id']}/recipes/{rid}/image?v={revision}",
                    "image_source_url": photo["source_url"],
                    "image_width": photo["width"], "image_height": photo["height"],
                }
                status = "ready"
        except Exception:
            logger.exception("Could not save source photo for recipe %s", rid)
            status = "error"
        # A failed refresh must not discard an already verified, stored photo.
        if status != "ready" and recipe.get("image_storage_path"):
            status = "ready"
        elif status != "ready":
            updates.update(image_url=None, image_source_url=None)
        updates.update(image_status=status, image_version=PHOTO_VERSION,
                       image_checked_at=datetime.now(timezone.utc).isoformat())
        await db.recipes.update_one({"id": rid, "deleted_at": None}, {"$set": updates})
        await db.mealplan.update_many(
            {"recipe_id": rid, "household_id": recipe["household_id"], "deleted_at": None},
            {"$set": {"recipe_image": updates.get("image_url", recipe.get("image_url"))}},
        )


def schedule_photo(db, recipe, html_text=None):
    rid = recipe["id"]
    if rid not in _tasks:
        task = asyncio.create_task(refresh_photo(db, recipe, html_text))
        _tasks[rid] = task
        def finished(done):
            _tasks.pop(rid, None)
            if not done.cancelled() and done.exception():
                logger.error("Photo job failed for %s: %s", rid, done.exception())
        task.add_done_callback(finished)


async def repair_existing_photos(db):
    # Persisted version makes migration idempotent across restarts. Pending jobs
    # are recovered after interruption. No LLM calls or recipe-text changes.
    query = {"deleted_at": None, "$or": [{"image_version": {"$ne": PHOTO_VERSION}}, {"image_status": "pending"}]}
    async for doc in db.recipes.find(query, {"_id": 0}):
        if doc.get("source_url") or doc.get("image_url"):
            await db.recipes.update_one({"id": doc["id"]}, {"$set": {"image_status": "pending"}})
            schedule_photo(db, doc)
            if len(_tasks) >= 6:
                await asyncio.wait(list(_tasks.values()), return_when=asyncio.FIRST_COMPLETED)
        else:
            await db.recipes.update_one({"id": doc["id"]}, {"$set": {"image_status": "unavailable", "image_version": PHOTO_VERSION}})


async def stop_photo_jobs():
    tasks = list(_tasks.values())
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)