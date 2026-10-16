/* ================================================================
   SCENE 3 — STICKER BOOK
   Page 0 is the front cover; every page (cover included) can be
   decorated. Stickers can go anywhere and turn a full 360°.

     Tray  : tap a sticker to drop it in the middle of the page,
             or drag it out of the tray onto the page
     Page  : drag a sticker to move it · tap it to select
             ↻ handle = rotate (and resize) · ✕ = back to tray · 360° = view
     Series: all stickers of one series on the same page → special background
   ================================================================ */
const BOOK = {
  page: 0,
  selected: null,        // uid of the selected sticker on this page

  /* ---------- 1. SETUP ---------- */
  init() {
    this.page = Math.min(SAVE.data.lastPage || 0, CONFIG.BOOK_PAGES - 1);
    document.getElementById('b-prev').onclick = () => this.turn(-1);
    document.getElementById('b-next').onclick = () => this.turn(1);
    this.bindPage();
    this.renderPage();
    this.renderTray();
  },
  stickers() { return SAVE.data.book[this.page]; },
  uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); },

  /* ---------- 2. DRAW THE PAGE ---------- */
  renderPage() {
    const page = document.getElementById('b-page');
    page.classList.toggle('cover', this.page === 0);
    document.getElementById('b-label').textContent = this.page === 0 ? 'Front cover' : `Page ${this.page}`;
    document.getElementById('b-prev').disabled = this.page === 0;
    document.getElementById('b-next').disabled = this.page === CONFIG.BOOK_PAGES - 1;
    document.getElementById('b-pageno').textContent = this.page === 0 ? '' : this.page;
    const layer = document.getElementById('b-layer');
    layer.innerHTML = '';
    this.stickers().forEach(st => layer.appendChild(this.makePlaced(st)));
    this.applyThemes(false);
    this.select(this.selected && this.stickers().some(s => s.uid === this.selected) ? this.selected : null);
  },
  makePlaced(st) {
    const el = document.createElement('div');
    el.className = 'b-st'; el.dataset.uid = st.uid;
    el.appendChild(STICKER.flat(st.key));
    el.insertAdjacentHTML('beforeend', `<div class="b-ctrl"><button class="b-h b-rot" title="Rotate">↻</button>
      <button class="b-h b-del" title="Back to tray">✕</button><button class="b-h b-view" title="View 360°">360°</button></div>`);
    this.place(el, st);
    return el;
  },
  place(el, st) {
    el.style.left = (st.x * 100) + '%';
    el.style.top = (st.y * 100) + '%';
    el.style.width = (CONFIG.STICKER_SIZE * st.scale * 100) + '%';
    el.style.transform = `translate(-50%, -50%) rotate(${st.rot}deg)`;
  },
  select(uid) {
    this.selected = uid;
    document.querySelectorAll('.b-st').forEach(el => el.classList.toggle('sel', el.dataset.uid === uid));
  },

  /* ---------- 3. SERIES BACKGROUNDS ---------- */
  completedSeries(pageIndex) {
    const ids = new Set(SAVE.data.book[pageIndex].map(st => CONFIG.parse(st.key).id));
    // a sticker with `standsInFor` counts as the sticker it replaces
    CONFIG.STICKERS.forEach(s => { if (s.standsInFor && ids.has(s.id)) ids.add(s.standsInFor); });
    return Object.keys(CONFIG.SERIES).filter(sid => {
      const members = CONFIG.STICKERS.filter(s => s.series === sid && !s.standsInFor);
      return members.length && members.every(s => ids.has(s.id));
    });
  },
  applyThemes(celebrate = true) {
    const page = document.getElementById('b-page');
    const done = this.completedSeries(this.page).filter(sid => CONFIG.SERIES[sid].theme);
    Object.keys(CONFIG.SERIES).forEach(sid => page.classList.toggle('theme-' + sid, done.includes(sid)));
    if (celebrate) done.forEach(sid => {
      const was = this._lastThemes && this._lastThemes.includes(sid);
      if (!was) { AUDIO.play("complete"); UI.toast(`✨ ${CONFIG.SERIES[sid].name} complete! New page background`); page.classList.remove('flash'); void page.offsetWidth; page.classList.add('flash'); }
    });
    this._lastThemes = done;
  },

  /* ---------- 4. TURN PAGES ---------- */
  turn(dir) {
    const next = this.page + dir;
    if (next < 0 || next >= CONFIG.BOOK_PAGES || this._turning) return;
    this._turning = true;
    AUDIO.play("flip");
    const page = document.getElementById('b-page');
    page.classList.add(dir > 0 ? 'turn-out-next' : 'turn-out-prev');
    setTimeout(() => {
      this.page = next; this.selected = null;
      SAVE.data.lastPage = next; SAVE.save();
      page.classList.remove('turn-out-next', 'turn-out-prev');
      this.renderPage();
      page.classList.add(dir > 0 ? 'turn-in-next' : 'turn-in-prev');
      setTimeout(() => { page.classList.remove('turn-in-next', 'turn-in-prev'); this._turning = false; }, 260);
    }, 240);
  },

  /* ---------- 5. MOVE / ROTATE / REMOVE ON THE PAGE ---------- */
  bindPage() {
    const layer = document.getElementById('b-layer');
    let drag = null;

    layer.addEventListener('pointerdown', e => {
      const el = e.target.closest('.b-st');
      if (!el) { this.select(null); return; }
      const st = this.stickers().find(s => s.uid === el.dataset.uid);
      // bring to front
      const arr = this.stickers(); arr.splice(arr.indexOf(st), 1); arr.push(st); layer.appendChild(el);
      this.select(st.uid);
      const r = layer.getBoundingClientRect();
      if (e.target.closest('.b-del')) { drag = { mode: 'del', st }; return; }
      if (e.target.closest('.b-view')) { drag = { mode: 'view', st }; return; }
      if (e.target.closest('.b-rot')) {
        const er = el.getBoundingClientRect(), cx = er.left + er.width / 2, cy = er.top + er.height / 2;
        drag = { mode: 'rot', st, el, cx, cy, a0: Math.atan2(e.clientY - cy, e.clientX - cx), d0: Math.hypot(e.clientX - cx, e.clientY - cy), rot0: st.rot, sc0: st.scale };
      } else {
        drag = { mode: 'move', st, el, r, ox: e.clientX - (r.left + st.x * r.width), oy: e.clientY - (r.top + st.y * r.height) };
      }
      layer.setPointerCapture(e.pointerId);
    });

    layer.addEventListener('pointermove', e => {
      if (!drag) return;
      const { st, el } = drag;
      if (drag.mode === 'move') {
        st.x = Math.max(0, Math.min(1, (e.clientX - drag.ox - drag.r.left) / drag.r.width));
        st.y = Math.max(0, Math.min(1, (e.clientY - drag.oy - drag.r.top) / drag.r.height));
        this.place(el, st);
      } else if (drag.mode === 'rot') {
        const a = Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx);
        st.rot = (drag.rot0 + (a - drag.a0) * 180 / Math.PI + 360) % 360;
        const d = Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy);
        st.scale = Math.max(CONFIG.STICKER_SCALE_MIN, Math.min(CONFIG.STICKER_SCALE_MAX, drag.sc0 * d / Math.max(1, drag.d0)));
        this.place(el, st);
      }
    });

    const end = () => {
      if (!drag) return;
      const { mode, st } = drag; drag = null;
      if (mode === 'del') this.remove(st.uid);
      else if (mode === 'view') UI.viewer(st.key);
      else SAVE.save();
    };
    layer.addEventListener('pointerup', () => { if (drag?.mode === 'move') AUDIO.play('place'); end(); });
    layer.addEventListener('pointercancel', end);
  },
  remove(uid) {
    const arr = this.stickers(), i = arr.findIndex(s => s.uid === uid);
    if (i < 0) return;
    arr.splice(i, 1); SAVE.save();
    const el = document.querySelector(`.b-st[data-uid="${uid}"]`);
    if (el) { el.classList.add('peel'); setTimeout(() => el.remove(), 260); }
    this.selected = null;
    this.applyThemes(); this.renderTray();
  },
  addSticker(key, x = 0.5, y = 0.5) {
    if (SAVE.available(key) <= 0) return UI.toast('No free copies of that sticker left');
    const st = { uid: this.uid(), key, x, y, rot: Math.round(Math.random() * 30 - 15), scale: 1 };
    this.stickers().push(st); SAVE.save();
    AUDIO.play("place");
    const el = this.makePlaced(st); el.classList.add('slap');
    document.getElementById('b-layer').appendChild(el);
    this.select(st.uid);
    this.applyThemes(); this.renderTray();
  },

  /* ---------- 6. STICKER TRAY ---------- */
  renderTray() {
    const list = document.getElementById('b-tray');
    if (!list) return;
    const keys = SAVE.ownedKeys();
    list.innerHTML = keys.length ? '' : '<p class="b-tray-empty">Pull stickers at the gacha machine, then drag them onto the page!</p>';
    keys.forEach(k => {
      const free = SAVE.available(k), { s, rarity } = CONFIG.parse(k);
      const b = document.createElement('button');
      b.className = 'b-item' + (free <= 0 ? ' used' : '');
      b.dataset.key = k;
      b.innerHTML = `<div class="b-item-art"></div><div class="b-item-info">${STICKER.badge(rarity)}<span>${s.name}</span><small>×${free}</small></div>`;
      b.querySelector('.b-item-art').appendChild(STICKER.flat(k));
      this.bindTrayItem(b, k);
      list.appendChild(b);
    });
    document.getElementById('b-count').textContent = `${SAVE.totalOwned()} owned`;
  },
  /* drag a sticker out of the tray: the floating sticker is shown at the SAME
     size it will have on the page, lifted above the finger on touch screens so
     you can see where it lands. Release over the page to stick it there.     */
  bindTrayItem(btn, key) {
    let start = null, ghost = null, lift = 0;
    const layer = () => document.getElementById('b-layer');
    const overPage = (x, y) => { const r = layer().getBoundingClientRect(); return { x: (x - r.left) / r.width, y: (y - r.top) / r.height }; };
    const inside = p => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
    btn.addEventListener('pointerdown', e => { start = { x: e.clientX, y: e.clientY, id: e.pointerId }; lift = e.pointerType === 'mouse' ? 0 : 1; });
    btn.addEventListener('pointermove', e => {
      if (!start) return;
      if (!ghost && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) {
        if (SAVE.available(key) <= 0) { start = null; return; }
        btn.setPointerCapture(start.id);
        ghost = STICKER.flat(key); ghost.classList.add('b-ghost');
        ghost.style.width = (layer().getBoundingClientRect().width * CONFIG.STICKER_SIZE) + 'px';
        document.getElementById('fx-layer').appendChild(ghost);
        lift = lift ? ghost.getBoundingClientRect().height * 0.6 + 12 : 0;
      }
      if (ghost) {
        const gx = e.clientX, gy = e.clientY - lift;          // sticker centre
        ghost.style.left = gx + 'px'; ghost.style.top = gy + 'px';
        const on = inside(overPage(gx, gy));
        ghost.classList.toggle('off-page', !on);
        document.getElementById('b-page').classList.toggle('drop-hover', on);
      }
    });
    const stop = () => { if (ghost) { ghost.remove(); ghost = null; } document.getElementById('b-page').classList.remove('drop-hover'); };
    btn.addEventListener('pointerup', e => {
      if (!start) return;
      if (ghost) {
        const p = overPage(e.clientX, e.clientY - lift);
        stop();
        if (inside(p)) this.addSticker(key, p.x, p.y);
      } else {
        this.addSticker(key, 0.5 + (Math.random() - 0.5) * 0.2, 0.5 + (Math.random() - 0.5) * 0.2);
      }
      start = null;
    });
    btn.addEventListener('pointercancel', () => { start = null; stop(); });
  },
};
