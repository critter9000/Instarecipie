"""Server-only managed storage. No credentials or storage paths go to the app."""
import logging
import os
import threading

import requests
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
_key = None
_lock = threading.Lock()


def init_storage():
    global _key
    with _lock:
        if not _key:
            response = requests.post(
                f"{STORAGE_URL}/init",
                json={"emergent_key": os.environ.get("EMERGENT_LLM_KEY")},
                timeout=15,
            )
            response.raise_for_status()
            _key = response.json()["storage_key"]
    return _key


def _request(method, path, **kwargs):
    global _key
    headers = kwargs.pop("headers", {})
    for attempt in range(2):
        response = requests.request(
            method, f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": init_storage(), **headers},
            timeout=20, **kwargs,
        )
        if response.status_code == 503 and attempt == 0:
            _key = None
            continue
        response.raise_for_status()
        return response


def put_image(path, data):
    return _request("PUT", path, data=data, headers={"Content-Type": "image/jpeg"}).json()["path"]


def get_image(path):
    response = _request("GET", path)
    return response.content, response.headers.get("Content-Type", "image/jpeg")