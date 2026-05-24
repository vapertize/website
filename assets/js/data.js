// ============================================
// VAPERTIZE - Product Database
// ============================================
// Strategy:
// 1. Synced PRODUCTS_JSON from Google Sheet via GitHub Action (assets/data/products.json)
// 2. Fallback to hardcoded PRODUCTS_FALLBACK if JSON fetch fails
// 3. Dynamic branch filter via getCurrentBranch()

// Branch state (persisted in localStorage)
function getCurrentBranch() {
  return localStorage.getItem('vt_branch') || 'all'; // 'bangil' | 'pandaan' | 'all'
}

function setCurrentBranch(branch) {
  localStorage.setItem('vt_branch', branch);
  window.dispatchEvent(new CustomEvent('vt_branch_changed', { detail: branch }));
}

// Loaded products (populated by loadProducts())
let PRODUCTS_DATA = null;     // raw JSON from sheet
let PRODUCTS_META = null;     // { updated, totalProducts, categories, branches }

async function loadProducts() {
  if (PRODUCTS_DATA) return PRODUCTS_DATA;
  try {
    const r = await fetch('assets/data/products.json?v=' + Date.now(), { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const json = await r.json();
    PRODUCTS_DATA = json.products;
    PRODUCTS_META = {
      updated: json.updated,
      total: json.totalProducts,
      categories: json.categories,
      branches: json.branches,
      source: json.source,
    };
    return PRODUCTS_DATA;
  } catch (e) {
    console.warn('[Vapertize] Failed to load products.json, using fallback:', e);
    PRODUCTS_DATA = PRODUCTS_FALLBACK;
    PRODUCTS_META = { total: PRODUCTS_FALLBACK.length, categories: ['liquid','device','atomizer','coil-wire','battery-charger','cartridge-cotton','accessories'], branches: ['bangil','pandaan'], source: 'fallback' };
    return PRODUCTS_DATA;
  }
}

// Backwards compat: PRODUCTS is the live list filtered by current branch
Object.defineProperty(window, 'PRODUCTS', {
  get() {
    const data = PRODUCTS_DATA || PRODUCTS_FALLBACK;
    const branch = getCurrentBranch();
    if (branch === 'all') {
      return data.filter(p => {
        const s = p.stock || {};
        return (s.bangil || 0) + (s.pandaan || 0) > 0 || data === PRODUCTS_FALLBACK;
      });
    }
    return data.filter(p => (p.stock?.[branch] || 0) > 0 || data === PRODUCTS_FALLBACK);
  },
});

// Fallback hardcoded data (used if products.json fails to load)
const PRODUCTS_FALLBACK = [
  // LIQUID / E-JUICE
  { id: 'l001', cat: 'liquid', name: 'Aurora Mango Salt Nic', brand: 'Aurora', desc: 'Mango tropis dengan sentuhan ice. Salt Nic 30mg, 30ml.', price: 110000, oldPrice: 130000, tag: 'hot', icon: '🥭' },
  { id: 'l002', cat: 'liquid', name: 'Sunset Strawberry Freebase', brand: 'Sunset', desc: 'Strawberry creamy, 60ml, 3mg. Smooth all day vape.', price: 145000, tag: 'new', icon: '🍓' },
  { id: 'l003', cat: 'liquid', name: 'Blackjack Cola Ice', brand: 'Blackjack', desc: 'Cola dingin segar dengan menthol kuat. 100ml.', price: 175000, icon: '🥤' },
  { id: 'l004', cat: 'liquid', name: 'Cloud Nine Yogurt Berry', brand: 'Cloud Nine', desc: 'Yogurt mixed berry, dessert vape favorit. 60ml.', price: 135000, oldPrice: 155000, tag: 'sale', icon: '🫐' },
  { id: 'l005', cat: 'liquid', name: 'Tobacco Gold Reserve', brand: 'Gold', desc: 'Classic tobacco premium dengan hint vanilla. 60ml.', price: 165000, icon: '🍂' },
  { id: 'l006', cat: 'liquid', name: 'Lychee Lemon Salt', brand: 'Fresh', desc: 'Lychee manis ketemu lemon asam. Salt Nic 35mg.', price: 105000, tag: 'new', icon: '🍋' },

  // DEVICE / MOD & POD
  { id: 'd001', cat: 'device', name: 'Voopoo Drag X2 Kit', brand: 'Voopoo', desc: 'Pod mod 80W, single battery, GENE.AI 2.0 chipset.', price: 685000, oldPrice: 750000, tag: 'hot', icon: '🔌' },
  { id: 'd002', cat: 'device', name: 'Vaporesso XROS 4 Pro', brand: 'Vaporesso', desc: 'Pod system premium dengan COREX heating technology.', price: 425000, tag: 'new', icon: '💨' },
  { id: 'd003', cat: 'device', name: 'GeekVape Aegis Legend 3', brand: 'GeekVape', desc: 'Dual 18650, 200W, IP68 waterproof. Tahan banting.', price: 895000, icon: '⚡' },
  { id: 'd004', cat: 'device', name: 'Lost Vape Centaurus M200', brand: 'Lost Vape', desc: 'Mod 200W premium dengan finishing kulit asli.', price: 1250000, tag: 'hot', icon: '🎯' },
  { id: 'd005', cat: 'device', name: 'OXVA Xlim Pro 2', brand: 'OXVA', desc: 'Pod compact, 1000mAh, top fill, adjustable wattage.', price: 385000, icon: '📦' },
  { id: 'd006', cat: 'device', name: 'SMOK Nord 5 Kit', brand: 'SMOK', desc: 'Pod system 80W dengan IQ-N chip, 2000mAh.', price: 545000, oldPrice: 620000, tag: 'sale', icon: '🌟' },

  // COIL & ATOMIZER
  { id: 'c001', cat: 'coil-wire', name: 'PnP TM2 Coil 0.2Ω', brand: 'Voopoo', desc: 'Mesh coil untuk Drag series, pack of 5.', price: 145000, icon: '🌀' },
  { id: 'c002', cat: 'coil-wire', name: 'GTX Mesh 0.2Ω', brand: 'Vaporesso', desc: 'Mesh coil 60-75W, flavor maksimal. Pack of 5.', price: 155000, tag: 'hot', icon: '🌀' },
  { id: 'c003', cat: 'atomizer', name: 'Hellvape Dead Rabbit V3 RDA', brand: 'Hellvape', desc: 'RDA 24mm, dual coil, BF pin included.', price: 385000, tag: 'new', icon: '🐇' },
  { id: 'c004', cat: 'atomizer', name: 'Wotofo Profile X RTA', brand: 'Wotofo', desc: 'RTA 25mm, mesh & coil compatible, 8ml capacity.', price: 525000, icon: '🔧' },
  { id: 'c005', cat: 'coil-wire', name: 'GeekVape M Coil 0.15Ω', brand: 'GeekVape', desc: 'Untuk Zeus tank, pack of 5. Long lasting flavor.', price: 165000, icon: '🌀' },
  { id: 'c006', cat: 'atomizer', name: 'Steam Crave Glaz Mini RTA', brand: 'Steam Crave', desc: 'RTA single coil 24mm dengan top airflow.', price: 425000, icon: '🔩' },

  // ACCESSORIES
  { id: 'a001', cat: 'battery-charger', name: 'Molicel P26A Battery 2600mAh', brand: 'Molicel', desc: 'Battery 18650 35A, original. 1 piece.', price: 95000, tag: 'hot', icon: '🔋' },
  { id: 'a002', cat: 'battery-charger', name: 'Xtar VC4 Charger', brand: 'Xtar', desc: 'Smart charger 4 slot dengan LCD display.', price: 285000, icon: '🔌' },
  { id: 'a003', cat: 'cartridge-cotton', name: 'Cotton Bacon Prime', brand: 'Wick \'N\' Vape', desc: 'Organic cotton premium untuk DIY coil.', price: 75000, oldPrice: 90000, tag: 'sale', icon: '☁️' },
  { id: 'a004', cat: 'accessories', name: '510 Drip Tip Resin Premium', brand: 'Generic', desc: 'Drip tip resin handmade, berbagai warna.', price: 45000, icon: '💧' },
  { id: 'a005', cat: 'accessories', name: 'Vape Case Carry Bag', brand: 'Coil Master', desc: 'Tas vape multipurpose, muat 2 device + liquid.', price: 165000, tag: 'new', icon: '👜' },
  { id: 'a006', cat: 'accessories', name: 'Ohm Reader Coil Master', brand: 'Coil Master', desc: '521 Tab Mini V3 untuk DIY building.', price: 245000, icon: '📏' }
];

// 7 kategori sesuai dengan kolom 'kategori' di Google Sheet
const CATEGORIES = [
  { id: 'liquid',           name: 'Liquid',             icon: '💧', desc: 'E-Juice & Salt Nic' },
  { id: 'device',           name: 'Device',             icon: '🔋', desc: 'Mod & Pod System' },
  { id: 'atomizer',         name: 'Atomizer',           icon: '🔧', desc: 'RDA, RTA & Tank' },
  { id: 'coil-wire',        name: 'Coil & Wire',        icon: '🌀', desc: 'Mesh, Coil, Wire' },
  { id: 'battery-charger',  name: 'Battery & Charger',  icon: '⚡', desc: 'Battery 18650 & Charger' },
  { id: 'cartridge-cotton', name: 'Cartridge & Cotton', icon: '🧵', desc: 'Refill & Cotton' },
  { id: 'accessories',      name: 'Accessories',        icon: '⚙️', desc: 'Drip Tip & Tools' }
];

const REWARDS = [
  { icon: '💧', name: 'Liquid 30ml Random', cost: 500 },
  { icon: '🎁', name: 'Voucher Rp 50.000', cost: 750 },
  { icon: '🌀', name: 'Coil Pack Mesh', cost: 1000 },
  { icon: '👕', name: 'T-Shirt Vapertize', cost: 1500 },
  { icon: '💨', name: 'Pod Device Starter', cost: 3500 },
  { icon: '⚡', name: 'Mod Premium', cost: 7500 }
];

// Helper
function formatRupiah(num) {
  return 'Rp ' + num.toLocaleString('id-ID');
}

// Normalize category field (sheet uses 'category', fallback uses 'cat')
function productCat(p) { return p.category || p.cat; }

function getProductsByCat(cat) {
  if (!cat || cat === 'all') return [...BUNDLES, ...PRODUCTS]; // bundles di depan
  if (cat === 'bundle') return [...BUNDLES];
  return PRODUCTS.filter(p => productCat(p) === cat);
}

function getProduct(id) {
  return PRODUCTS.find(p => p.id === id);
}

// Get product image src (uses cached image, falls back to category icon)
function getProductImage(p) {
  if (p.image) return p.image + '?v=1';
  return null; // signals UI to use emoji icon
}

// Helper: total stock across all branches
function productTotalStock(p) {
  if (p.stock) return (p.stock.bangil || 0) + (p.stock.pandaan || 0);
  return null; // unknown (fallback data)
}

// ============================================
// BUNDLE DEALS — paket hemat curated
// ============================================
const BUNDLES = [
  {
    id: 'bundle-starter',
    cat: 'bundle',
    name: 'Starter Kit Pemula',
    brand: 'Vapertize',
    desc: 'Paket lengkap pemula: Pod device + 1 botol liquid 60ml + extra coil.',
    price: 525000,
    oldPrice: 615000,
    tag: 'hot',
    icon: '🎁',
    bundleItems: ['Vaporesso XROS 4 Pod Device', 'Liquid Premium 60ml (pilih flavor)', '2x Replacement Coil', 'Lanyard + Cleaning Cloth']
  },
  {
    id: 'bundle-cloud',
    cat: 'bundle',
    name: 'Cloud Chaser Bundle',
    brand: 'Vapertize',
    desc: 'Untuk yang suka cloud besar: Mod 200W + RDA + battery + liquid.',
    price: 1485000,
    oldPrice: 1725000,
    tag: 'sale',
    icon: '☁️',
    bundleItems: ['GeekVape Aegis Legend 3 Mod', 'Dead Rabbit V3 RDA', 'Molicel P26A Battery (2pcs)', 'Liquid Freebase 100ml']
  },
  {
    id: 'bundle-flavor',
    cat: 'bundle',
    name: 'Flavor Hunter Pack',
    brand: 'Vapertize',
    desc: 'Eksplorasi rasa: 4 liquid premium beda flavor, salt + freebase.',
    price: 425000,
    oldPrice: 520000,
    tag: 'new',
    icon: '🍓',
    bundleItems: ['Lcv 60ml Tiramisu Freebase', 'Lcv 60ml Berry Cheesecake', 'Paradewa 60ml Apple Zeus', 'Dark Luna Salt Nic 30ml']
  },
  {
    id: 'bundle-maintenance',
    cat: 'bundle',
    name: 'Coil Master Kit',
    brand: 'Vapertize',
    desc: 'Untuk DIY enthusiast: tools, wire, cotton, ohm reader.',
    price: 395000,
    oldPrice: 475000,
    icon: '🔧',
    bundleItems: ['Coil Master 521 Tab Mini V3', 'Cotton Bacon Prime', 'Kanthal A1 Wire 24g', 'DIY Toolkit (tweezers, scissors, brush)']
  }
];

// ============================================
// WISHLIST — localStorage based, works for guests too
// ============================================
function getWishlist() {
  return JSON.parse(localStorage.getItem('vt_wishlist') || '[]');
}
function isInWishlist(id) {
  return getWishlist().includes(String(id));
}
function toggleWishlist(id) {
  id = String(id);
  const list = getWishlist();
  const idx = list.indexOf(id);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(id);
  localStorage.setItem('vt_wishlist', JSON.stringify(list));
  window.dispatchEvent(new CustomEvent('vt_wishlist_changed', { detail: { id, added: idx < 0 } }));
  return idx < 0; // true = added, false = removed
}
function getWishlistProducts() {
  const ids = getWishlist();
  const all = [...(PRODUCTS_DATA || PRODUCTS_FALLBACK), ...BUNDLES];
  return ids.map(id => all.find(p => String(p.id) === String(id))).filter(Boolean);
}

// ============================================
// DAILY CHECK-IN — gamification
// ============================================
function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function daysBetween(d1, d2) {
  const a = new Date(d1); a.setHours(0,0,0,0);
  const b = new Date(d2); b.setHours(0,0,0,0);
  return Math.round((b - a) / 86400000);
}
function checkinStatus(user) {
  if (!user) return { canCheckIn: false, streak: 0, lastDate: null };
  const today = todayDateStr();
  const last = user.lastCheckIn || null;
  const streak = user.streak || 0;
  if (last === today) return { canCheckIn: false, streak, lastDate: last, alreadyToday: true };
  return { canCheckIn: true, streak, lastDate: last };
}
function doDailyCheckIn() {
  const user = getCurrentUser();
  if (!user) return { ok: false, msg: 'Login dulu' };
  const today = todayDateStr();
  if (user.lastCheckIn === today) return { ok: false, msg: 'Sudah check-in hari ini' };

  // Calculate streak
  let newStreak = 1;
  if (user.lastCheckIn) {
    const gap = daysBetween(user.lastCheckIn, today);
    if (gap === 1) newStreak = (user.streak || 0) + 1;
    else if (gap === 0) newStreak = user.streak || 1; // shouldn't happen due to check above
    // else gap > 1 → reset to 1
  }

  // Calculate bonus
  let points = 5;
  let bonusMsg = '';
  if (newStreak === 7) { points += 50; bonusMsg = ' (🎉 Bonus 7-hari streak +50!)'; }
  else if (newStreak === 30) { points += 200; bonusMsg = ' (🏆 Bonus 30-hari streak +200!)'; }
  else if (newStreak > 0 && newStreak % 30 === 0) { points += 200; bonusMsg = ` (🏆 Bonus ${newStreak}-hari streak +200!)`; }

  const users = getUsers();
  const idx = users.findIndex(u => u.id === user.id);
  users[idx].points = (users[idx].points || 0) + points;
  users[idx].lastCheckIn = today;
  users[idx].streak = newStreak;
  users[idx].history = users[idx].history || [];
  users[idx].history.unshift({
    type: 'add',
    title: `Check-in harian (streak ${newStreak} hari)${bonusMsg}`,
    date: new Date().toISOString(),
    points
  });
  saveUsers(users);
  return { ok: true, points, streak: newStreak, bonusMsg };
}

// ============================================
// BIRTHDAY DISCOUNT — auto bonus poin di hari ulang tahun
// ============================================
function checkBirthdayBonus() {
  const user = getCurrentUser();
  if (!user || !user.birthday) return null;
  const today = new Date();
  const todayMD = `${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const bdMD = user.birthday.substring(5); // YYYY-MM-DD → MM-DD
  if (todayMD !== bdMD) return null;

  const thisYear = String(today.getFullYear());
  if (user.lastBirthdayBonus === thisYear) return null; // already given

  const users = getUsers();
  const idx = users.findIndex(u => u.id === user.id);
  const BONUS = 200;
  users[idx].points = (users[idx].points || 0) + BONUS;
  users[idx].lastBirthdayBonus = thisYear;
  users[idx].history = users[idx].history || [];
  users[idx].history.unshift({
    type: 'add',
    title: `🎂 Bonus ulang tahun! Happy birthday`,
    date: new Date().toISOString(),
    points: BONUS
  });
  saveUsers(users);
  return { points: BONUS };
}

// ============================================
// RECENTLY SOLD TICKER — curated social proof
// Names + cities di Pasuruan & sekitarnya (real-ish)
// ============================================
const RECENT_BUYERS = [
  { name: 'Adit', city: 'Sidoarjo' },     { name: 'Rina', city: 'Bangil' },
  { name: 'Bayu', city: 'Pandaan' },      { name: 'Sari', city: 'Malang' },
  { name: 'Doni', city: 'Pasuruan' },     { name: 'Maya', city: 'Surabaya' },
  { name: 'Fajar', city: 'Probolinggo' }, { name: 'Tia', city: 'Bangil' },
  { name: 'Reza', city: 'Pandaan' },      { name: 'Lila', city: 'Sidoarjo' },
  { name: 'Hendra', city: 'Malang' },     { name: 'Vina', city: 'Surabaya' },
  { name: 'Wahyu', city: 'Pasuruan' },    { name: 'Nadia', city: 'Bangil' },
  { name: 'Yoga', city: 'Pandaan' }
];

function generateRecentSale() {
  const all = [...(PRODUCTS_DATA || PRODUCTS_FALLBACK)].filter(p => (p.stock?.bangil || 0) + (p.stock?.pandaan || 0) > 0);
  if (all.length === 0) return null;
  const buyer = RECENT_BUYERS[Math.floor(Math.random() * RECENT_BUYERS.length)];
  const product = all[Math.floor(Math.random() * all.length)];
  const minutesAgo = Math.floor(Math.random() * 45) + 2; // 2-46 minutes
  return { buyer, product, minutesAgo };
}

// Initialize products on page load — fire-and-forget
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    loadProducts().then(() => {
      // Re-trigger pageInit if defined (so newly loaded products render)
      if (typeof pageInit === 'function' && PRODUCTS_DATA && PRODUCTS_DATA !== PRODUCTS_FALLBACK) {
        try { pageInit(); } catch (e) { console.warn('pageInit re-run failed:', e); }
      }
    });
  });
}

// ============================================
// PROMOS (slideshow di home) — sumber: /promos.json
// Admin page nanti akan CRUD ke file ini.
// ============================================
const PROMOS_FALLBACK = [
  {
    id: 'fallback-1',
    title: 'Authentic & Premium',
    subtitle: 'Semua produk Vapertize 100% original dengan garansi distributor resmi.',
    image: '/assets/img/promos/promo-authentic.jpg',
    ctaText: 'Lihat Katalog',
    ctaUrl: '/catalog.html',
    badge: 'AUTHENTIC',
    active: true
  }
];

let PROMOS_DATA = null;
async function loadPromos() {
  if (PROMOS_DATA) return PROMOS_DATA;
  try {
    const r = await fetch('/promos.json?v=' + Date.now(), { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const json = await r.json();
    const list = Array.isArray(json.promos) ? json.promos : [];
    PROMOS_DATA = list.filter(p => p && p.active !== false);
    if (PROMOS_DATA.length === 0) PROMOS_DATA = PROMOS_FALLBACK;
    return PROMOS_DATA;
  } catch (e) {
    console.warn('[Vapertize] Failed to load promos.json, using fallback:', e);
    PROMOS_DATA = PROMOS_FALLBACK;
    return PROMOS_DATA;
  }
}
if (typeof window !== 'undefined') window.loadPromos = loadPromos;
