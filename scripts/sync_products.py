#!/usr/bin/env python3
"""
Sync product data from Vapertize Google Sheet → assets/data/products.json

Reads CSV from published Google Sheet URL (configured via SHEET_CSV_URL env var
or vars.SHEET_CSV_URL in GitHub repo settings).

Aggregates stock per kode_barang across branches (Bangil + Pandaan).
Infers brand from product name.
Detects NEW products (not in existing JSON) so image fetcher can target them.

Usage:
    SHEET_CSV_URL="https://..." python scripts/sync_products.py
"""

import os
import sys
import csv
import json
import io
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests

# ============================================
# CONFIG
# ============================================
DEFAULT_CSV_URL = (
    "https://docs.google.com/spreadsheets/d/e/"
    "2PACX-1vTaicsIj0eq7g2AYz9h3yoeRwWgvzbThDVKlTCcnjtyvSqwJ811LaVlKd3vzvD4UJD2RYM9sGHhi3Ml"
    "/pub?gid=0&single=true&output=csv"
)
CSV_URL = os.environ.get("SHEET_CSV_URL", "").strip() or DEFAULT_CSV_URL

# Output paths (relative to repo root)
REPO_ROOT = Path(__file__).parent.parent
OUTPUT_JSON = REPO_ROOT / "assets" / "data" / "products.json"
IMAGES_DIR = REPO_ROOT / "assets" / "img" / "products"

# Branch normalization
BRANCH_NORMALIZE = {
    "bangil": "bangil",
    "pandaan": "pandaan",
}

# Category normalization (sheet uses lowercase: liquid, atomizer, etc.)
CATEGORY_ALIASES = {
    "liquid": "liquid",
    "e-juice": "liquid",
    "ejuice": "liquid",
    "device": "device",
    "mod": "device",
    "pod": "device",
    "kit": "device",
    "coil": "coil",
    "coil dan wire": "coil",
    "wire": "coil",
    "atomizer": "atomizer",
    "rda": "atomizer",
    "rta": "atomizer",
    "rdta": "atomizer",
    "tank": "atomizer",
    "accessories": "access",
    "access": "access",
    "aksesoris": "access",
    "battery": "access",
    "battery dan charger": "access",
    "charger": "access",
    "cotton": "access",
    "cartridge dan cotton": "access",
    "cartridge": "access",
}

# Emoji fallback per category
CATEGORY_ICON = {
    "liquid": "💧",
    "device": "🔋",
    "coil": "🌀",
    "atomizer": "🔧",
    "access": "⚙️",
}


def fetch_csv(url):
    """Fetch CSV from Google Sheet published URL."""
    print(f"→ Fetching CSV from {url[:80]}...")
    r = requests.get(url, timeout=30, headers={"User-Agent": "VapertizeBot/1.0"})
    r.raise_for_status()
    print(f"✓ Fetched {len(r.text):,} bytes")
    return r.text


def parse_rows(csv_text):
    """Parse CSV into list of dicts."""
    reader = csv.DictReader(io.StringIO(csv_text))
    rows = list(reader)
    print(f"✓ Parsed {len(rows):,} raw rows")
    return rows


def normalize_branch(s):
    return BRANCH_NORMALIZE.get((s or "").strip().lower(), (s or "").strip().lower())


def normalize_category(s):
    key = (s or "").strip().lower()
    return CATEGORY_ALIASES.get(key, key or "access")


def infer_brand(name):
    """Infer brand from product name (first 1-2 words, capitalized)."""
    if not name:
        return "Vapertize"
    # Take first 1-2 words before separator
    parts = re.split(r"[-–—]|\d+ml|\d+mg|\d+w", name, maxsplit=1)
    first_part = parts[0].strip()
    # Take first word(s) as brand
    words = first_part.split()
    if len(words) == 0:
        return "Vapertize"
    if len(words) == 1:
        return words[0].title()
    # Two-word brand if second word is short (like "Lost Vape", "Steam Crave")
    if len(words[1]) <= 6 and not any(c.isdigit() for c in words[1]):
        return f"{words[0]} {words[1]}".title()
    return words[0].title()


def parse_price(s):
    """Parse price string to int. Returns 0 if invalid."""
    if not s:
        return 0
    try:
        return int(float(str(s).replace(",", "").replace(".", "").strip()))
    except (ValueError, TypeError):
        return 0


def parse_stock(s):
    """Parse stock to int. Returns 0 if invalid."""
    try:
        return max(0, int(float(str(s or "0").strip())))
    except (ValueError, TypeError):
        return 0


def aggregate_products(rows):
    """Aggregate rows by kode_barang, summing stock per branch."""
    products = {}  # {kode_barang: {...}}

    for row in rows:
        kode = (row.get("kode_barang") or "").strip()
        if not kode or kode.lower() in ("nan", "null", ""):
            continue

        name = (row.get("Nama Produk") or "").strip()
        if not name:
            continue

        branch = normalize_branch(row.get("cabang", ""))
        if branch not in ("bangil", "pandaan"):
            continue

        category = normalize_category(row.get("kategori", ""))
        price = parse_price(row.get("harga_jual"))
        stock = parse_stock(row.get("stok"))

        if kode not in products:
            products[kode] = {
                "id": kode,
                "name": name,
                "brand": infer_brand(name),
                "category": category,
                "price": price,
                "stock": {"bangil": 0, "pandaan": 0},
                "icon": CATEGORY_ICON.get(category, "📦"),
            }

        # Aggregate stock per branch (latest price wins if differs)
        products[kode]["stock"][branch] += stock
        if price > 0:
            products[kode]["price"] = price

    return list(products.values())


def add_image_paths(products, existing_images):
    """For each product, check if image file exists in repo."""
    for p in products:
        kode = p["id"]
        # Check for common image formats
        for ext in ("webp", "png", "jpg", "jpeg"):
            candidate = f"assets/img/products/{kode}.{ext}"
            if candidate in existing_images:
                p["image"] = candidate
                break
        # If no image found, leave it unset (frontend will use emoji)


def detect_new_products(products, old_json_path):
    """Compare with old products.json to detect new products."""
    old_ids = set()
    if old_json_path.exists():
        try:
            old_data = json.loads(old_json_path.read_text())
            old_ids = {p["id"] for p in old_data.get("products", [])}
        except (json.JSONDecodeError, KeyError):
            pass

    new_ids = [p["id"] for p in products if p["id"] not in old_ids]
    return new_ids


def main():
    # Fetch & parse
    csv_text = fetch_csv(CSV_URL)
    rows = parse_rows(csv_text)
    products = aggregate_products(rows)

    print(f"✓ Aggregated to {len(products):,} unique products")

    # Stats
    cat_counts = {}
    branch_stock = {"bangil": 0, "pandaan": 0}
    for p in products:
        cat_counts[p["category"]] = cat_counts.get(p["category"], 0) + 1
        for b in branch_stock:
            branch_stock[b] += p["stock"].get(b, 0)

    print(f"  Categories: {cat_counts}")
    print(f"  Total stock: {branch_stock}")

    # Scan existing images
    existing_images = set()
    if IMAGES_DIR.exists():
        for img in IMAGES_DIR.iterdir():
            if img.is_file():
                rel = img.relative_to(REPO_ROOT).as_posix()
                existing_images.add(rel)
    print(f"✓ Found {len(existing_images)} existing product images")

    add_image_paths(products, existing_images)

    # Detect new products (needs image fetch)
    new_ids = detect_new_products(products, OUTPUT_JSON)
    print(f"✓ {len(new_ids)} new products (need image fetch)")

    # Write output
    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    wib = timezone(timedelta(hours=7))
    output = {
        "updated": datetime.now(wib).isoformat(timespec="seconds"),
        "totalProducts": len(products),
        "categories": sorted(cat_counts.keys()),
        "branches": ["bangil", "pandaan"],
        "newProductIds": new_ids,
        "source": "Google Sheet (auto-sync)",
        "products": sorted(products, key=lambda p: p["id"]),
    }

    # Sort products by stock availability (in-stock first), then by name
    output["products"].sort(
        key=lambda p: (
            -(p["stock"]["bangil"] + p["stock"]["pandaan"]),  # in-stock first
            p["category"],
            p["name"],
        )
    )

    OUTPUT_JSON.write_text(
        json.dumps(output, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    size_kb = OUTPUT_JSON.stat().st_size // 1024
    print(f"✓ Wrote {OUTPUT_JSON} ({size_kb} KB)")
    print(f"  Updated: {output['updated']}")


if __name__ == "__main__":
    try:
        main()
    except requests.HTTPError as e:
        print(f"✗ HTTP error fetching sheet: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"✗ Sync failed: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
