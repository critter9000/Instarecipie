"""Resolve source-owned recipe photos, never stock images or LLM-guessed URLs."""
import html
import ipaddress
import json
import logging
import re
import socket
from html.parser import HTMLParser
from io import BytesIO
from urllib.parse import parse_qs, urljoin, urlsplit

import requests
from PIL import Image, ImageOps

logger = logging.getLogger(__name__)
PHOTO_VERSION = 1
MAX_BYTES = 6 * 1024 * 1024
YOUTUBE_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com", "youtu.be", "www.youtu.be"}
LEGACY_STOCK_IDS = (
    "photo-1490645935967-10de6ba17061", "photo-1512621776951-a57141f2eefd",
    "photo-1467003909585-2f8a72700288", "photo-1546069901-ba9599a7e63c",
    "photo-1476224203421-9ac39bcb3327",
)


def youtube_id(source):
    try:
        parsed = urlsplit(source or "")
        if parsed.hostname not in YOUTUBE_HOSTS or parsed.scheme not in ("http", "https"):
            return None
        parts = parsed.path.strip("/").split("/")
        if parsed.hostname in {"youtu.be", "www.youtu.be"}:
            value = parts[0]
        elif parts[0] in {"shorts", "embed", "live", "v"} and len(parts) > 1:
            value = parts[1]
        else:
            value = parse_qs(parsed.query).get("v", [""])[0]
        return value if re.fullmatch(r"[\w-]{11}", value, flags=re.ASCII) else None
    except ValueError:
        return None


def legacy_stock(url):
    return bool(url and any(value in url for value in LEGACY_STOCK_IDS))


def public_url(url):
    """Disallow credentials, private destinations and non-HTTP schemes on every redirect."""
    try:
        parsed = urlsplit(url)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
            return False
        if parsed.port not in {None, 80, 443}:
            return False
        addresses = socket.getaddrinfo(parsed.hostname, parsed.port or 443, type=socket.SOCK_STREAM)
        return bool(addresses) and all(ipaddress.ip_address(a[4][0]).is_global for a in addresses)
    except (ValueError, OSError):
        return False


def download(url, limit=MAX_BYTES):
    for _ in range(4):
        if not public_url(url):
            raise ValueError("Not a public image source")
        with requests.get(url, timeout=(4, 8), stream=True, allow_redirects=False,
                          headers={"User-Agent": "Mozilla/5.0", "Accept-Language": "en-US,en;q=0.9"}) as response:
            if response.is_redirect:
                url = urljoin(url, response.headers.get("Location", ""))
                continue
            response.raise_for_status()
            data = bytearray()
            for chunk in response.iter_content(65536):
                data.extend(chunk)
                if len(data) > limit:
                    raise ValueError("Source exceeds size limit")
            return bytes(data), response.headers.get("Content-Type", ""), url
    raise ValueError("Too many redirects")


class PageMedia(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.meta = {}
        self.nodes = []
        self._json = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "meta":
            key = (attrs.get("property") or attrs.get("name") or "").lower()
            if attrs.get("content"):
                self.meta.setdefault(key, []).append(attrs["content"])
        if tag == "script" and attrs.get("type", "").lower() == "application/ld+json":
            self._json = []

    def handle_data(self, data):
        if self._json is not None:
            self._json.append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self._json is not None:
            try:
                self.nodes.append(json.loads("".join(self._json)))
            except (ValueError, TypeError):
                pass
            self._json = None


def image_values(value):
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [url for item in value for url in image_values(item)]
    if isinstance(value, dict):
        return image_values(value.get("url") or value.get("contentUrl"))
    return []


def structured_photos(nodes):
    recipes, videos = [], []
    stack = list(nodes)
    while stack:
        node = stack.pop()
        if isinstance(node, list):
            stack.extend(node)
        elif isinstance(node, dict):
            types = node.get("@type", [])
            types = [types] if isinstance(types, str) else types
            if "Recipe" in types:
                recipes.extend(image_values(node.get("image")))
            if "VideoObject" in types:
                videos.extend(image_values(node.get("thumbnailUrl") or node.get("image")))
            stack.extend(v for v in node.values() if isinstance(v, (list, dict)))
    return recipes + videos


def page_candidates(text, source):
    parser = PageMedia()
    parser.feed(text or "")
    candidates = structured_photos(parser.nodes)
    for key in ("og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src"):
        candidates.extend(parser.meta.get(key, []))
    result = []
    for candidate in candidates:
        url = urljoin(source, html.unescape(candidate).strip())
        if url not in result and not legacy_stock(url):
            result.append(url)
    return result


def normalize_image(data):
    """Reject HTML, tracking pixels and oversized images; store a bounded JPEG."""
    with Image.open(BytesIO(data)) as original:
        if original.format not in {"JPEG", "PNG", "WEBP", "AVIF"}:
            raise ValueError("Unsupported image")
        width, height = original.size
        if min(width, height) < 180 or width * height > 25_000_000:
            raise ValueError("Not a usable recipe photo")
        image = ImageOps.exif_transpose(original).convert("RGB")
        image.thumbnail((1280, 1280))
        output = BytesIO()
        image.save(output, format="JPEG", quality=86, optimize=True)
        return output.getvalue(), image.width, image.height


def resolve_photo(source, existing=None, html_text=None):
    """YouTube always resolves by exact video ID, ahead of generic page metadata."""
    video_id = youtube_id(source)
    if video_id:
        candidates = [f"https://i.ytimg.com/vi/{video_id}/{size}.jpg" for size in ("maxresdefault", "hqdefault")]
    elif source:
        if html_text is None:
            try:
                data, content_type, canonical = download(source, 2 * 1024 * 1024)
                if "html" not in content_type.lower():
                    return None
                html_text = data.decode("utf-8", errors="replace")
                source = canonical
                # Short share links can redirect to a YouTube video.
                if youtube_id(source):
                    return resolve_photo(source)
            except (requests.RequestException, ValueError):
                html_text = ""
        candidates = page_candidates(html_text, source)
    else:
        candidates = []
    # Only preserve explicit manual images. A legacy URL image may be a logo,
    # avatar, unrelated recommendation, or a web page rather than an image.
    if not source and existing and not legacy_stock(existing):
        candidates.append(existing)
    for url in candidates[:4]:
        try:
            data, content_type, final_url = download(url)
            if not content_type.lower().startswith("image/"):
                continue
            image, width, height = normalize_image(data)
            return {"bytes": image, "width": width, "height": height, "source_url": final_url}
        except (requests.RequestException, ValueError, OSError, Image.DecompressionBombError):
            continue
    return None