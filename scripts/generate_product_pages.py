#!/usr/bin/env python3
"""
Generate static product detail pages for SEO.

Reads products.json → generates /p/<id>.html per in-stock product.
Each page:
- Unique title, description, keywords
- Open Graph + Twitter card meta
- Product JSON-LD schema (Google rich result eligible)
- Breadcrumb JSON-LD
- Stock badges per branch
- WA order button with auto-routing
- Wishlist heart
- Related products (same category)

Also generates a sitemap-products.xml entry list to merge into main sitemap.

Run after sync_products.py in workflow:
  python scripts/generate_product_pages.py
"""

import json
import os
import re
import shutil
from pathlib import Path
from datetime import datetime

REPO_ROOT = Path(__file__).parent.parent
PRODUCTS_JSON = REPO_ROOT / "assets" / "data" / "products.json"
OUT_DIR = REPO_ROOT / "p"
SITEMAP_FRAGMENT = REPO_ROOT / "sitemap-products.xml"
SITE = "https://vapertize.id"
CACHE_VER = "v=16"

CATEGORY_LABELS = {
    "liquid": "Liquid",
    "device": "Device",
    "atomizer": "Atomizer",
    "coil-wire": "Coil & Wire",
    "battery-charger": "Battery & Charger",
    "cartridge-cotton": "Cartridge & Cotton",
    "accessories": "Accessories",
}

CATEGORY_ICONS = {
    "liquid": "💧", "device": "🔋", "atomizer": "🔧",
    "coil-wire": "🌀", "battery-charger": "⚡",
    "cartridge-cotton": "🧵", "accessories": "⚙️",
}


def slugify(text):
    """Make text URL-safe & human-readable."""
    s = text.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:60]


def escape_html(text):
    if not text:
        return ""
    return (str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;").replace("'", "&#39;"))


def format_rupiah(num):
    return "Rp " + f"{int(num):,}".replace(",", ".")


def stock_label(p):
    s = p.get("stock", {})
    b = s.get("bangil", 0)
    pd = s.get("pandaan", 0)
    return b, pd, b + pd


def build_product_schema(p):
    """JSON-LD Product schema — Google rich snippet eligible."""
    cat = p.get("category") or p.get("cat") or ""
    b, pd, total = stock_label(p)
    availability = "https://schema.org/InStock" if total > 0 else "https://schema.org/OutOfStock"
    image_url = (f"{SITE}/{p['image']}" if p.get("image") else f"{SITE}/assets/img/og-image.png")
    desc = p.get("desc") or f"{p.get('name', '')} authentic dari Vapertize, toko vape premium di Bangil & Pandaan, Pasuruan."
    schema = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": p.get("name", ""),
        "description": desc,
        "image": image_url,
        "sku": str(p.get("id", "")),
        "brand": {"@type": "Brand", "name": p.get("brand") or "Generic"},
        "category": CATEGORY_LABELS.get(cat, "Vape"),
        "offers": {
            "@type": "Offer",
            "url": f"{SITE}/p/{p['id']}.html",
            "priceCurrency": "IDR",
            "price": str(int(p.get("price", 0))),
            "availability": availability,
            "seller": {"@type": "Organization", "name": "Vapertize"},
            "areaServed": "Indonesia"
        }
    }
    return json.dumps(schema, ensure_ascii=False, indent=2)


def build_breadcrumb_schema(p):
    cat = p.get("category") or p.get("cat") or ""
    cat_label = CATEGORY_LABELS.get(cat, "Produk")
    schema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE}/"},
            {"@type": "ListItem", "position": 2, "name": "Katalog", "item": f"{SITE}/catalog.html"},
            {"@type": "ListItem", "position": 3, "name": cat_label, "item": f"{SITE}/catalog.html?cat={cat}"},
            {"@type": "ListItem", "position": 4, "name": p.get("name", ""), "item": f"{SITE}/p/{p['id']}.html"}
        ]
    }
    return json.dumps(schema, ensure_ascii=False, indent=2)


def get_related(all_products, current, n=4):
    """Same category products, exclude self, prefer in-stock."""
    cat = current.get("category") or current.get("cat")
    rel = [p for p in all_products if (p.get("category") or p.get("cat")) == cat and p["id"] != current["id"]]
    # Sort: in-stock first
    rel.sort(key=lambda p: -(p.get("stock", {}).get("bangil", 0) + p.get("stock", {}).get("pandaan", 0)))
    return rel[:n]


def render_product_page(p, all_products):
    name = escape_html(p.get("name", ""))
    brand = escape_html(p.get("brand", ""))
    cat = p.get("category") or p.get("cat") or ""
    cat_label = CATEGORY_LABELS.get(cat, "Produk")
    cat_icon = CATEGORY_ICONS.get(cat, "📦")
    desc = escape_html(p.get("desc") or f"{name} authentic di Vapertize. Toko vape premium Bangil & Pandaan, Pasuruan. Garansi resmi distributor.")
    price = p.get("price", 0)
    old_price = p.get("oldPrice")
    b, pd, total = stock_label(p)
    image_html = (
        f'<img src="/{p["image"]}" alt="{name}" loading="lazy">'
        if p.get("image")
        else f'<div class="pdetail-emoji">{p.get("icon") or cat_icon}</div>'
    )

    # Stock display per branch
    bangil_status = '<span style="color:#22c55e">✓ Ready</span>' if b > 0 else '<span style="color:#ff3b60">✗ Habis</span>'
    pandaan_status = '<span style="color:#22c55e">✓ Ready</span>' if pd > 0 else '<span style="color:#ff3b60">✗ Habis</span>'
    urgent_html = ""
    if 0 < total <= 3:
        urgent_html = f'<div style="margin:12px 0"><span class="stock-urgent">🔥 Tersisa {total}</span></div>'

    notify_html = ""
    if total == 0:
        notify_html = f'<button class="btn btn-secondary btn-block btn-lg" style="margin-top:12px" onclick="notifyRestock(\'{p["id"]}\', \'{escape_html(p.get("name", ""))}\')">🔔 Beritahu Saya Saat Ready</button>'

    related = get_related(all_products, p, 4)
    related_html = ""
    if related:
        related_cards = "\n".join([
            f'''<a href="/p/{r["id"]}.html" class="related-card">
              <div class="related-img">{r.get("icon") or cat_icon}</div>
              <div class="related-info">
                <div class="related-brand">{escape_html(r.get("brand", ""))}</div>
                <div class="related-name">{escape_html(r.get("name", ""))[:50]}</div>
                <div class="related-price">{format_rupiah(r.get("price", 0))}</div>
              </div>
            </a>'''
            for r in related
        ])
        related_html = f'''
        <section class="section" style="padding-top:0">
          <div class="container" style="max-width:1100px">
            <h2 style="font-family:var(--font-display);font-size:28px;letter-spacing:2px;text-transform:uppercase;margin-bottom:24px">Produk Lainnya di {cat_label}</h2>
            <div class="related-grid">
              {related_cards}
            </div>
          </div>
        </section>'''

    canonical = f"{SITE}/p/{p['id']}.html"
    image_url = f"{SITE}/{p['image']}" if p.get("image") else f"{SITE}/assets/img/og-image.png"

    # Meta description — keep under 160 chars
    seo_desc = f"{name} - {brand}. {desc[:80]}. Harga {format_rupiah(price)}. Stok {b+pd} di Bangil/Pandaan. Order via WhatsApp."
    seo_desc = seo_desc[:160]
    seo_title = f"{name} - {brand} {cat_label} Authentic | Vapertize"[:65]

    product_schema = build_product_schema(p)
    breadcrumb_schema = build_breadcrumb_schema(p)

    return f"""<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">

  <title>{seo_title}</title>
  <meta name="description" content="{seo_desc}">
  <meta name="keywords" content="{escape_html(name.lower())}, {escape_html(brand.lower())} vape, harga {escape_html(name.lower())}, jual {cat_label.lower()} pasuruan, vape authentic bangil, vape pandaan">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="theme-color" content="#0a0a0a">

  <link rel="canonical" href="{canonical}">

  <meta property="og:type" content="product">
  <meta property="og:site_name" content="Vapertize">
  <meta property="og:locale" content="id_ID">
  <meta property="og:url" content="{canonical}">
  <meta property="og:title" content="{seo_title}">
  <meta property="og:description" content="{seo_desc}">
  <meta property="og:image" content="{image_url}">
  <meta property="product:price:amount" content="{int(price)}">
  <meta property="product:price:currency" content="IDR">
  <meta property="product:availability" content="{'in stock' if total > 0 else 'out of stock'}">
  <meta property="product:brand" content="{brand}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{seo_title}">
  <meta name="twitter:description" content="{seo_desc}">
  <meta name="twitter:image" content="{image_url}">

  <link rel="icon" type="image/png" sizes="32x32" href="/assets/img/logo-32.png?v=5">
  <link rel="icon" type="image/png" sizes="192x192" href="/assets/img/logo-192.png?v=5">
  <link rel="apple-touch-icon" sizes="192x192" href="/assets/img/logo-192.png?v=5">
  <link rel="manifest" href="/manifest.json">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/style.css?{CACHE_VER}">

  <script type="application/ld+json">
{product_schema}
  </script>
  <script type="application/ld+json">
{breadcrumb_schema}
  </script>
</head>
<body>
  <div id="navbarSlot" data-page="catalog"></div>

  <section class="section" style="padding-top:60px">
    <div class="container" style="max-width:1100px">
      <nav class="breadcrumb" style="justify-content:flex-start;margin-bottom:24px">
        <a href="/index.html">Home</a> /
        <a href="/catalog.html">Katalog</a> /
        <a href="/catalog.html?cat={cat}">{cat_label}</a> /
        <span>{name}</span>
      </nav>

      <div class="pdetail-grid">
        <div class="pdetail-image">
          {image_html}
          {urgent_html}
        </div>
        <div class="pdetail-info">
          <div class="pdetail-brand">{cat_icon} {brand} · {cat_label}</div>
          <h1 class="pdetail-name">{name}</h1>

          <div class="pdetail-price-row">
            {f'<span class="pdetail-old">{format_rupiah(old_price)}</span>' if old_price else ''}
            <span class="pdetail-price">{format_rupiah(price)}</span>
          </div>

          <p class="pdetail-desc">{desc}</p>

          <div class="pdetail-stock-box">
            <div class="pdetail-stock-title">📍 Stok Tersedia</div>
            <div class="pdetail-stock-row">
              <div><strong>Bangil:</strong> {bangil_status}</div>
              <div><strong>Pandaan:</strong> {pandaan_status}</div>
            </div>
          </div>

          {f'''<div class="pdetail-actions">
            <button class="btn btn-primary btn-block btn-lg" onclick="addToCart('{p['id']}')">🛒 Tambah ke Keranjang</button>
            <button class="btn btn-whatsapp btn-block btn-lg" onclick="orderProductWA('{p['id']}')" style="margin-top:10px">💬 Order Cepat via WhatsApp</button>
          </div>''' if total > 0 else f'<div class="pdetail-actions">{notify_html}</div>'}

          <button class="wish-btn" onclick="handleProductWish('{p['id']}', this)" style="position:static;display:flex;width:auto;padding:10px 16px;border-radius:100px;margin-top:16px;gap:8px"><span class="wish-icon">♡</span> <span class="wish-text">Tambah ke Wishlist</span></button>

          <div class="pdetail-trust">
            <div class="trust-item">✓ 100% Authentic</div>
            <div class="trust-item">✓ Garansi resmi distributor</div>
            <div class="trust-item">✓ Pengiriman seluruh Indonesia</div>
            <div class="trust-item">✓ Same-day delivery area Pasuruan</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  {related_html}

  <div id="footerSlot"></div>
  <div id="cartSlot"></div>

  <script src="/assets/js/data.js?{CACHE_VER}"></script>
  <script src="/assets/js/app.js?{CACHE_VER}"></script>
  <script>
    // Sync wishlist heart state on load
    document.addEventListener('DOMContentLoaded', () => {{
      const btn = document.querySelector('.wish-btn');
      if (btn && typeof isInWishlist === 'function' && isInWishlist('{p["id"]}')) {{
        btn.classList.add('active');
        btn.querySelector('.wish-icon').textContent = '♥';
        btn.querySelector('.wish-text').textContent = 'Sudah di Wishlist';
      }}
    }});

    function handleProductWish(id, btn) {{
      const added = toggleWishlist(id);
      btn.classList.toggle('active', added);
      btn.querySelector('.wish-icon').textContent = added ? '♥' : '♡';
      btn.querySelector('.wish-text').textContent = added ? 'Sudah di Wishlist' : 'Tambah ke Wishlist';
      showToast(added ? '❤️ Ditambahkan ke wishlist' : 'Dihapus dari wishlist', added ? 'success' : 'info');
    }}

    function notifyRestock(id, name) {{
      if (typeof openRestockModal === 'function') {{
        openRestockModal(id, name);
      }} else {{
        const wa = '{p.get("brand", "")}';
        window.open('https://wa.me/628137000110?text=' + encodeURIComponent('Halo Risa, tolong kabari saya kalau ' + name + ' sudah ready'), '_blank');
      }}
    }}
  </script>
</body>
</html>
"""


def main():
    if not PRODUCTS_JSON.exists():
        print(f"✗ {PRODUCTS_JSON} not found")
        return

    data = json.loads(PRODUCTS_JSON.read_text())
    products = data["products"]

    # Clean old pages directory and regenerate
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    generated = 0
    skipped_oos = 0
    sitemap_urls = []

    for p in products:
        # Skip out-of-stock (don't generate SEO pages for unavailable)
        b = p.get("stock", {}).get("bangil", 0)
        pd = p.get("stock", {}).get("pandaan", 0)
        if b + pd == 0:
            skipped_oos += 1
            continue

        html = render_product_page(p, products)
        out_path = OUT_DIR / f"{p['id']}.html"
        out_path.write_text(html, encoding="utf-8")
        generated += 1

        sitemap_urls.append(f"""  <url>
    <loc>{SITE}/p/{p['id']}.html</loc>
    <lastmod>{datetime.utcnow().strftime('%Y-%m-%d')}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>""")

    print(f"✓ Generated {generated} product pages, skipped {skipped_oos} out-of-stock")

    # Write sitemap fragment (to merge into main sitemap manually or via another step)
    sitemap_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{chr(10).join(sitemap_urls)}
</urlset>
"""
    SITEMAP_FRAGMENT.write_text(sitemap_content, encoding="utf-8")
    print(f"✓ Wrote sitemap fragment with {len(sitemap_urls)} URLs to {SITEMAP_FRAGMENT}")


if __name__ == "__main__":
    main()
