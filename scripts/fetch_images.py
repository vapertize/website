#!/usr/bin/env python3
"""
Fetch product images for new/uncovered products using Brave Search Image API.
"""

import os
import sys
import json
import time
import re
from pathlib import Path
from io import BytesIO

import requests
from PIL import Image

REPO_ROOT = Path(__file__).parent.parent
PRODUCTS_JSON = REPO_ROOT / "assets" / "data" / "products.json"
IMAGES_DIR = REPO_ROOT / "assets" / "img" / "products"

BRAVE_API_KEY = os.environ.get("BRAVE_API_KEY", "").strip()
BRAVE_IMAGE_URL = "https://api.search.brave.com/res/v1/images/search"

MAX_FETCHES = int(sys.argv[1]) if len(sys.argv) > 1 else 50

TARGET_WIDTH = 500
TARGET_QUALITY = 82
MIN_IMG_BYTES = 3_000
MAX_IMG_BYTES = 5_000_000
SEARCH_DELAY = 1.1


def build_query(product):
    name = product.get("name", "").strip()
    brand = product.get("brand", "").strip()
    name = re.sub(r"\s*-?\s*\d+\s*mg\b", "", name, flags=re.IGNORECASE)
    cat = product.get("category", "")
    if cat != "liquid":
        name = re.sub(r"\s*-?\s*\d+\s*ml\b", "", name, flags=re.IGNORECASE)
    if brand and brand.lower() not in name.lower():
        query = f"{brand} {name}"
    else:
        query = name
    category_terms = {
        "liquid":           "e-liquid vape juice",
        "device":           "vape mod pod kit",
        "atomizer":         "vape rda rta atomizer",
        "coil-wire":        "vape coil mesh wire kanthal",
        "battery-charger":  "vape battery 18650 charger",
        "cartridge-cotton": "vape cartridge cotton refill",
        "accessories":      "vape accessory",
    }
    query = f"{query} {category_terms.get(cat, 'vape')}"
    return query.strip()


def search_brave_image(query):
    headers = {
        "Accept": "application/json",
        "X-Subscription-Token": BRAVE_API_KEY,
    }
    params = {
        "q": query,
        "count": 10,
        "safesearch": "off",
        "country": "ID",
    }
    try:
        r = requests.get(BRAVE_IMAGE_URL, headers=headers, params=params, timeout=15)
        if r.status_code == 429:
            print(f"  ⚠ Rate limited, sleeping 60s")
            time.sleep(60)
            return []
        r.raise_for_status()
        data = r.json()
        results = data.get("results", [])
        candidates = []
        for res in results:
            props = res.get("properties", {}) or {}
            url = props.get("url") or res.get("thumbnail", {}).get("src")
            if not url:
                continue
            if any(skip in url.lower() for skip in ["icon", "logo", "favicon", "thumb_small"]):
                continue
            candidates.append(url)
        return candidates
    except Exception as e:
        print(f"  ⚠ Brave search error: {e}")
        return []


def download_and_resize(url, output_path):
    try:
        r = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0 (compatible; VapertizeBot/1.0)"})
        r.raise_for_status()
        if not (MIN_IMG_BYTES <= len(r.content) <= MAX_IMG_BYTES):
            return False, f"size {len(r.content)} out of range"
        img = Image.open(BytesIO(r.content))
        if img.width < 100 or img.height < 100:
            return False, f"too small {img.size}"
        if img.mode in ("RGBA", "LA", "P"):
            bg = Image.new("RGB", img.size, (10, 10, 10))
            if img.mode == "P":
                img = img.convert("RGBA")
            mask = img.split()[-1] if img.mode in ("RGBA", "LA") else None
            bg.paste(img, mask=mask)
            img = bg
        elif img.mode != "RGB":
            img = img.convert("RGB")
        if img.width > TARGET_WIDTH:
            ratio = TARGET_WIDTH / img.width
            img = img.resize((TARGET_WIDTH, int(img.height * ratio)), Image.LANCZOS)
        img.save(output_path, "WEBP", quality=TARGET_QUALITY, method=6)
        return True, "ok"
    except Exception as e:
        return False, f"download error: {e}"


def main():
    if not BRAVE_API_KEY:
        print("✗ BRAVE_API_KEY not set", file=sys.stderr)
        sys.exit(0)
    if not PRODUCTS_JSON.exists():
        print(f"✗ {PRODUCTS_JSON} not found.", file=sys.stderr)
        sys.exit(1)
    data = json.loads(PRODUCTS_JSON.read_text())
    products = data["products"]
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    existing = set()
    for f in IMAGES_DIR.iterdir():
        if f.is_file() and f.suffix.lower() in (".webp", ".png", ".jpg", ".jpeg"):
            existing.add(f.stem)
    print(f"✓ Found {len(existing)} cached product images")
    targets = []
    for p in products:
        if p["id"] in existing:
            continue
        total_stock = p.get("stock", {}).get("bangil", 0) + p.get("stock", {}).get("pandaan", 0)
        if total_stock == 0:
            continue
        targets.append((total_stock, p))
    targets.sort(reverse=True, key=lambda x: x[0])
    targets = [p for _, p in targets[:MAX_FETCHES]]
    print(f"→ Fetching images for {len(targets)} products (top by stock)")
    print(f"  Max per run: {MAX_FETCHES}, Skipping: {len(existing)} already cached")
    fetched = 0
    skipped = 0
    for i, p in enumerate(targets, 1):
        query = build_query(p)
        stock = p["stock"]["bangil"] + p["stock"]["pandaan"]
        print(f"[{i}/{len(targets)}] {p['id']} (stock {stock}): {query[:70]}")
        candidates = search_brave_image(query)
        if not candidates:
            print(f"  ⚠ No suitable image found")
            skipped += 1
            time.sleep(SEARCH_DELAY)
            continue
        output_path = IMAGES_DIR / f"{p['id']}.webp"
        success = False
        for j, img_url in enumerate(candidates[:3]):
            ok, msg = download_and_resize(img_url, output_path)
            if ok:
                size_kb = output_path.stat().st_size // 1024
                print(f"  ✓ Saved {output_path.name} ({size_kb} KB) [try {j+1}]")
                fetched += 1
                success = True
                break
            else:
                print(f"  · try {j+1}: {msg}")
        if not success:
            print(f"  ⚠ All candidates failed validation")
            skipped += 1
        time.sleep(SEARCH_DELAY)
    print(f"\n=== Done. Fetched: {fetched}, Skipped: {skipped} ===")
    if fetched > 0:
        print(f"  Run sync_products.py to update products.json with new image paths")


if __name__ == "__main__":
    main()
