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
    PRODUCTS_META = { total: PRODUCTS_FALLBACK.length, categories: ['liquid','device','coil','access'], branches: ['bangil','pandaan'], source: 'fallback' };
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
  { id: 'c001', cat: 'coil', name: 'PnP TM2 Coil 0.2Ω', brand: 'Voopoo', desc: 'Mesh coil untuk Drag series, pack of 5.', price: 145000, icon: '🌀' },
  { id: 'c002', cat: 'coil', name: 'GTX Mesh 0.2Ω', brand: 'Vaporesso', desc: 'Mesh coil 60-75W, flavor maksimal. Pack of 5.', price: 155000, tag: 'hot', icon: '🌀' },
  { id: 'c003', cat: 'coil', name: 'Hellvape Dead Rabbit V3 RDA', brand: 'Hellvape', desc: 'RDA 24mm, dual coil, BF pin included.', price: 385000, tag: 'new', icon: '🐇' },
  { id: 'c004', cat: 'coil', name: 'Wotofo Profile X RTA', brand: 'Wotofo', desc: 'RTA 25mm, mesh & coil compatible, 8ml capacity.', price: 525000, icon: '🔧' },
  { id: 'c005', cat: 'coil', name: 'GeekVape M Coil 0.15Ω', brand: 'GeekVape', desc: 'Untuk Zeus tank, pack of 5. Long lasting flavor.', price: 165000, icon: '🌀' },
  { id: 'c006', cat: 'coil', name: 'Steam Crave Glaz Mini RTA', brand: 'Steam Crave', desc: 'RTA single coil 24mm dengan top airflow.', price: 425000, icon: '🔩' },

  // ACCESSORIES
  { id: 'a001', cat: 'access', name: 'Molicel P26A Battery 2600mAh', brand: 'Molicel', desc: 'Battery 18650 35A, original. 1 piece.', price: 95000, tag: 'hot', icon: '🔋' },
  { id: 'a002', cat: 'access', name: 'Xtar VC4 Charger', brand: 'Xtar', desc: 'Smart charger 4 slot dengan LCD display.', price: 285000, icon: '🔌' },
  { id: 'a003', cat: 'access', name: 'Cotton Bacon Prime', brand: 'Wick \'N\' Vape', desc: 'Organic cotton premium untuk DIY coil.', price: 75000, oldPrice: 90000, tag: 'sale', icon: '☁️' },
  { id: 'a004', cat: 'access', name: '510 Drip Tip Resin Premium', brand: 'Generic', desc: 'Drip tip resin handmade, berbagai warna.', price: 45000, icon: '💧' },
  { id: 'a005', cat: 'access', name: 'Vape Case Carry Bag', brand: 'Coil Master', desc: 'Tas vape multipurpose, muat 2 device + liquid.', price: 165000, tag: 'new', icon: '👜' },
  { id: 'a006', cat: 'access', name: 'Ohm Reader Coil Master', brand: 'Coil Master', desc: '521 Tab Mini V3 untuk DIY building.', price: 245000, icon: '📏' }
];

const CATEGORIES = [
  { id: 'liquid', name: 'Liquid', icon: '💧', desc: 'E-Juice & Salt Nic' },
  { id: 'device', name: 'Device', icon: '🔋', desc: 'Mod & Pod System' },
  { id: 'coil', name: 'Coil', icon: '🌀', desc: 'Coil, RDA & RTA' },
  { id: 'access', name: 'Accessories', icon: '⚙️', desc: 'Battery & Tools' }
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
  if (!cat || cat === 'all') return PRODUCTS;
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
