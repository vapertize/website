#!/usr/bin/env python3
"""
Fetch product images for new/uncovered products using Brave Search Image API.

Strategy:
- Prioritize products by stock (most-stocked first → highest customer impact)
- Skip products that already have a cached image file
- Smart query construction with brand + product name + "vape"
- Validate image (size, dimensions, format) before saving
- Save as resized WebP (~30-50 KB each) to assets/img/products/{kode_barang}.webp
- Update products.json with image references (re-runs sync_products.py)

Requires BRAVE_API_KEY env var (free $5/month credit).
Get key at: https://brave.com/search/api/

Usage:
    BRAVE_API_KEY=BSA_xxx python scripts/fetch_images.py [MAX_FETCHES]

    MAX_FETCHES defaults to 50 (rate-limit friendly).
    Pass 0 or "all" to fetch ALL missing in-stock products (catch-up mode).
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

# ============================================
# CONFIG
# ============================================
REPO_ROOT = Path(__file__).parent.parent
PRODUCTS_JSON = REPO_ROOT / "assets" / "data" / "products.json"
IMAGES_DIR = REPO_ROOT / "assets" / "img" / "products"

BRAVE_API_KEY = os.environ.get("BRAVE_API_KEY", "").strip()
BRAVE_IMAGE_URL = "https://api.search.brave.com/res/v1/images/search"

# Max images per workflow run (rate-limit + commit size friendly)
# Pass 0 or "all" to fetch ALL missing in-stock products in one run (catch-up mode)
_arg = sys.argv[1].strip().lower() if len(sys.argv) > 1 else "50"
if _arg in ("0", "all", "unlimited"):
    MAX_FETCHES = 10_000  # effectively unlimited (covers entire catalog)
    print(f"→ MAX_FETCHES = ALL (catch-up mode)")
else:
    MAX_FETCHES = int(_arg)

# Image specs
TARGET_WIDTH = 500          # resize to 500px wide (4-col grid display)
TARGET_QUALITY = 82         # WebP quality 0-100
MIN_IMG_BYTES = 3_000       # skip tiny icons/thumbnails
MAX_IMG_BYTES = 5_000_000   # skip oversized images (5 MB cap)
SEARCH_DELAY = 1.1          # seconds between API calls (rate limit)


def build_query(product):
    """Build a smart search query for a product."""
    name = product.get("name", "").strip()
    brand = product.get("brand", "").strip()

    # Strip nicotine strength (e.g., "3mg", "6mg") - causes irrelevant medical results
    name = re.sub(r"\s*-?\s*\d+\s*mg\b", "", name, flags=re.IGNORECASE)
    # Strip size (60ml, 30ml) for non-liquid products
    cat = product.get("category", "")
    if cat != "liquid":
        name = re.sub(r"\s*-?\s*\d+\s*ml\b", "", name, flags=re.IGNORECASE)

    # If brand already in name, don't duplicate
    if brand and brand.lower() not in name.lower():
        query = f"{brand} {name}"
    else:
        query = name

    # Add category context for better relevance (sesuai 7 kategori sheet)
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
    """Search Brave Image API, return list of candidate image URLs (best-first)."""
    headers = {
        "Accept": "application/json",
        "X-Subscription-Token": BRAVE_API_KEY,
    }
    # Brave Image Search API params (different from Web Search!)
    # safesearch: only "strict" or "off" (no "moderate")
    # No search_lang / spellcheck on image endpoint
    params = {
        "q": query,
        "count": 10,             # ask for 10 results, pick best
        "safesearch": "off",     # vape = adult product, "strict" filters too much
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

        # Collect all viable candidate URLs (try multiple if first download fails)
        candidates = []
        for res in results:
            props = res.get("properties", {}) or {}
            url = props.get("url") or res.get("thumbnail", {}).get("src")
            if not url:
                continue
            # Skip obvious low-quality sources
            if any(skip in url.lower() for skip in ["icon", "logo", "favicon", "thumb_small"]):
                continue
            candidates.append(url)
        return candidates
    except Exception as e:
        print(f"  ⚠ Brave search error: {e}")
        return []


def download_and_resize(url, output_path):
    """Download image, validate, resize to TARGET_WIDTH, save as WebP."""
    try:
        r = requests.get(
            url,
            timeout=15,
            headers={"User-Agent": "Mozilla/5.0 (compatible; VapertizeBot/1.0)"},
        )
        r.raise_for_status()

        # Validate size
        if not (MIN_IMG_BYTES <= len(r.content) <= MAX_IMG_BYTES):
            return False, f"size {len(r.content)} out of range"

        # Validate it's actually an image
        img = Image.open(BytesIO(r.content))

        # Validate dimensions (skip tiny images)
        if img.width < 100 or img.height < 100:
            return False, f"too small {img.size}"

        # Convert to RGB with dark background (matches website theme)
        if img.mode in ("RGBA", "LA", "P"):
            bg = Image.new("RGB", img.size, (10, 10, 10))  # match website bg
            if img.mode == "P":
                img = img.convert("RGBA")
            mask = img.split()[-1] if img.mode in ("RGBA", "LA") else None
            bg.paste(img, mask=mask)
            img = bg
        elif img.mode != "RGB":
            img = img.convert("RGB")

        # Resize if too wide
        if img.width > TARGET_WIDTH:
            ratio = TARGET_WIDTH / img.width
            img = img.resize((TARGET_WIDTH, int(img.height * ratio)), Image.LANCZOS)

        # Save as WebP
        img.save(output_path, "WEBP", quality=TARGET_QUALITY, method=6)
        return True, "ok"
    except Exception as e:
        return False, f"download error: {e}"


def main():
    if not BRAVE_API_KEY:
        print("✗ BRAVE_API_KEY not set", file=sys.stderr)
        print("  Sign up at https://brave.com/search/api/")
        print("  Then add to GitHub repo secrets as BRAVE_API_KEY")
        sys.exit(0)  # exit 0 — workflow continues, just skips this step

    if not PRODUCTS_JSON.exists():
        print(f"✗ {PRODUCTS_JSON} not found. Run sync_products.py first.", file=sys.stderr)
        sys.exit(1)

    data = json.loads(PRODUCTS_JSON.read_text())
    products = data["products"]

    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    # Scan existing images (cache check)
    existing = set()
    for f in IMAGES_DIR.iterdir():
        if f.is_file() and f.suffix.lower() in (".webp", ".png", ".jpg", ".jpeg"):
            existing.add(f.stem)

    print(f"✓ Found {len(existing)} cached product images")

    # Filter targets: products without image, in stock, not yet cached
    targets = []
    for p in products:
        if p["id"] in existing:
            continue
        total_stock = p.get("stock", {}).get("bangil", 0) + p.get("stock", {}).get("pandaan", 0)
        if total_stock == 0:
            continue  # skip out-of-stock to save API quota
        targets.append((total_stock, p))

    # Sort by stock DESC (highest impact first)
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

        # Try up to 3 candidates before giving up on this product
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
