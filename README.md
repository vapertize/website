# VAPERTIZE - Website & Apps

Website company profile + katalog produk untuk toko vape **Vapertize**.

## Struktur File

```
Website & Apps Vapertize/
├── index.html          → Halaman utama (Home)
├── catalog.html        → Katalog produk dengan filter & search
├── member.html         → Login/Register member + Dashboard poin
├── contact.html        → Kontak & lokasi toko
└── assets/
    ├── css/style.css   → Semua styling (dark mode modern)
    └── js/
        ├── data.js     → Database produk & kategori (edit di sini)
        └── app.js      → Logic cart, member, navbar, footer
```

## Cara Pakai

### 1. Buka di Browser (Local Preview)
- Double-click `index.html` untuk preview langsung di browser
- Atau drag file ke browser

### 2. Ganti Info Toko
Edit file **`assets/js/app.js`** bagian `STORE_INFO`:

```js
const STORE_INFO = {
  name: 'Vapertize',
  phone: '+62 812-3456-7890',        // ← ganti nomor toko
  whatsapp: '6281234567890',          // ← ganti tanpa + dan 0 (pakai 62)
  email: 'info@vapertize.com',        // ← ganti email
  hours: '08.00 - 22.00 WIB',
  instagram: 'https://instagram.com/vapertize',
  facebook: 'https://facebook.com/vapertize.id',
  stores: [
    { name: 'Vapertize Bangil', address: '...', phone: '...' },
    { name: 'Vapertize Pandaan', address: '...', phone: '...' }
  ]
};
```

### 3. Edit / Tambah Produk
Edit file **`assets/js/data.js`**, tambahkan ke array `PRODUCTS`:

```js
{
  id: 'l007',                    // unik, awalan: l=liquid, d=device, c=coil, a=access
  cat: 'liquid',                 // liquid | device | coil | access
  name: 'Nama Produk',
  brand: 'Brand',
  desc: 'Deskripsi singkat',
  price: 100000,
  oldPrice: 130000,              // optional, untuk harga coret
  tag: 'hot',                    // optional: hot | new | sale
  icon: '🥭'                     // emoji sebagai gambar (atau ganti ke <img>)
}
```

### 4. Deploy Online (Gratis)
- **Vercel**: drag folder ini ke https://vercel.com/new
- **Netlify**: drag folder ke https://app.netlify.com/drop
- **GitHub Pages**: push ke GitHub, aktifkan Pages di Settings

## Fitur Utama

- 🎨 **Dark Mode Modern** dengan neon cyan & pink accent
- 📦 **Katalog Produk** 24 produk dummy (Liquid, Device, Coil, Accessories)
- 🛒 **Keranjang Belanja** dengan localStorage
- 💬 **Order via WhatsApp** otomatis dengan format pesan rapi
- 👤 **Sistem Member** login/register pakai localStorage
- ⭐ **Poin & Reward** member system dengan tier (Bronze → Diamond)
- 🔍 **Filter & Search** produk by kategori & keyword
- 📍 **Lokasi Toko** dengan Google Maps embed
- 🔞 **Age Gate 21+** verifikasi usia saat pertama buka
- 📱 **Fully Responsive** mobile-friendly

## Catatan Penting

- **Sistem member** disimpan di **localStorage browser**, jadi data hilang kalau user clear browser cache. Untuk produksi, perlu backend (Firebase, Supabase, dll).
- **Gambar produk** saat ini pakai emoji. Untuk gambar asli, ganti `icon: '🥭'` di `data.js` ke `<img src="path/foto.jpg">` dan sesuaikan CSS `.product-img`.
- **Nomor WhatsApp** harus format **62xxx** (tanpa + dan 0). Contoh: 081234567890 → 6281234567890

## Customize Cepat

| Mau ubah | Edit file | Bagian |
|----------|-----------|--------|
| Warna brand | `assets/css/style.css` | `:root --accent` & `--accent-2` |
| Logo / Nama | semua file `.html` | Cari `Vapertize` & `<div class="logo-mark">V</div>` |
| Info kontak | `assets/js/app.js` | Object `STORE_INFO` |
| Produk | `assets/js/data.js` | Array `PRODUCTS` |
| Reward | `assets/js/data.js` | Array `REWARDS` |

---

Made with ❤️ for Vapertize Vape Store · Bangil & Pandaan
