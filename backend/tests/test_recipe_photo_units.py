"""Unit tests for recipe photo source resolution edge cases."""

from io import BytesIO
import sys
from pathlib import Path

import pytest
from PIL import Image

sys.path.append(str(Path(__file__).resolve().parents[1]))
import recipe_photos as rp


# Module: recipe_photos parsing/security/normalization edge scenarios
YID = "ysaHg7qzoK0"


def _png_bytes(width=300, height=300):
    image = Image.new("RGB", (width, height), (120, 120, 120))
    data = BytesIO()
    image.save(data, format="PNG")
    return data.getvalue()


@pytest.mark.parametrize(
    "url",
    [
        f"https://www.youtube.com/watch?ab_channel=test&v={YID}",
        f"https://www.youtube.com/shorts/{YID}",
        f"https://youtu.be/{YID}?si=abc",
        f"https://www.youtube.com/embed/{YID}",
        f"https://www.youtube.com/live/{YID}?feature=share",
    ],
)
def test_youtube_id_formats(url):
    assert rp.youtube_id(url) == YID


def test_youtube_lookalike_host_rejected():
    assert rp.youtube_id(f"https://www.youtube.com.evil.com/watch?v={YID}") is None
    assert rp.youtube_id(f"https://youtube.com.evil/watch?v={YID}") is None


def test_maxres_fallbacks_to_hqdefault(monkeypatch):
    calls = []

    def fake_download(url, limit=rp.MAX_BYTES):
        calls.append(url)
        if "maxresdefault" in url:
            raise ValueError("missing")
        return _png_bytes(1280, 720), "image/png", url

    monkeypatch.setattr(rp, "download", fake_download)
    out = rp.resolve_photo(f"https://www.youtube.com/watch?v={YID}")

    assert out is not None
    assert calls[0].endswith("maxresdefault.jpg")
    assert calls[1].endswith("hqdefault.jpg")
    assert out["source_url"].endswith("hqdefault.jpg")


def test_invalid_bytes_and_html_are_rejected(monkeypatch):
    def fake_download(url, limit=rp.MAX_BYTES):
        return b"<html>not image</html>", "image/jpeg", url

    monkeypatch.setattr(rp, "download", fake_download)
    assert rp.resolve_photo("https://example.com/recipe") is None


def test_tiny_logo_rejected():
    with pytest.raises(ValueError):
        rp.normalize_image(_png_bytes(80, 80))


def test_private_url_rejected_fast():
    assert rp.public_url("http://127.0.0.1/image.jpg") is False
    assert rp.public_url("http://localhost/image.jpg") is False


def test_page_candidates_reversed_meta_and_relative_and_nested_jsonld():
    html = """
    <html><head>
      <meta content="/images/meta-photo.jpg" property="og:image" />
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@graph": [{
          "@type": "Recipe",
          "image": [{"url": "/images/recipe-main.jpg"}],
          "video": {
            "@type": "VideoObject",
            "thumbnailUrl": ["/images/video-thumb.jpg", {"url": "/images/video-thumb-2.jpg"}]
          }
        }]
      }
      </script>
    </head></html>
    """
    result = rp.page_candidates(html, "https://example.com/posts/recipe")
    assert "https://example.com/images/meta-photo.jpg" in result
    assert "https://example.com/images/recipe-main.jpg" in result
    assert "https://example.com/images/video-thumb.jpg" in result
    assert "https://example.com/images/video-thumb-2.jpg" in result
