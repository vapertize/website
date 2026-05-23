# Vapertize Website — Panduan Admin

Dokumen ini menjelaskan cara mengelola data produk yang tampil di [vapertize.id](https://vapertize.id).

## 🔄 Workflow Update Produk (Harian)

**Untuk admin Vapertize:**

1. **Edit data di Google Sheet** "Data Produk" tab **Produk** seperti biasa
   - Update stok, harga, tambah/hapus produk
   - Pastikan kolom: `kode_barang`, `Nama Produk`, `cabang`, `stok`, `harga_jual`, `kategori`
2. **Save sheet** (auto-save Google Sheets aktif by default)
3. **Tunggu** — website akan otomatis update **jam 21:05 WIB setiap hari**
4. **Cek hasil** di [vapertize.id/catalog](https://vapertize.id/catalog) setelah jam 21:30

Itu saja. Tidak perlu publish ulang, tidak perlu klik tombol apa-apa di website. GitHub Action akan:
- Fetch sheet jam 21:05 WIB
- Generate `products.json` baru
- Auto-deploy ke Cloudflare Pages
- Total proses: ~2 menit

## 🚨 Update Mendesak (Tidak Bisa Nunggu Jam 9 Malam)

Kalau perlu update urgent (misal harga promo, stok kritis):

1. Buka [GitHub Actions](https://github.com/vapertize/website/actions/workflows/sync-products.yml)
2. Klik tombol **"Run workflow"** kanan atas
3. Pilih branch `main` → **Run workflow**
4. Tunggu 1-2 menit, lalu refresh website

## 📊 Struktur Sheet "Produk"

| Kolom | Wajib | Contoh | Catatan |
|-------|-------|--------|---------|
| `kode_barang` | ✓ | 1000028 | Unique ID, bisa angka apapun |
| `Nama Produk` | ✓ | Dark Luna 60ml - 6mg | Nama lengkap, brand tercakup di sini |
| `cabang` | ✓ | Bangil / Pandaan | Case-insensitive |
| `stok` | ✓ | 1 | Angka, 0 berarti habis |
| `harga_jual` | ✓ | 155000 | Rupiah, tanpa titik/koma |
| `kategori` | ✓ | liquid | Lihat kategori valid di bawah |

**Kategori valid (otomatis di-normalize):**
- `liquid` / `e-juice` → **Liquid** 💧
- `device` / `mod` / `pod` / `kit` → **Device** 🔋
- `coil` / `coil dan wire` / `wire` → **Coil** 🌀
- `atomizer` / `rda` / `rta` / `rdta` / `tank` → **Atomizer** 🔧
- `accessories` / `aksesoris` / `battery dan charger` / `cartridge dan cotton` → **Accessories** ⚙️

Kalau ada kategori lain, akan masuk ke "Accessories" sebagai fallback. Untuk tambah kategori baru, edit `scripts/sync_products.py`.

## 🖼 Gambar Produk

Saat ini gambar pakai **emoji default per kategori**. Untuk gambar asli, ada 2 cara:

### Cara 1: Upload Manual (paling reliable)

1. Siapkan gambar produk (resize ke max 500px lebar, format WebP/PNG/JPG)
2. Upload ke folder `assets/img/products/` di GitHub repo
3. **Nama file harus sama dengan `kode_barang`** (contoh: `1000028.webp`)
4. Commit & push → website auto-update

### Cara 2: AI Auto-Fetch (eksperimental)

Setup sekali:
1. Daftar Brave Search API gratis: https://api.search.brave.com/
2. Tambah API key ke GitHub repo secrets: `BRAVE_API_KEY`

Pakai:
1. Trigger workflow manual dengan opsi `fetch_images: true`
2. Script akan search Brave Image untuk top 50 produk baru yang belum ada gambar
3. Download + resize ke WebP otomatis

⚠ AI fetch kadang dapat gambar salah/tidak presisi. Untuk produk high-traffic, lebih baik upload manual.

## 📍 Multi-Cabang

Website punya **branch picker** di halaman katalog. User pilih:
- **Semua Cabang** — tampil semua produk yang ada stok di Bangil ATAU Pandaan
- **Bangil** — hanya produk yang stok > 0 di Bangil
- **Pandaan** — hanya produk yang stok > 0 di Pandaan

Setiap produk menampilkan stok per cabang (warna hijau kalau ada, abu kalau 0).

## 🛒 Sistem Member (Sheet POIN)

Sheet **POIN BANGIL** dan **POIN PANDAAN** belum di-integrate ke website. Saat ini member system pakai localStorage browser saja.

Untuk integrate, perlu:
- Backend authentication (Cloudflare Worker + KV)
- Privacy review (data member sensitif)

Hubungi developer untuk roadmap ini.

## 🔧 Troubleshooting

### Website tidak update setelah edit sheet
- Cek waktu — sync jalan jam 21:05 WIB
- Cek [GitHub Actions](https://github.com/vapertize/website/actions) — apakah workflow sukses
- Cek URL CSV sheet masih valid (kadang Google revoke publish setelah lama)

### Workflow failed
- Klik workflow yang failed → lihat log
- Common issues:
  - **403/404 sheet**: re-publish sheet di Google
  - **Parse error**: ada karakter aneh di nama produk (comma di tengah nama? perlu di-escape)
- Hubungi developer kalau tidak jelas

### Cara update URL sheet (kalau berubah)
1. Buka [repo settings → Secrets and variables → Actions → Variables](https://github.com/vapertize/website/settings/variables/actions)
2. Edit / tambah variable `SHEET_CSV_URL` dengan URL CSV baru
3. Workflow run berikutnya pakai URL baru

## 📞 Kontak Developer

Untuk masalah teknis di luar dokumen ini, hubungi developer via:
- WhatsApp AI Risa: 0813-7000-0110 (subject: "Website Vapertize")
- Email: store@vapertize.com (subject: "Website Tech Support")
