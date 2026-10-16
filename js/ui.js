/* ================================================================
   UI — shared HUD, modal pop-ups, character picker, toasts, effects
   ================================================================ */
const UI = {

  /* ---------- 1. HUD (money + coins, top right) ---------- */
  updateHud(bump = false) {
    document.getElementById('hud-money-val').textContent = SAVE.data.money.toLocaleString();
    document.getElementById('hud-coins-val').textContent = SAVE.coins().toLocaleString();
    if (bump) {
      const hud = document.getElementById('hud');
      hud.classList.remove('bump'); void hud.offsetWidth; hud.classList.add('bump');
    }
  },

  /* ---------- 2. TOAST (small message at the bottom) ---------- */
  toast(msg, ms = 1800) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove('show'), ms);
  },

  /* ---------- 3. FLOATING TEXT (e.g. "+$5" rising from an element) ---------- */
  floatText(text, fromEl, color = '#2f9e6b') {
    const r = fromEl.getBoundingClientRect();
    const f = document.createElement('div');
    f.className = 'fx-float'; f.textContent = text; f.style.color = color;
    f.style.left = (r.left + r.width / 2) + 'px'; f.style.top = (r.top + r.height * 0.2) + 'px';
    document.getElementById('fx-layer').appendChild(f);
    setTimeout(() => f.remove(), 1200);
  },

  /* ---------- 4. MODAL ---------- */
  isModalOpen() { return document.getElementById('modal').classList.contains('open'); },
  openModal(buildFn, onClose) {
    const m = document.getElementById('modal'), card = document.getElementById('modal-card');
    card.innerHTML = ''; buildFn(card);
    m.classList.add('open'); this._onClose = onClose;
  },
  closeModal() {
    document.getElementById('modal').classList.remove('open');
    if (STICKER.active) { STICKER.active.destroy(); STICKER.active = null; }
    const cb = this._onClose; this._onClose = null; cb && cb();
  },

  /* ---------- 5. STICKER PICKER ----------
     opts: { title, mode: 'place' | 'favourite', current, onPick(key|id|null) }
     place     → one entry per owned sticker copy type (counts free copies)
     favourite → one entry per sticker id (just needs to be owned)                */
  picker({ title, mode = 'place', current = null, onPick }) {
    this.openModal(card => {
      card.innerHTML = `<div class="modal-title">${title}</div><div class="picker-grid"></div>
        <div class="modal-actions"></div>`;
      const grid = card.querySelector('.picker-grid');
      const entries = mode === 'favourite'
        ? CONFIG.STICKERS.filter(s => SAVE.ownsSticker(s.id)).map(s => ({ pick: s.id, key: CONFIG.key(s.id, s.rarity), left: 1, sub: s.name }))
        : SAVE.ownedKeys().map(k => ({ pick: k, key: k, left: SAVE.available(k), sub: `${SAVE.available(k)} free / ${SAVE.owned(k)}` }));
      if (!entries.length) grid.innerHTML = `<p class="picker-empty">No stickers yet!<br>Swipe to the gacha machine to pull some ✨</p>`;
      entries.forEach(e => {
        const { s, rarity } = CONFIG.parse(e.key);
        const b = document.createElement('button');
        b.className = 'picker-item' + (e.left <= 0 ? ' disabled' : '') + (e.pick === current ? ' current' : '');
        b.innerHTML = `<div class="picker-art"></div><span>${s.name}</span><small>${mode === 'favourite' ? '' : STICKER.badge(rarity)} ${mode === 'favourite' ? '' : e.sub}</small>`;
        b.querySelector('.picker-art').appendChild(STICKER.flat(e.key));
        if (e.left > 0) b.onclick = () => { this.closeModal(); onPick(e.pick); };
        grid.appendChild(b);
      });
      const acts = card.querySelector('.modal-actions');
      if (current) acts.appendChild(this.button('Remove', () => { this.closeModal(); onPick(null); }, 'ghost'));
      acts.appendChild(this.button('Close', () => this.closeModal()));
    });
  },

  /* ---------- 6. STICKER VIEWER (360° spin, prismatic back) ---------- */
  viewer(key, extraButtons = []) {
    const { s, rarity, r } = CONFIG.parse(key);
    this.openModal(card => {
      card.classList.add('viewer-card');
      card.innerHTML = `<div class="modal-title">${s.name}<small>${STICKER.badge(rarity)} ${r.name} · ${r.label}</small></div>
        <div class="viewer-stage r-${rarity}" data-nodrag></div><div class="viewer-hint">⟲ drag to spin 360° ⟳</div><div class="modal-actions"></div>`;
      STICKER.active = STICKER.create3D(key, card.querySelector('.viewer-stage'));
      const acts = card.querySelector('.modal-actions');
      extraButtons.forEach(b => acts.appendChild(this.button(b.label, b.onClick, b.style)));
      acts.appendChild(this.button('Close', () => this.closeModal()));
    }, () => document.getElementById('modal-card').classList.remove('viewer-card'));
  },

  /* ---------- 7. SMALL HELPERS ---------- */
  button(label, onClick, style = '') {
    const b = document.createElement('button');
    b.className = 'btn ' + style; b.textContent = label; b.onclick = onClick;
    return b;
  },

  init() {
    document.getElementById('modal').addEventListener('pointerdown', e => {
      if (e.target.id === 'modal') this.closeModal();
    });
    this.updateHud();
  },
};
