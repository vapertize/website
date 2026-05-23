#!/usr/binid/env python3
"""
Fetch product images for new products using Brave Search Image API.

For each product in products.json without a cached image, search Brave for
"{brand} {name} vape product" and download top result.

Saves to assets/img/products/{kode_barang}.webp (resized + compressed).

Requires BRAVE_API_KEY env var (free tier 2000 queries/month).
Get key at: https://api.search.brave.com/

Usage:
    BRAVE_API_KEY=xxx python scripts/fetch_images.py
"""

import os
import sys
import json
import time
from pathlib import Path

import requests
from PIL import Image
from io import BytesIO

REPO_ROOT = Path(__file__).parent.parent
PRODUCTS_JSON = REPO_ROOT / "assets" / "data" / "products.json"
IMAGES_DIR = REPO_ROOT / "assets" / "img" / "products"

BRAVE_API_KEY = os.environ.get("BRAVE_API_KEY", "").strip()
BRAVE_IMAGE_URL = "https://api.search.brave.com/res/v1/images/search"

# Limits to avoid abuse
MAX_FETCHES_PER_RUN = 50  # cap so we don't burn through quota
TARGET_WIDTH = 500  # resize to 500px wide
TARGET_QUALITY = 82  # WebP quality


def search_brave_image(query):
    """Search Brave Image API, return top result URL or None."""
    if not BRAVE_API_KEY:
        return None

    headers = {
        "Accept": "application/json",
        "X-Subscription-Token": BRAVE_API_KEY,
    }
    params = {
        "q": query,
        "count": 5,
        "safesearch": "moderate",
        "search_lang": "en",
    }
    try:
        r = requests.get(BRAVE_IMAGE_URL, headers=headers, params=params, timeout=10)
        r.raise_for_status()
        data = r.json()
        results = data.get("results", [])
        if not results:
            return None
        # Prefer larger images (>= 300px) and recognizable hosts
        for res in results:
            props = res.get("properties", {})
            url = props.get("url") or res.get("thumbnail", {}).get("src")
            if url:
                return url
        return None
    except Exception as e:
        print(f"  ⚠ Brave search error: {e}")
        return None


def download_and_resize(url, output_path):
    """Download image and save as resized WebP."""
    try:
        r = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()

        img = Image.open(BytesIO(r.content))
        # Convert to RGB (handle RGBA, palette, etc.)
        if img.mode in ("RGBA", "LA", "P"):
            bg = Image.new("RGB", img.size, (10, 10, 10))  # dark bg to match theme
            if img.mode == "P":
                img = img.convert("RGBA")
            bg.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
            img = bg
        elif img.mode != "RGB":
            img = img.convert("RGB")

        # Resize if too large
        if img.width > TARGET_WIDTH:
            ratio = TARGET_WIDTH / img.width
            new_size = (TARGET_WIDTH, int(img.height * ratio))
            img = img.resize(new_size, Image.LANCZOS)

        img.save(output_path, "WEBP", quality=TARGET_QUALITY, method=6)
        return True
    except Exception as e:
        print(f"  ⚠ Download error: {e}")
        return False


def main():
    if not PRODUCTS_JSON.exists():
        print(f"✗ {PRODUCTS_JSON} not found. Run sync_products.py first.", file=sys.stderr)
        sys.exit(1)

    if not BRAVE_API_KEY:
        print("⚠ BRAVE_API_KEY not set. Skipping image fetch.")
        print("  Get free API key at: https://api.search.brave.com/")
        sys.exit(0)

    data = json.loads(PRODUCTS_JSON.read_text())
    products = data["products"]
    new_ids = set(data.get("newProductIds", []))

    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    existing = {f.stem for f in IMAGES_DIR.iterdir() if f.is_file()}

    # Targets: products without image AND (in new_ids OR no image at all)
    targets = []
    for p in products:
        if p["id"] in existing:
            continue
        if "image" in p and p["image"]:
            continue
        # Only fetch in-stock products to save API quota
        if p["stock"]["bangil"] + p["stock"]["pandaan"] == 0:
            continue
        targets.append(p)

    targets = targets[:MAX_FETCHES_PER_RUN]
    print(f"→ Fetching images for {len(targets)} products (max {MAX_FETCHES_PER_RUN} per run)")

    fetched = 0
    skipped = 0
    for i, p in enumerate(targets, 1):
        query = f"{p['brand']} {p['name']} vape product"
        print(f"[{i}/{len(targets)}] {p['id']}: {query[:60]}")

        img_url = search_brave_image(query)
        if not img_url:
            print(f"  ⚠ No image found")
            skipped += 1
            continue

        output_path = IMAGES_DIR / f"{p['id']}.webp"
        if download_and_resize(img_url, output_path):
            print(f"  ✓ Saved {output_path.name}")
            fetched += 1
        else:
            skipped += 1

        # Rate limit: ~1 req/sec to be polite
        time.sleep(1.1)

    print(f"\n✓ Done. Fetched: {fetched}, Skipped: {skipped}")
    print(f"  Run sync_products.py again to update products.json with new image paths")


if __name__ == "__main__":
    main()
