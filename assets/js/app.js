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
    aiRisa:      '+62 813-7000-110',
    distributor: '+62 813-7000-125',
    bangil:      '+62 813-7000-145',
    pandaan:     '+62 813-7000-165'
  },

  // Default chat untuk tombol generic ("Chat Konsultasi", checkout)
  defaultWA: '628137000110',  // AI Risa (instant response 24/7)

  stores: [
    { name: 'Vapertize Bangil',  address: 'Ruko Hotel Amanah, Jl. Alun-Alun Tim. No.11, Wetanalon, Kersikan, Kec. Bangil, Pasuruan, Jawa Timur 67153', phone: '+62 813-7000-145', whatsapp: '628137000145', mapQuery: 'Vapertize+Bangil+Pasuruan' },
    { name: 'Vapertize Pandaan', address: 'Jl. Pahlawan Sunaryo No.38, RT.02/RW.06, Wringinanom, Jogosari, Kec. Pandaan, Pasuruan, Jawa Timur 67156',   phone: '+62 813-7000-165', whatsapp: '628137000165', mapQuery: 'Vapertize+Pandaan+Pasuruan' }
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
      <div class="logo-mark"><picture><source srcset="/assets/img/logo-128.webp?v=5" type="image/webp"><img src="/assets/img/logo-128.png?v=5" alt="Vapertize Logo - Premium Vape Store" width="40" height="40"></picture></div>
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
        <div class="cart-item-img">${p.image
          ? `<img src="${p.image}" alt="${p.name}" style="width:100%;height:100%;object-fit:contain;padding:6px">`
          : `<img src="/assets/img/icons/${(p.category || p.cat || 'accessories')}.png?v=1" alt="" style="width:70%;height:70%;object-fit:contain;margin:auto;display:block;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.4))">`}</div>
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
  // Tier names match Vapertize Loyalty Club (5 tier cashback redemption).
  // Display-only — actual cashback values, min purchase, & redemption rules are internal (POS-side).
  if (points >= 2000) return 'VAPE GOD';
  if (points >= 1500) return 'LEGEND';
  if (points >= 1000) return 'IGNITE';
  if (points >= 500)  return 'BOOST';
  return 'SPARK';
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
        <a href="/index.html" class="logo">
          <div class="logo-mark"><picture><source srcset="/assets/img/logo-128.webp?v=5" type="image/webp"><img src="/assets/img/logo-128.png?v=5" alt="Vapertize Logo - Premium Vape Store" width="40" height="40"></picture></div>
          <span>Vapertize</span>
        </a>
        <ul class="nav-links" id="navLinks">
          <li><a href="/index.html" class="${activePage === 'home' ? 'active' : ''}">Home</a></li>
          <li><a href="/catalog.html" class="${activePage === 'catalog' ? 'active' : ''}">Katalog</a></li>
          <li><a href="/member.html" class="${activePage === 'member' ? 'active' : ''}">Member</a></li>
          <li><a href="/blog/" class="${activePage === 'blog' ? 'active' : ''}">Blog</a></li>
          <li><a href="/faq.html" class="${activePage === 'faq' ? 'active' : ''}">FAQ</a></li>
          <li><a href="/contact.html" class="${activePage === 'contact' ? 'active' : ''}">Kontak</a></li>
        </ul>
        <div class="nav-actions">
          <button class="icon-btn" onclick="openCart()" title="Keranjang">
            🛒
            <span class="cart-badge">0</span>
          </button>
          <a href="member.html" class="icon-btn icon-btn-profile" title="${user ? user.name : 'Login'}">
            ${user
              ? `<span class="profile-initial">${user.name.charAt(0).toUpperCase()}</span>`
              : `<img src="/assets/img/icons/profile.png?v=1" alt="Login" width="36" height="36" class="profile-img">`}
          </a>
          <button class="mobile-toggle" onclick="document.getElementById('navLinks').classList.toggle('active')" aria-label="Toggle menu">☰</button>
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
            <a href="/index.html" class="logo">
              <div class="logo-mark"><picture><source srcset="/assets/img/logo-128.webp?v=5" type="image/webp"><img src="/assets/img/logo-128.png?v=5" alt="Vapertize Logo - Premium Vape Store" width="40" height="40"></picture></div>
              <span>Vapertize</span>
            </a>
            <p>${STORE_INFO.tagline}. Toko vape terpercaya dengan produk <strong>100% authentic &amp; legal berpita cukai</strong> di Bangil &amp; Pandaan, Pasuruan.</p>
            <div class="social-links">
              <a href="${STORE_INFO.instagram}" class="social-link social-ig" target="_blank" rel="noopener" aria-label="Instagram Vapertize">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.42.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.42 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.42 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.42-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.42-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.42-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.42-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.42C8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.31-1.46.72-2.13 1.39C1.35 2.68.94 3.35.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.79.72 1.46 1.39 2.13.67.67 1.34 1.08 2.13 1.39.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.79-.31 1.46-.72 2.13-1.39.67-.67 1.08-1.34 1.39-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91-.31-.79-.72-1.46-1.39-2.13C21.32 1.35 20.65.94 19.86.63 19.1.33 18.22.13 16.95.07 15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84zM12 16a4 4 0 1 1 4-4 4 4 0 0 1-4 4zm6.41-11.85a1.44 1.44 0 1 0 1.44 1.44 1.44 1.44 0 0 0-1.44-1.44z"/></svg>
              </a>
              <a href="${STORE_INFO.facebook}" class="social-link social-fb" target="_blank" rel="noopener" aria-label="Facebook Vapertize">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07z"/></svg>
              </a>
              <a href="https://wa.me/${STORE_INFO.defaultWA}" class="social-link social-wa" target="_blank" rel="noopener" aria-label="WhatsApp Vapertize">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.21-.24-.58-.49-.5-.67-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.87 1.21 3.07.15.2 2.1 3.2 5.07 4.49.71.31 1.26.49 1.69.63.71.23 1.35.19 1.86.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.04 21.79h-.01a9.84 9.84 0 0 1-5.01-1.37l-.36-.21-3.72.97 1-3.63-.23-.37a9.83 9.83 0 0 1-1.5-5.22c0-5.43 4.42-9.85 9.85-9.85 2.63 0 5.1 1.03 6.96 2.88a9.81 9.81 0 0 1 2.88 6.97c0 5.43-4.42 9.85-9.86 9.85m8.39-18.24A11.81 11.81 0 0 0 12.04 0C5.46 0 .1 5.35.1 11.93c0 2.1.55 4.16 1.6 5.97L0 24l6.25-1.64a11.93 11.93 0 0 0 5.79 1.48h.01c6.58 0 11.93-5.35 11.93-11.93 0-3.19-1.24-6.18-3.5-8.44"/></svg>
              </a>
            </div>
          </div>
          <div>
            <h4>Belanja</h4>
            <ul>
              <li><a href="/catalog.html?cat=bundle">📦 Paket Hemat</a></li>
              <li><a href="/catalog.html?cat=liquid">Liquid</a></li>
              <li><a href="/catalog.html?cat=device">Device</a></li>
              <li><a href="/catalog.html?cat=atomizer">Atomizer</a></li>
              <li><a href="/catalog.html?cat=coil-wire">Coil &amp; Wire</a></li>
              <li><a href="/catalog.html?cat=battery-charger">Battery &amp; Charger</a></li>
              <li><a href="/catalog.html?cat=cartridge-cotton">Cartridge &amp; Cotton</a></li>
              <li><a href="/catalog.html?cat=accessories">Accessories</a></li>
            </ul>
          </div>
          <div>
            <h4>Akun</h4>
            <ul>
              <li><a href="/member.html">Login / Daftar</a></li>
              <li><a href="/member.html">Cek Poin</a></li>
              <li><a href="/member.html">Riwayat Order</a></li>
              <li><a href="/member.html">Reward</a></li>
            </ul>
          </div>
          <div>
            <h4>Bantuan</h4>
            <ul>
              <li><a href="/contact.html">Kontak Kami</a></li>
              <li><a href="/contact.html">Lokasi Toko</a></li>
              <li><a href="https://wa.me/${STORE_INFO.defaultWA}" target="_blank">WhatsApp</a></li>
              <li><a href="/faq.html">FAQ</a></li>
              <li><a href="/blog/">Blog & Tips</a></li>
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

  // ============================================
  // PWA — Service worker registration + install prompt
  // ============================================
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  let deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    // Show install button on body
    if (!document.querySelector('.pwa-install-btn') && !localStorage.getItem('vt_pwa_dismissed')) {
      const btn = document.createElement('button');
      btn.className = 'pwa-install-btn';
      btn.innerHTML = '<span class="pwa-install-icon">📱</span><span class="pwa-install-text">Install App Vapertize</span><span class="pwa-install-close" title="Dismiss">×</span>';
      btn.addEventListener('click', async e => {
        if (e.target.classList.contains('pwa-install-close')) {
          localStorage.setItem('vt_pwa_dismissed', '1');
          btn.remove();
          return;
        }
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          showToast('Vapertize berhasil di-install! 🎉', 'success');
        }
        deferredInstallPrompt = null;
        btn.remove();
      });
      document.body.appendChild(btn);
    }
  });
  window.addEventListener('appinstalled', () => {
    document.querySelector('.pwa-install-btn')?.remove();
  });

  // ============================================
  // Floating WA Quick Chat button (semua halaman)
  // ============================================
  if (!document.querySelector('.wa-float-btn')) {
    const waBtn = document.createElement('a');
    waBtn.className = 'wa-float-btn';
    waBtn.href = `https://wa.me/${STORE_INFO.defaultWA}?text=${encodeURIComponent('Halo Risa, saya mau tanya tentang produk Vapertize')}`;
    waBtn.target = '_blank';
    waBtn.rel = 'noopener';
    waBtn.setAttribute('aria-label', 'Chat AI Risa di WhatsApp');
    waBtn.innerHTML = `
      <span class="wa-float-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.21-.24-.58-.49-.5-.67-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.87 1.21 3.07.15.2 2.1 3.2 5.07 4.49.71.31 1.26.49 1.69.63.71.23 1.35.19 1.86.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.04 21.79h-.01a9.84 9.84 0 0 1-5.01-1.37l-.36-.21-3.72.97 1-3.63-.23-.37a9.83 9.83 0 0 1-1.5-5.22c0-5.43 4.42-9.85 9.85-9.85 2.63 0 5.1 1.03 6.96 2.88a9.81 9.81 0 0 1 2.88 6.97c0 5.43-4.42 9.85-9.86 9.85m8.39-18.24A11.81 11.81 0 0 0 12.04 0C5.46 0 .1 5.35.1 11.93c0 2.1.55 4.16 1.6 5.97L0 24l6.25-1.64a11.93 11.93 0 0 0 5.79 1.48h.01c6.58 0 11.93-5.35 11.93-11.93 0-3.19-1.24-6.18-3.5-8.44"/></svg>
      </span>
      <span class="wa-float-text">Chat Risa</span>
      <span class="wa-float-pulse"></span>
    `;
    document.body.appendChild(waBtn);
  }

  // ============================================
  // Recently Sold Ticker (social proof, except member/auth pages)
  // ============================================
  const page = document.querySelector('[data-page]')?.dataset.page || '';
  const showTicker = !['member'].includes(page) && !sessionStorage.getItem('vt_ticker_closed');
  if (showTicker) startRecentlySoldTicker();

  // ============================================
  // Promo Slideshow (kalau ada section di halaman)
  // ============================================
  if (document.querySelector('#promoSlideshow')) {
    initPromoSlider();
  }

  // Run page-specific init
  if (typeof pageInit === 'function') pageInit();
});

// ============================================
// PROMO SLIDESHOW
// ============================================
let _promoTimer = null;
let _promoIdx = 0;
async function initPromoSlider() {
  const root = document.getElementById('promoSlideshow');
  if (!root) return;
  const slidesEl = root.querySelector('.promo-slides');
  const dotsEl   = root.querySelector('.promo-dots');
  if (!slidesEl || !dotsEl) return;

  let promos = [];
  try {
    promos = await loadPromos();
  } catch (e) {
    console.warn('initPromoSlider: loadPromos failed', e);
    return;
  }
  if (!promos || promos.length === 0) {
    root.style.display = 'none';
    return;
  }

  // Render slides
  slidesEl.innerHTML = promos.map((p, i) => `
    <a class="promo-slide ${i === 0 ? 'is-active' : ''}" href="${p.ctaUrl || '#'}" ${(p.ctaUrl || '').startsWith('http') ? 'target="_blank" rel="noopener"' : ''} data-idx="${i}">
      <img src="${p.image}" alt="${(p.title || 'Promo Vapertize').replace(/"/g, '&quot;')}" loading="lazy" decoding="async">
      <div class="promo-slide-overlay">
        ${p.badge ? `<span class="promo-slide-badge">${p.badge}</span>` : ''}
        <h3 class="promo-slide-title">${p.title || ''}</h3>
        ${p.subtitle ? `<p class="promo-slide-sub">${p.subtitle}</p>` : ''}
        ${p.ctaText ? `<span class="promo-slide-cta">${p.ctaText} <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M5 12h14m-7-7l7 7-7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>` : ''}
      </div>
    </a>
  `).join('');

  // Render dots
  dotsEl.innerHTML = promos.map((_, i) => `
    <button class="promo-dot ${i === 0 ? 'is-active' : ''}" data-idx="${i}" aria-label="Slide ${i + 1}"></button>
  `).join('');

  const goTo = (idx) => {
    const slides = slidesEl.querySelectorAll('.promo-slide');
    const dots   = dotsEl.querySelectorAll('.promo-dot');
    _promoIdx = (idx + promos.length) % promos.length;
    slides.forEach((s, i) => s.classList.toggle('is-active', i === _promoIdx));
    dots.forEach((d, i) => d.classList.toggle('is-active', i === _promoIdx));
  };

  const start = () => {
    stop();
    if (promos.length < 2) return;
    _promoTimer = setInterval(() => goTo(_promoIdx + 1), 5500);
  };
  const stop = () => { if (_promoTimer) { clearInterval(_promoTimer); _promoTimer = null; } };

  // Dots click
  dotsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.promo-dot');
    if (!btn) return;
    goTo(parseInt(btn.dataset.idx, 10));
    start();
  });

  // Prev/next
  root.querySelector('.promo-nav-prev')?.addEventListener('click', (e) => {
    e.preventDefault();
    goTo(_promoIdx - 1);
    start();
  });
  root.querySelector('.promo-nav-next')?.addEventListener('click', (e) => {
    e.preventDefault();
    goTo(_promoIdx + 1);
    start();
  });

  // Pause on hover
  root.addEventListener('mouseenter', stop);
  root.addEventListener('mouseleave', start);

  // Touch swipe (mobile)
  let touchStartX = 0;
  let touchEndX = 0;
  slidesEl.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; stop(); }, { passive: true });
  slidesEl.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 50) goTo(_promoIdx + (diff > 0 ? 1 : -1));
    start();
  }, { passive: true });

  start();
}

// ============================================
// RECENTLY SOLD TICKER implementation
// ============================================
let _tickerTimer = null;
function startRecentlySoldTicker() {
  // Wait a bit for products to load
  setTimeout(() => {
    showNextSale();
    _tickerTimer = setInterval(showNextSale, 12000);
  }, 5000);
}
function showNextSale() {
  if (typeof generateRecentSale !== 'function') return;
  const sale = generateRecentSale();
  if (!sale) return;

  let ticker = document.querySelector('.sale-ticker');
  if (!ticker) {
    ticker = document.createElement('div');
    ticker.className = 'sale-ticker';
    document.body.appendChild(ticker);
  }
  ticker.classList.remove('show');
  setTimeout(() => {
    const productName = sale.product.name.length > 38 ? sale.product.name.substring(0, 38) + '…' : sale.product.name;
    ticker.innerHTML = `
      <span class="sale-ticker-icon">🛍</span>
      <div class="sale-ticker-body">
        <strong>${sale.buyer.name}</strong> dari <strong>${sale.buyer.city}</strong> baru beli<br>
        <span class="sale-ticker-product">${productName}</span>
        <span class="sale-ticker-time">${sale.minutesAgo} menit lalu</span>
      </div>
      <button class="sale-ticker-close" aria-label="Tutup" onclick="closeSaleTicker()">×</button>
    `;
    ticker.classList.add('show');
    // Auto-hide after 6 seconds
    setTimeout(() => ticker.classList.remove('show'), 6000);
  }, 100);
}
function closeSaleTicker() {
  clearInterval(_tickerTimer);
  document.querySelector('.sale-ticker')?.remove();
  sessionStorage.setItem('vt_ticker_closed', '1');
}

// ============================================
// NOTIFY ME WHEN RESTOCK (Batch 2 — F11)
// Workflow: User input WA → POST to n8n webhook → fallback to localStorage
// Set N8N_RESTOCK_WEBHOOK env on production / replace below to enable n8n integration
// ============================================
const N8N_RESTOCK_WEBHOOK = ''; // e.g. 'https://n8n.vapertize.id/webhook/restock-notify'

function openRestockModal(productId, productName) {
  // Build modal if not exists
  let modal = document.querySelector('.restock-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'restock-modal';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div class="restock-modal-content">
      <button class="restock-close" onclick="closeRestockModal()" aria-label="Tutup">×</button>
      <div class="restock-icon">🔔</div>
      <h3 class="restock-title">Beritahu Saat Ready</h3>
      <div class="restock-product">${productName}</div>
      <p class="restock-desc">Kasih kontak WhatsApp kamu, AI Risa akan otomatis kabari saat produk ini sudah tersedia lagi.</p>
      <form onsubmit="return submitRestockNotify(event, '${productId}', \`${productName.replace(/`/g,'\\`')}\`)">
        <div class="form-group">
          <label class="form-label">No. WhatsApp</label>
          <input type="tel" class="form-input" id="restockPhone" required placeholder="08xxxxxxxxxx" pattern="0[0-9]{9,13}" minlength="10">
        </div>
        <div class="form-group">
          <label class="form-label">Nama (opsional)</label>
          <input type="text" class="form-input" id="restockName" placeholder="Nama kamu">
        </div>
        <button type="submit" class="btn btn-primary btn-block btn-lg">🔔 Daftar Notifikasi</button>
        <p style="text-align:center;font-size:12px;color:var(--text-muted);margin-top:12px">Atau langsung chat manual: <a href="https://wa.me/${STORE_INFO.defaultWA}?text=${encodeURIComponent('Halo Risa, tolong kabari saya kalau ' + productName + ' sudah ready')}" target="_blank" style="color:var(--accent)">via WhatsApp</a></p>
      </form>
    </div>
  `;
  modal.classList.add('show');
  modal.addEventListener('click', e => { if (e.target === modal) closeRestockModal(); });
}

function closeRestockModal() {
  document.querySelector('.restock-modal')?.classList.remove('show');
}

async function submitRestockNotify(e, productId, productName) {
  e.preventDefault();
  const phone = document.getElementById('restockPhone').value.trim();
  const name = document.getElementById('restockName').value.trim() || '-';

  const payload = {
    productId,
    productName,
    phone,
    name,
    timestamp: new Date().toISOString(),
    source: 'vapertize.id'
  };

  // 1. Save to localStorage (fallback / admin review)
  const stored = JSON.parse(localStorage.getItem('vt_restock_notifications') || '[]');
  stored.push(payload);
  localStorage.setItem('vt_restock_notifications', JSON.stringify(stored));

  // 2. Send to n8n webhook if configured
  if (N8N_RESTOCK_WEBHOOK) {
    try {
      await fetch(N8N_RESTOCK_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.warn('n8n webhook failed (will use WA fallback):', err);
    }
  }

  // 3. Also open WA so user has a confirmation channel
  const waMsg = `Halo Risa, saya ${name} (${phone}). Tolong kabari saya kalau ${productName} sudah ready. Terima kasih!`;
  window.open(`https://wa.me/${STORE_INFO.defaultWA}?text=${encodeURIComponent(waMsg)}`, '_blank');

  closeRestockModal();
  showToast('✓ Terdaftar! Cek WhatsApp untuk konfirmasi.', 'success');
  return false;
}
