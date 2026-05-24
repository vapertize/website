// ============================================
// VAPERTIZE - Main App Logic
// ============================================

const STORE_INFO = {
  name: 'Vapertize',
  tagline: 'Authentic & Premium Vape Store',
  email: 'store@vapertize.com',
  hours: '08.00 - 22.00 WIB',
  instagram: 'https://instagram.com/vapertize',
  facebook: 'https://facebook.com/vapertize.id',

  // WhatsApp channels (format internasional tanpa + dan 0)
  whatsapp: {
    aiRisa:      '628137000110',   // AI chatbot — default untuk konsultasi cepat 24/7
    distributor: '628137000125',   // B2B, reseller, dropship, grosir
    bangil:      '628137000145',   // Toko retail Bangil
    pandaan:     '628137000165'    // Toko retail Pandaan
  },

  // Display formats
  phone: {
    aiRisa:      '+62 813-7000-0110',
    distributor: '+62 813-7000-0125',
    bangil:      '+62 813-7000-0145',
    pandaan:     '+62 813-7000-0165'
  },

  // Default chat untuk tombol generic ("Chat Konsultasi", checkout)
  defaultWA: '628137000110',  // AI Risa (instant response 24/7)

  stores: [
    { name: 'Vapertize Bangil', address: 'Jl. Raya Bangil, Pasuruan, Jawa Timur', phone: '+62 813-7000-0145', whatsapp: '628137000145', mapQuery: 'Vapertize+Bangil+Pasuruan' },
    { name: 'Vapertize Pandaan', address: 'Jl. Raya Pandaan, Pasuruan, Jawa Timur', phone: '+62 813-7000-0165', whatsapp: '628137000165', mapQuery: 'Vapertize+Pandaan+Pasuruan' }
  ]
};

// Helper: build WhatsApp URL
function waUrl(channel = 'aiRisa', message = '') {
  const number = STORE_INFO.whatsapp[channel] || STORE_INFO.defaultWA;
  const url = `https://wa.me/${number}`;
  return message ? `${url}?text=${encodeURIComponent(message)}` : url;
}

// Helper: pick the best WA channel for ordering a specific product
// based on current branch selection + stock availability.
// Returns { channel: 'bangil'|'pandaan'|'aiRisa', label: 'Vapertize Bangil'|... }
function pickWAChannel(product) {
  const branch = (typeof getCurrentBranch === 'function') ? getCurrentBranch() : 'all';
  if (branch === 'bangil')  return { channel: 'bangil',  label: 'Vapertize Bangil' };
  if (branch === 'pandaan') return { channel: 'pandaan', label: 'Vapertize Pandaan' };

  // branch === 'all': smart routing by stock
  const sB = product?.stock?.bangil  || 0;
  const sP = product?.stock?.pandaan || 0;
  if (sB > 0 && sP === 0) return { channel: 'bangil',  label: 'Vapertize Bangil' };
  if (sP > 0 && sB === 0) return { channel: 'pandaan', label: 'Vapertize Pandaan' };
  // both stock OR both habis → CS umum
  return { channel: 'aiRisa', label: 'Vapertize' };
}

// Helper: pick the best WA channel for cart checkout
// (cart can mix products from multiple branches)
function pickWAChannelForCart(cart) {
  const branch = (typeof getCurrentBranch === 'function') ? getCurrentBranch() : 'all';
  if (branch === 'bangil')  return { channel: 'bangil',  label: 'Vapertize Bangil' };
  if (branch === 'pandaan') return { channel: 'pandaan', label: 'Vapertize Pandaan' };

  // branch === 'all': check if every item is only available at one branch
  let onlyBangil = true, onlyPandaan = true;
  for (const item of cart) {
    const p = (typeof getProduct === 'function') ? getProduct(item.id) : null;
    if (!p) continue;
    const sB = p.stock?.bangil  || 0;
    const sP = p.stock?.pandaan || 0;
    if (sB === 0) onlyBangil = false;
    if (sP === 0) onlyPandaan = false;
  }
  if (onlyBangil && !onlyPandaan)  return { channel: 'bangil',  label: 'Vapertize Bangil' };
  if (onlyPandaan && !onlyBangil)  return { channel: 'pandaan', label: 'Vapertize Pandaan' };
  return { channel: 'aiRisa', label: 'Vapertize' };
}

// ============================================
// AGE GATE
// ============================================
function initAgeGate() {
  if (localStorage.getItem('vt_age_verified') === 'true') return;
  const gate = document.createElement('div');
  gate.className = 'age-gate';
  gate.innerHTML = `
    <div class="age-gate-card">
      <div class="logo-mark"><picture><source srcset="assets/img/logo-128.webp?v=5" type="image/webp"><img src="assets/img/logo-128.png?v=5" alt="Vapertize Logo - Premium Vape Store" width="40" height="40"></picture></div>
      <h2>Verifikasi Usia</h2>
      <p>Produk vape hanya untuk usia <strong style="color:var(--accent)">21+ tahun</strong>. Dengan masuk ke website ini Anda menyatakan telah berusia 21 tahun atau lebih.</p>
      <div class="age-gate-actions">
        <button class="btn btn-secondary" onclick="rejectAge()">Belum 21</button>
        <button class="btn btn-primary" onclick="acceptAge()">Saya 21+</button>
      </div>
    </div>
  `;
  document.body.appendChild(gate);
}

function acceptAge() {
  localStorage.setItem('vt_age_verified', 'true');
  document.querySelector('.age-gate')?.remove();
}

function rejectAge() {
  window.location.href = 'https://www.google.com';
}

// ============================================
// CART
// ============================================
function getCart() {
  return JSON.parse(localStorage.getItem('vt_cart') || '[]');
}

function saveCart(cart) {
  localStorage.setItem('vt_cart', JSON.stringify(cart));
  updateCartBadge();
}

function addToCart(productId) {
  const cart = getCart();
  const existing = cart.find(i => i.id === productId);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id: productId, qty: 1 });
  }
  saveCart(cart);
  const p = getProduct(productId);
  showToast(`✓ ${p.name} ditambahkan`, 'success');
}

function removeFromCart(productId) {
  saveCart(getCart().filter(i => i.id !== productId));
  renderCart();
}

function updateQty(productId, delta) {
  const cart = getCart();
  const item = cart.find(i => i.id === productId);
  if (!item) return;
  item.qty += delta;
  if (item.qty < 1) item.qty = 1;
  saveCart(cart);
  renderCart();
}

function updateCartBadge() {
  const total = getCart().reduce((s, i) => s + i.qty, 0);
  document.querySelectorAll('.cart-badge').forEach(el => {
    el.textContent = total;
    el.style.display = total > 0 ? 'flex' : 'none';
  });
}

function cartTotal() {
  return getCart().reduce((sum, item) => {
    const p = getProduct(item.id);
    return sum + (p ? p.price * item.qty : 0);
  }, 0);
}

function openCart() {
  renderCart();
  document.getElementById('cartModal').classList.add('active');
}

function closeCart() {
  document.getElementById('cartModal').classList.remove('active');
}

function renderCart() {
  const cart = getCart();
  const body = document.getElementById('cartBody');
  const footer = document.getElementById('cartFooter');
  if (!body) return;

  if (cart.length === 0) {
    body.innerHTML = `
      <div class="empty-state">
        <div class="icon">🛒</div>
        <p>Keranjang masih kosong</p>
        <a href="catalog.html" class="btn btn-primary" style="margin-top:20px">Belanja Sekarang</a>
      </div>
    `;
    footer.innerHTML = '';
    return;
  }

  body.innerHTML = cart.map(item => {
    const p = getProduct(item.id);
    if (!p) return '';
    return `
      <div class="cart-item">
        <div class="cart-item-img">${p.icon}</div>
        <div class="cart-item-info">
          <div class="cart-item-name">${p.name}</div>
          <div class="cart-item-price">${formatRupiah(p.price)}</div>
          <div class="cart-item-actions">
            <button class="qty-btn" onclick="updateQty('${p.id}', -1)">−</button>
            <span class="qty-display">${item.qty}</span>
            <button class="qty-btn" onclick="updateQty('${p.id}', 1)">+</button>
            <button class="remove-btn" onclick="removeFromCart('${p.id}')" title="Hapus">🗑</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const total = cartTotal();
  footer.innerHTML = `
    <div class="cart-summary">
      <div class="cart-row"><span>Subtotal (${cart.reduce((s,i)=>s+i.qty,0)} item)</span><span>${formatRupiah(total)}</span></div>
      <div class="cart-row"><span>Ongkir</span><span style="color:var(--success)">Konfirmasi via WA</span></div>
      <div class="cart-row total"><span>TOTAL</span><span class="val">${formatRupiah(total)}</span></div>
    </div>
    <button class="btn btn-whatsapp btn-block btn-lg" onclick="checkoutWA()">
      💬 Checkout via WhatsApp
    </button>
  `;
}

function checkoutWA() {
  const cart = getCart();
  if (cart.length === 0) return;

  const { channel, label } = pickWAChannelForCart(cart);
  let msg = `*🛒 ORDER VAPERTIZE*\n\n`;
  msg += `Halo admin ${label}, saya mau order:\n\n`;
  cart.forEach((item, i) => {
    const p = getProduct(item.id);
    if (!p) return;
    msg += `${i + 1}. *${p.name}*\n`;
    msg += `   ${item.qty} x ${formatRupiah(p.price)} = ${formatRupiah(p.price * item.qty)}\n\n`;
  });
  msg += `*TOTAL: ${formatRupiah(cartTotal())}*\n\n`;

  // Tambahkan info member jika login
  const user = getCurrentUser();
  if (user) {
    msg += `_Member: ${user.name} (${user.email})_\n`;
    msg += `_Poin saat ini: ${user.points || 0}_\n\n`;
  }
  msg += `Mohon konfirmasi ketersediaan & ongkir ke alamat saya. Terima kasih!`;

  window.open(waUrl(channel, msg), '_blank');
}

function orderProductWA(productId) {
  const p = getProduct(productId);
  if (!p) return;
  const { channel, label } = pickWAChannel(p);
  const msg = `Halo ${label}, saya tertarik dengan produk *${p.name}* (${formatRupiah(p.price)}). Apakah masih tersedia?`;
  window.open(waUrl(channel, msg), '_blank');
}

// ============================================
// MEMBER / AUTH
// ============================================
function getUsers() {
  return JSON.parse(localStorage.getItem('vt_users') || '[]');
}

function saveUsers(users) {
  localStorage.setItem('vt_users', JSON.stringify(users));
}

function getCurrentUser() {
  const id = localStorage.getItem('vt_current_user');
  if (!id) return null;
  return getUsers().find(u => u.id === id);
}

function setCurrentUser(id) {
  localStorage.setItem('vt_current_user', id);
}

function logout() {
  localStorage.removeItem('vt_current_user');
  window.location.href = 'member.html';
}

function registerUser(name, email, phone, password) {
  const users = getUsers();
  if (users.find(u => u.email === email)) {
    return { ok: false, msg: 'Email sudah terdaftar' };
  }
  const user = {
    id: 'u' + Date.now(),
    name, email, phone, password,
    points: 100, // bonus poin pendaftaran
    tier: 'Bronze',
    joinDate: new Date().toISOString(),
    history: [
      { type: 'add', title: 'Bonus pendaftaran member', date: new Date().toISOString(), points: 100 }
    ]
  };
  users.push(user);
  saveUsers(users);
  setCurrentUser(user.id);
  return { ok: true, user };
}

function loginUser(email, password) {
  const user = getUsers().find(u => u.email === email && u.password === password);
  if (!user) return { ok: false, msg: 'Email atau password salah' };
  setCurrentUser(user.id);
  return { ok: true, user };
}

function getUserTier(points) {
  if (points >= 5000) return 'Diamond';
  if (points >= 2000) return 'Platinum';
  if (points >= 1000) return 'Gold';
  if (points >= 500) return 'Silver';
  return 'Bronze';
}

// ============================================
// TOAST
// ============================================
function showToast(message, type = 'success') {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ============================================
// NAVBAR
// ============================================
function buildNavbar(activePage = '') {
  const user = getCurrentUser();
  return `
    <nav class="navbar">
      <div class="nav-inner">
        <a href="index.html" class="logo">
          <div class="logo-mark"><picture><source srcset="assets/img/logo-128.webp?v=5" type="image/webp"><img src="assets/img/logo-128.png?v=5" alt="Vapertize Logo - Premium Vape Store" width="40" height="40"></picture></div>
          <span>Vapertize</span>
        </a>
        <ul class="nav-links" id="navLinks">
          <li><a href="index.html" class="${activePage === 'home' ? 'active' : ''}">Home</a></li>
          <li><a href="catalog.html" class="${activePage === 'catalog' ? 'active' : ''}">Katalog</a></li>
          <li><a href="member.html" class="${activePage === 'member' ? 'active' : ''}">Member</a></li>
          <li><a href="faq.html" class="${activePage === 'faq' ? 'active' : ''}">FAQ</a></li>
          <li><a href="contact.html" class="${activePage === 'contact' ? 'active' : ''}">Kontak</a></li>
        </ul>
        <div class="nav-actions">
          <button class="icon-btn" onclick="openCart()" title="Keranjang">
            🛒
            <span class="cart-badge">0</span>
          </button>
          <a href="member.html" class="icon-btn" title="${user ? user.name : 'Login'}">
            ${user ? user.name.charAt(0).toUpperCase() : '👤'}
          </a>
          <button class="mobile-toggle" onclick="document.getElementById('navLinks').classList.toggle('active')">☰</button>
        </div>
      </div>
    </nav>
  `;
}

function buildFooter() {
  return `
    <footer class="footer">
      <div class="container">
        <div class="footer-grid">
          <div class="footer-brand">
            <a href="index.html" class="logo">
              <div class="logo-mark"><picture><source srcset="assets/img/logo-128.webp?v=5" type="image/webp"><img src="assets/img/logo-128.png?v=5" alt="Vapertize Logo - Premium Vape Store" width="40" height="40"></picture></div>
              <span>Vapertize</span>
            </a>
            <p>${STORE_INFO.tagline}. Toko vape terpercaya dengan produk 100% authentic di Bangil & Pandaan, Pasuruan.</p>
            <div class="social-links">
              <a href="${STORE_INFO.instagram}" class="social-link" target="_blank">📷</a>
              <a href="${STORE_INFO.facebook}" class="social-link" target="_blank">f</a>
              <a href="https://wa.me/${STORE_INFO.defaultWA}" class="social-link" target="_blank">💬</a>
            </div>
          </div>
          <div>
            <h4>Belanja</h4>
            <ul>
              <li><a href="catalog.html?cat=liquid">Liquid</a></li>
              <li><a href="catalog.html?cat=device">Device</a></li>
              <li><a href="catalog.html?cat=atomizer">Atomizer</a></li>
              <li><a href="catalog.html?cat=coil-wire">Coil &amp; Wire</a></li>
              <li><a href="catalog.html?cat=battery-charger">Battery &amp; Charger</a></li>
              <li><a href="catalog.html?cat=cartridge-cotton">Cartridge &amp; Cotton</a></li>
              <li><a href="catalog.html?cat=accessories">Accessories</a></li>
            </ul>
          </div>
          <div>
            <h4>Akun</h4>
            <ul>
              <li><a href="member.html">Login / Daftar</a></li>
              <li><a href="member.html">Cek Poin</a></li>
              <li><a href="member.html">Riwayat Order</a></li>
              <li><a href="member.html">Reward</a></li>
            </ul>
          </div>
          <div>
            <h4>Bantuan</h4>
            <ul>
              <li><a href="contact.html">Kontak Kami</a></li>
              <li><a href="contact.html">Lokasi Toko</a></li>
              <li><a href="https://wa.me/${STORE_INFO.defaultWA}" target="_blank">WhatsApp</a></li>
              <li><a href="faq.html">FAQ</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© ${new Date().getFullYear()} Vapertize. All rights reserved.</span>
          <span class="age-warning">⚠ 21+ Only</span>
        </div>
      </div>
    </footer>
  `;
}

function buildCartModal() {
  return `
    <div class="modal-overlay" id="cartModal">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">🛒 Keranjang Belanja</span>
          <button class="modal-close" onclick="closeCart()">✕</button>
        </div>
        <div class="modal-body" id="cartBody"></div>
        <div class="modal-footer" id="cartFooter"></div>
      </div>
    </div>
  `;
}

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  initAgeGate();

  // Build navbar
  const navbar = document.getElementById('navbarSlot');
  if (navbar) {
    navbar.outerHTML = buildNavbar(navbar.dataset.page || '');
  }

  // Build footer
  const footer = document.getElementById('footerSlot');
  if (footer) footer.outerHTML = buildFooter();

  // Build cart modal
  const cart = document.getElementById('cartSlot');
  if (cart) cart.outerHTML = buildCartModal();

  updateCartBadge();

  // Click outside cart to close
  document.getElementById('cartModal')?.addEventListener('click', e => {
    if (e.target.id === 'cartModal') closeCart();
  });

  // Run page-specific init
  if (typeof pageInit === 'function') pageInit();
});
