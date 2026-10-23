/* ================================================================
   SCENE 3 — STICKER BOOK
   Page 0 is the front cover; every page (cover included) can be
   decorated. Stickers can go anywhere and turn a full 360°.

     Tray  : tap a sticker to drop it in the middle of the page,
             or drag it out of the tray onto the page
     Page  : drag a sticker to move it · tap it to select
             ↻ handle = rotate (and resize) · ✕ = back to tray · 360° = view
     Series: all stickers of one series on the same page → special background
     Tabs  : Stickers (gacha) · Deco (shop stickers) · Pens (draw on the page)
             · Books (change the book's look) · 🛍 Shop (js/shop.js)
   ================================================================ */
const BOOK = {
  page: 0,
  selected: null,        // uid of the selected sticker on this page
  tab: 'stickers',       // tray tab: stickers | deco | pens | books
  pen: null,             // pen id while drawing (null = not drawing)

  /* ---------- 1. SETUP ---------- */
  init() {
    this.page = Math.min(SAVE.data.lastPage || 0, CONFIG.BOOK_PAGES - 1);
    document.getElementById('b-prev').onclick = () => this.turn(-1);
    document.getElementById('b-next').onclick = () => this.turn(1);
    this.bindPage();
    this.bindTabs();
    this.bindInk();
    this.applyBookStyle();
    this.renderPage();
    this.renderTray();
    window.addEventListener('resize', () => this.renderInk());
    SCENES.onChange.push(() => this.setPen(null));      // leaving the book stops drawing
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
    this.renderInk();
    this.applyThemes(false);
    this.select(this.selected && this.stickers().some(s => s.uid === this.selected) ? this.selected : null);
  },
  makePlaced(st) {
    const el = document.createElement('div');
    el.className = 'b-st' + (CONFIG.isDeco(st.key) ? ' is-deco' : ''); el.dataset.uid = st.uid;
    el.appendChild(this.art(st.key));
    el.insertAdjacentHTML('beforeend', `<div class="b-ctrl"><button class="b-h b-rot" title="Rotate">↻</button>
      <button class="b-h b-del" title="Back to tray">✕</button><button class="b-h b-view" title="View 360°">360°</button></div>`);
    this.place(el, st);
    return el;
  },
  /* gacha sticker or shop deco sticker */
  art(key) { return CONFIG.isDeco(key) ? SHOP.decoEl(key.slice(5)) : STICKER.flat(key); },
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
      else if (mode === 'view') { if (!CONFIG.isDeco(st.key)) UI.viewer(st.key); }
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
    if (SAVE.available(key) <= 0) return UI.toast(CONFIG.isDeco(key) ? 'No copies left — buy more in the 🛍 Shop' : 'No free copies of that sticker left');
    const st = { uid: this.uid(), key, x, y, rot: Math.round(Math.random() * 30 - 15), scale: 1 };
    this.stickers().push(st); SAVE.save();
    AUDIO.play("place");
    const el = this.makePlaced(st); el.classList.add('slap');
    document.getElementById('b-layer').appendChild(el);
    this.select(st.uid);
    this.applyThemes(); this.renderTray();
  },

  /* ---------- 6. TRAY (tabs: Stickers · Deco · Pens · Books) ---------- */
  bindTabs() {
    document.getElementById('b-tabs').onclick = e => {
      const b = e.target.closest('[data-tab]'); if (!b || b.dataset.tab === this.tab) return;
      AUDIO.play('button');
      this.tab = b.dataset.tab;
      if (this.tab !== 'pens') this.setPen(null);
      this.renderTray();
    };
    document.getElementById('b-shop').onclick = () => SHOP.open(this.tab === 'pens' ? 'pens' : this.tab === 'books' ? 'books' : 'deco');
  },
  renderTray() {
    const list = document.getElementById('b-tray');
    if (!list) return;
    document.querySelectorAll('#b-tabs [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === this.tab));
    list.className = 'b-tray-list tab-' + this.tab;
    list.innerHTML = '';
    ({ stickers: this.trayStickers, deco: this.trayDeco, pens: this.trayPens, books: this.trayBooks })[this.tab].call(this, list);
  },
  empty(list, html) { list.innerHTML = `<p class="b-tray-empty">${html}</p>`; },
  /* gacha stickers */
  trayStickers(list) {
    const keys = SAVE.ownedKeys();
    document.getElementById('b-count').textContent = `${SAVE.totalOwned()} owned`;
    if (!keys.length) return this.empty(list, 'Pull stickers at the gacha machine, then drag them onto the page!');
    keys.forEach(k => {
      const free = SAVE.available(k), { s, rarity } = CONFIG.parse(k);
      list.appendChild(this.trayItem(k, `${STICKER.badge(rarity)}<span>${s.name}</span><small>×${free}</small>`, free));
    });
  },
  /* shop deco stickers (generic stickers) */
  trayDeco(list) {
    const items = CONFIG.SHOP.deco.filter(it => SHOP.decoCount(it.id) > 0);
    document.getElementById('b-count').textContent = `${items.reduce((n, it) => n + SHOP.decoCount(it.id), 0)} owned`;
    if (!items.length) return this.empty(list, 'No deco stickers yet — get hearts, stars & more in the <b>🛍 Shop</b>!');
    items.forEach(it => {
      const k = 'deco:' + it.id, free = SAVE.available(k);
      list.appendChild(this.trayItem(k, `${it.shiny ? '<span class="rar r-UR">✨</span>' : ''}<span>${it.name}</span><small>×${free}</small>`, free));
    });
  },
  trayItem(key, info, free) {
    const b = document.createElement('button');
    b.className = 'b-item' + (free <= 0 ? ' used' : '');
    b.dataset.key = key;
    b.innerHTML = `<div class="b-item-art"></div><div class="b-item-info">${info}</div>`;
    b.querySelector('.b-item-art').appendChild(this.art(key));
    this.bindTrayItem(b, key);
    return b;
  },
  /* pens: tap a pen to draw with it, tap again (or ✋) to stop */
  trayPens(list) {
    const pens = CONFIG.SHOP.pens.filter(p => SHOP.ownsPen(p.id));
    document.getElementById('b-count').textContent = this.pen === 'eraser' ? '🩹 erasing — tap a line to remove it' : this.pen ? '✏️ drawing — draw on the page' : 'tap a pen, then draw';
    if (!pens.length) return this.empty(list, 'No pens yet — buy a matte, highlighter or shiny pen in the <b>🛍 Shop</b>!');
    pens.forEach(p => {
      const b = document.createElement('button');
      b.className = 'b-item b-pen' + (this.pen === p.id ? ' on' : '');
      b.innerHTML = `<div class="b-item-art">${SHOP.penSwatch(p)}</div><div class="b-item-info"><span>${p.name}</span></div>`;
      b.onclick = () => { AUDIO.play('button'); this.setPen(this.pen === p.id ? null : p.id); };
      list.appendChild(b);
    });
    const tool = (icon, label, fn, on = false) => {
      const b = document.createElement('button'); b.className = 'b-item b-tool' + (on ? ' on' : '');
      b.innerHTML = `<div class="b-item-art"><b>${icon}</b></div><div class="b-item-info"><span>${label}</span></div>`;
      b.onclick = fn; list.appendChild(b);
    };
    tool('🩹', 'Eraser', () => { AUDIO.play('button'); this.setPen(this.pen === 'eraser' ? null : 'eraser'); }, this.pen === 'eraser');
    tool('↶', 'Undo', () => this.undoInk());
    tool('🧽', 'Clear page', () => this.clearInk());
    if (this.pen) tool('✋', 'Stop', () => this.setPen(null));
  },
  /* books: tap an owned book to use it; locked ones open the shop */
  trayBooks(list) {
    document.getElementById('b-count').textContent = `${SAVE.data.acc.books.length}/${CONFIG.SHOP.books.length} books`;
    CONFIG.SHOP.books.forEach(bk => {
      const owned = SHOP.ownsBook(bk.id), using = SAVE.data.bookStyle === bk.id;
      const b = document.createElement('button');
      b.className = 'b-item b-bookitem' + (using ? ' on' : '') + (owned ? '' : ' locked');
      b.innerHTML = `<div class="b-item-art">${SHOP.bookPreview(bk.id)}</div>
        <div class="b-item-info"><span>${bk.name}</span><small>${using ? 'In use' : owned ? 'Tap to use' : '🔒 $' + bk.price}</small></div>`;
      b.onclick = () => {
        AUDIO.play('button');
        if (!owned) return SHOP.open('books');
        SAVE.data.bookStyle = bk.id; SAVE.save();
        this.applyBookStyle(true); this.renderTray();
      };
      list.appendChild(b);
    });
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
        ghost = this.art(key); ghost.classList.add('b-ghost');
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

  /* ---------- 7. PENS (ink drawn on the page) ----------
     Ink is stored per page as points 0..1000 of the page width / height
     (SAVE.data.ink). It sits under the stickers. Stroke widths follow the
     page width, so drawings look the same on phone and PC.                  */
  setPen(id) {
    this.pen = id;
    document.getElementById('b-page').classList.toggle('drawing', !!id);
    document.getElementById('b-page').classList.toggle('erasing', id === 'eraser');
    if (id) { this.select(null); UI.toast(id === 'eraser' ? '🩹 Tap or swipe over a line to erase it' : '✏️ Draw on the page! Tap the pen again to stop'); }
    if (this.tab === 'pens') this.renderTray();
  },
  ink() { return SAVE.data.ink[this.page]; },
  inkPoints(page = this.page) { return SAVE.data.ink[page].reduce((n, s) => n + s.pts.length / 2, 0); },
  bindInk() {
    const pad = document.getElementById('b-draw');
    let stroke = null, path = null, r = null;
    const pt = e => [Math.round((e.clientX - r.left) / r.width * 1000), Math.round((e.clientY - r.top) / r.height * 1000)];
    let erasing = false;
    pad.addEventListener('pointerdown', e => {
      if (!this.pen) return;
      if (this.pen === 'eraser') {
        r = pad.getBoundingClientRect(); erasing = true;
        try { pad.setPointerCapture(e.pointerId); } catch (_) {}
        return this.eraseAt(pt(e));
      }
      if (this.inkPoints() >= CONFIG.INK_MAX_POINTS) return UI.toast('This page is full of ink — undo or clear some first');
      r = pad.getBoundingClientRect();
      try { pad.setPointerCapture(e.pointerId); } catch (_) {}
      stroke = { pen: this.pen, pts: pt(e) };
      this.ink().push(stroke);
      path = this.drawStroke(stroke);
    });
    pad.addEventListener('pointermove', e => {
      if (erasing) return this.eraseAt(pt(e));
      if (!stroke) return;
      const [x, y] = pt(e), p = stroke.pts, n = p.length;
      if (Math.hypot(x - p[n - 2], y - p[n - 1]) < 6) return;      // skip tiny moves (smaller save)
      p.push(Math.max(0, Math.min(1000, x)), Math.max(0, Math.min(1000, y)));
      path.forEach(el => el.setAttribute('d', this.pathD(p)));
    });
    const end = () => {
      if (erasing) { erasing = false; SAVE.save(); return; }
      if (!stroke) return;
      if (stroke.pts.length === 2) { stroke.pts.push(stroke.pts[0] + 1, stroke.pts[1]); path.forEach(el => el.setAttribute('d', this.pathD(stroke.pts))); }   // a dot
      stroke = null; SAVE.save();
    };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
  },
  /* smooth line through the points (quadratic curves between midpoints) */
  pathD(p) {
    const W = this._iw, H = this._ih, X = i => (p[i] / 1000 * W).toFixed(1), Y = i => (p[i + 1] / 1000 * H).toFixed(1);
    let d = `M${X(0)} ${Y(0)}`;
    if (p.length <= 4) return d + ` L${X(p.length - 2)} ${Y(p.length - 2)}`;
    for (let i = 2; i < p.length - 2; i += 2) {
      const mx = ((p[i] + p[i + 2]) / 2 / 1000 * W).toFixed(1), my = ((p[i + 1] + p[i + 3]) / 2 / 1000 * H).toFixed(1);
      d += ` Q${X(i)} ${Y(i)} ${mx} ${my}`;
    }
    return d + ` L${X(p.length - 2)} ${Y(p.length - 2)}`;
  },
  /* adds one stroke to the ink layer, returns its <path> elements */
  drawStroke(s) {
    const svg = document.getElementById('b-ink'), pen = CONFIG.shopItem('pens', s.pen);
    if (!pen) return [];
    const NS = 'http://www.w3.org/2000/svg', w = pen.width * this._iw, out = [];
    const mk = (attrs) => { const el = document.createElementNS(NS, 'path'); Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); el.setAttribute('d', this.pathD(s.pts)); svg.appendChild(el); out.push(el); return el; };
    if (pen.kind === 'shiny') {
      mk({ class: 'ink ink-shiny', stroke: `url(#ink-${pen.id})`, 'stroke-width': w });
      mk({ class: 'ink ink-glitter', stroke: '#fff', 'stroke-width': Math.max(1.5, w * 0.35), 'stroke-dasharray': `0.5 ${(w * 1.6).toFixed(1)}` });
    } else mk({ class: 'ink ink-' + pen.kind, stroke: pen.color, 'stroke-width': w });
    return out;
  },
  renderInk() {
    const svg = document.getElementById('b-ink'); if (!svg) return;
    const page = document.getElementById('b-page');      // clientWidth ignores page-turn transforms
    this._iw = page.clientWidth || 300; this._ih = page.clientHeight || 400;
    svg.setAttribute('viewBox', `0 0 ${this._iw} ${this._ih}`);
    // gradients for the shiny pens (spread along the page so long strokes shimmer)
    svg.innerHTML = `<defs>${CONFIG.SHOP.pens.filter(p => p.kind === 'shiny').map(p => `<linearGradient id="ink-${p.id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${this._iw * 0.35}" y2="${this._ih * 0.2}" spreadMethod="reflect">
      ${p.colors.map((c, i) => `<stop offset="${i / (p.colors.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient>`).join('')}</defs>`;
    this.ink().forEach(s => this.drawStroke(s));
  },
  undoInk() {
    AUDIO.play('button');
    if (!this.ink().length) return UI.toast('Nothing to undo on this page');
    this.ink().pop(); SAVE.save(); this.renderInk();
  },
  /* object eraser: removes the whole stroke under the finger (p = [x, y] in 0..1000 page units) */
  eraseAt([x, y]) {
    const W = this._iw / 1000, H = this._ih / 1000, px = x * W, py = y * H;
    const ink = this.ink();
    const hit = ink.findIndex(s => {
      const pen = CONFIG.shopItem('pens', s.pen), reach = Math.max(10, (pen ? pen.width * this._iw : 6) / 2 + 8), p = s.pts;
      for (let i = 0; i < p.length; i += 2) {                     // distance to each segment of the stroke
        const ax = p[i] * W, ay = p[i + 1] * H, bx = (p[i + 2] ?? p[i]) * W, by = (p[i + 3] ?? p[i + 1]) * H;
        const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / ((dx * dx + dy * dy) || 1)));
        if (Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) <= reach) return true;
      }
      return false;
    });
    if (hit < 0) return;
    ink.splice(hit, 1); AUDIO.play('tear');
    this.renderInk();
  },
  /* uses the game's own pop-up (browser confirm() is blocked in some embeds) */
  clearInk() {
    AUDIO.play('button');
    if (!this.ink().length) return UI.toast('No ink on this page');
    UI.openModal(card => {
      card.innerHTML = `<div class="modal-title">Clear this page?<small>All pen drawings on this page will be removed. Stickers stay.</small></div><div class="modal-actions"></div>`;
      const acts = card.querySelector('.modal-actions');
      acts.appendChild(UI.button('Cancel', () => UI.closeModal(), 'ghost'));
      acts.appendChild(UI.button('🧽 Clear', () => {
        UI.closeModal();
        SAVE.data.ink[this.page] = []; SAVE.save(); this.renderInk();
        UI.toast('Page ink cleared');
      }));
    });
  },

  /* ---------- 8. BOOK LOOK (Books tab) ---------- */
  applyBookStyle(flash = false) {
    const book = document.getElementById('b-book');
    CONFIG.SHOP.books.forEach(b => book.classList.toggle('book-' + b.id, SAVE.data.bookStyle === b.id));
    if (flash) {
      AUDIO.play('flip');
      const page = document.getElementById('b-page');
      page.classList.remove('restyle'); void page.offsetWidth; page.classList.add('restyle');
    }
  },
};
