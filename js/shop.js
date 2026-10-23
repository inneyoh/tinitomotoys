/* ================================================================
   SHOP — Accessory Shop (paid in $, not coins)
   Opened from the sticker book screen (🛍 Shop button).
     Stickers : generic deco stickers, $3 (plain) / $5 (shiny or special design)
                each buy = 1 copy (a copy is in use while it is on a page)
     Pens     : $7 matte pens & highlighters / $9 shiny pens — buy once, draw forever
     Books    : $15 colour variations / $25 special designs — buy once, swap any time
   Prices + items live in CONFIG.SHOP.  Owned items: SAVE.data.acc
   ================================================================ */
const SHOP = {
  tab: 'deco',
  TABS: [['deco', '💗 Stickers'], ['pens', '🖊 Pens'], ['books', '📔 Books']],

  /* ---------- 1. OWNERSHIP ---------- */
  decoCount(id) { return SAVE.data.acc.deco[id] || 0; },
  ownsPen(id) { return SAVE.data.acc.pens.includes(id); },
  ownsBook(id) { return SAVE.data.acc.books.includes(id); },
  canAfford(price) { return SAVE.data.money >= price; },

  /* ---------- 2. BUY ---------- */
  buy(type, id, fromEl) {
    const it = CONFIG.shopItem(type, id);
    if (!it) return;
    if (type === 'pens' && this.ownsPen(id)) return;
    if (type === 'books' && this.ownsBook(id)) return;
    if (!this.canAfford(it.price)) { AUDIO.play('button'); return UI.toast('Not enough money — answer a few more calls! 📞'); }
    SAVE.data.money -= it.price;
    if (type === 'deco') SAVE.data.acc.deco[id] = this.decoCount(id) + 1;
    if (type === 'pens') SAVE.data.acc.pens.push(id);
    if (type === 'books') SAVE.data.acc.books.push(id);
    SAVE.save(); UI.updateHud(true);
    AUDIO.play('coin');
    if (fromEl) UI.floatText('-$' + it.price, fromEl, '#d9486b');
    UI.toast(type === 'deco' ? `Bought ${it.name} sticker ✨ (find it in the Deco tab)`
      : type === 'pens' ? `Bought ${it.name} 🖊 (find it in the Pens tab)`
      : `Bought the ${it.name} book 📔 (switch in the Books tab)`);
    this.render();
    BOOK.renderTray();
  },

  /* ---------- 3. ITEM ART (shared with the sticker book tray) ---------- */
  /* a deco sticker, same structure as STICKER.flat so the book can size it */
  decoEl(id) {
    const it = CONFIG.shopItem('deco', id) || {};
    const d = document.createElement('div');
    d.className = 'stk deco' + (it.shiny ? ' shiny' : '');
    const u = `url(${CONFIG.decoImg(id)})`;
    d.innerHTML = `<img src="${CONFIG.decoImg(id)}" alt="" draggable="false">` +
      (it.shiny ? `<div class="stk-sheen" style="-webkit-mask-image:${u};mask-image:${u};-webkit-mask-size:100% 100%;mask-size:100% 100%;"></div>` : '');
    return d;
  },
  /* a squiggle drawn with the pen (used for shop cards and the Pens tab) */
  penSwatch(pen) {
    const g = 'pg-' + pen.id + '-' + Math.random().toString(36).slice(2, 6);
    const w = pen.kind === 'highlighter' ? 16 : pen.kind === 'shiny' ? 7 : 5;
    const stroke = pen.kind === 'shiny' ? `url(#${g})` : pen.color;
    return `<svg class="pen-swatch" viewBox="0 0 120 60">
      ${pen.kind === 'shiny' ? `<defs><linearGradient id="${g}" x1="0" x2="1">${pen.colors.map((c, i) => `<stop offset="${i / (pen.colors.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient></defs>` : ''}
      <path d="M10 40 C 30 6, 48 6, 58 30 S 90 56, 110 18" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"
        ${pen.kind === 'highlighter' ? 'stroke-opacity=".55"' : ''}/>
      ${pen.kind === 'shiny' ? `<path class="ink-glitter" d="M10 40 C 30 6, 48 6, 58 30 S 90 56, 110 18" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-dasharray="0.5 9"/>` : ''}
    </svg>`;
  },
  /* a mini sticker book showing the cover design */
  bookPreview(id) { return `<div class="book-prev book-${id}"><div class="bp-cover"><i></i></div></div>`; },
  tag(type, it) {
    if (type === 'deco') return it.shiny ? '<span class="shop-tag shiny">✨ Shiny</span>' : it.special ? '<span class="shop-tag special">★ Special</span>' : '<span class="shop-tag">Basic</span>';
    if (type === 'pens') return it.kind === 'shiny' ? '<span class="shop-tag shiny">✨ Shiny</span>' : it.kind === 'highlighter' ? '<span class="shop-tag">Highlighter</span>' : '<span class="shop-tag">Matte</span>';
    return it.special ? '<span class="shop-tag special">★ Special design</span>' : '<span class="shop-tag">Colour</span>';
  },

  /* ---------- 4. SHOP WINDOW (modal) ---------- */
  open(tab = this.tab) {
    this.tab = tab;
    AUDIO.play('button');
    UI.openModal(card => {
      card.classList.add('shop-card');
      card.innerHTML = `<div class="modal-title">🛍 Accessory Shop<small>Pay with cash · Wallet <b class="shop-wallet"></b></small></div>
        <div class="shop-tabs">${this.TABS.map(([t, l]) => `<button data-tab="${t}">${l}</button>`).join('')}</div>
        <div class="shop-grid"></div><div class="modal-actions"></div>`;
      card.querySelector('.shop-tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) { this.tab = b.dataset.tab; AUDIO.play('button'); this.render(); } };
      card.querySelector('.modal-actions').appendChild(UI.button('Close', () => UI.closeModal()));
      this.render();
    }, () => document.getElementById('modal-card').classList.remove('shop-card'));
  },
  render() {
    const card = document.querySelector('#modal-card.shop-card'); if (!card) return;
    card.querySelector('.shop-wallet').textContent = '$' + SAVE.data.money.toLocaleString();
    card.querySelectorAll('.shop-tabs [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === this.tab));
    const grid = card.querySelector('.shop-grid'), type = this.tab;
    grid.innerHTML = '';
    CONFIG.SHOP[type].forEach(it => {
      if (type === 'books' && it.price === 0) return;           // the free starter book isn't sold
      const owned = type === 'pens' ? this.ownsPen(it.id) : type === 'books' ? this.ownsBook(it.id) : false;
      const c = document.createElement('div');
      c.className = 'shop-item' + (owned ? ' owned' : '');
      c.innerHTML = `<div class="shop-art"></div><div class="shop-name">${it.name}</div>${this.tag(type, it)}
        ${type === 'deco' && this.decoCount(it.id) ? `<div class="shop-have">Have ×${this.decoCount(it.id)}</div>` : ''}
        <button class="btn shop-buy">${owned ? 'Owned ✓' : '$' + it.price}</button>`;
      const art = c.querySelector('.shop-art');
      if (type === 'deco') art.appendChild(this.decoEl(it.id));
      else art.innerHTML = type === 'pens' ? this.penSwatch(it) : this.bookPreview(it.id);
      const btn = c.querySelector('.shop-buy');
      if (owned) btn.disabled = true;
      else { btn.classList.toggle('poor', !this.canAfford(it.price)); btn.onclick = () => this.buy(type, it.id, btn); }
      grid.appendChild(c);
    });
  },
};
