/* ================================================================
   SCENE 2 — GACHA MACHINE
   Flow:  choose 1×/5×  →  tap COIN slot  →  turn knob (drag in a
   circle, or just tap it)  →  balls drop into the hold  →  tap hold
   →  blindboxes pop up  →  tear flaps  →  spin your sticker 360°
   ================================================================ */
const GACHA = {
  state: 'select',     // select | paid | spinning | loaded | reveal
  pulls: 1,
  results: [],         // sticker keys ("id:rarity") for the current pull
  turned: 0,           // knob degrees turned this pull
  dropped: 0,

  /* ---------- 1. SETUP ---------- */
  init() {
    this.fillGlass(document.getElementById('gm-glass'), 26);
    document.querySelectorAll('.gm-deco .gm-glass').forEach(g => this.fillGlass(g, 22));

    document.querySelectorAll('.gm-pick').forEach(b => b.onclick = () => this.choose(+b.dataset.n));
    document.getElementById('gm-slot').onclick = () => this.insertCoins();
    document.getElementById('gm-hold').onclick = () => this.openHold();
    document.getElementById('reveal-done').onclick = () => this.closeReveal();
    document.getElementById('reveal-tearall').onclick = () => this.tearAll();
    this.bindKnob();
    this.setMsg('Choose pulls');
  },

  /* ---------- 2. CAPSULE ART (inline SVG) ---------- */
  capsuleSVG(color, size = 60) {
    return `<svg viewBox="0 0 60 60" width="${size}" height="${size}">
      <circle cx="30" cy="30" r="26" fill="#ffffffcc" stroke="#5c341e" stroke-width="3.5"/>
      <path d="M4 30a26 26 0 0 1 52 0z" fill="${color}" stroke="#5c341e" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M4 30h52" stroke="#5c341e" stroke-width="3.5"/>
      <path d="M14 18q5-8 14-9" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`;
  },
  fillGlass(el, n) {
    let html = '';
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / 6), col = i % 6;
      const x = 2 + col * 16 + (row % 2) * 7 + Math.random() * 4;
      const y = 72 - row * 17 + Math.random() * 5;
      const col2 = CONFIG.BALL_COLORS[Math.floor(Math.random() * CONFIG.BALL_COLORS.length)];
      html += `<div class="gm-cap" style="left:${x}%;top:${y}%;--r:${Math.random() * 360}deg">${this.capsuleSVG(col2)}</div>`;
    }
    el.innerHTML = html;
  },

  /* ---------- 3. SCREEN: choose 1× or 5× ---------- */
  choose(n) {
    if (this.state !== 'select') return UI.toast('Finish this pull first!');
    this.pulls = n;
    document.querySelectorAll('.gm-pick').forEach(b => b.classList.toggle('on', +b.dataset.n === n));
    this.setMsg(`Insert ${n} coin${n > 1 ? 's' : ''}`);
  },
  setMsg(t) { document.getElementById('gm-msg').textContent = t; },

  /* ---------- 4. COIN SLOT ---------- */
  insertCoins() {
    if (this.state !== 'select') return;
    const n = this.pulls, slot = document.getElementById('gm-slot');
    if (!SAVE.spendCoins(n)) {
      slot.classList.remove('nope'); void slot.offsetWidth; slot.classList.add('nope');
      return UI.toast('Not enough coins — answer more calls! ☎');
    }
    this.state = 'paid';
    // decide results now and save them straight away (safe if the page closes)
    this.results = Array.from({ length: n }, () => this.roll());
    this.results.forEach(key => SAVE.addSticker(key));
    PC.renderAuto();   // Auto Reply unlock progress
    this.turned = 0; this.dropped = 0;
    // coin animation(s)
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        const c = document.createElement('img');
        c.src = 'assets/ui/coin.svg'; c.className = 'gm-coin-anim';
        slot.appendChild(c); setTimeout(() => c.remove(), 600);
      }, i * 140);
    }
    setTimeout(() => {
      document.getElementById('gm').classList.add('knob-ready');
      this.setMsg(`Turn the knob ×${n}`);
      this.updateRounds();
    }, n * 140 + 300);
  },
  /* roll: pick a rarity by CONFIG rates, then a sticker of that rarity */
  roll() {
    let r = Math.random() * 100, rarity = 'N';
    for (const k of CONFIG.RARITY_ORDER) { if ((r -= CONFIG.RARITIES[k].rate) < 0) { rarity = k; break; } }
    let pool = CONFIG.STICKERS.filter(s => s.rarity === rarity);
    if (!pool.length && rarity === 'UR') pool = CONFIG.STICKERS.filter(s => s.rarity === CONFIG.UR_FALLBACK_FROM);
    if (!pool.length) pool = CONFIG.STICKERS;
    const s = pool[Math.floor(Math.random() * pool.length)];
    return CONFIG.key(s.id, rarity);
  },

  /* ---------- 5. KNOB — drag in a circle, or tap to auto-spin ---------- */
  bindKnob() {
    const wrap = document.getElementById('gm-knob-wrap');
    let lastA = 0, gesture = 0, down = false;
    const angleOf = e => {
      const r = wrap.getBoundingClientRect();
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
    };
    wrap.addEventListener('pointerdown', e => {
      if (this.state !== 'paid') {
        if (this.state === 'select') UI.toast('Insert coins first 🪙');
        return;
      }
      down = true; gesture = 0; lastA = angleOf(e); wrap.setPointerCapture(e.pointerId);
    });
    wrap.addEventListener('pointermove', e => {
      if (!down || this.state !== 'paid') return;
      const a = angleOf(e); let d = a - lastA;
      if (d > 180) d -= 360; if (d < -180) d += 360;
      lastA = a;
      if (d > 0) { gesture += d; this.setTurn(this.turned + d); }   // clockwise only
    });
    const up = () => {
      if (!down) return; down = false;
      if (this.state === 'paid' && gesture < 15) this.autoSpin();   // treated as a tap
    };
    wrap.addEventListener('pointerup', up);
    wrap.addEventListener('pointercancel', up);
  },
  setTurn(deg) {
    const max = this.pulls * 360;
    deg = Math.min(deg, max);
    const before = Math.floor(this.turned / 360);
    this.turned = deg;
    document.getElementById('gm-knob').style.transform = `rotate(${deg}deg)`;
    const glass = document.getElementById('gm-glass');
    glass.classList.add('jiggle'); clearTimeout(this._jT);
    this._jT = setTimeout(() => glass.classList.remove('jiggle'), 250);
    const after = Math.floor(deg / 360);
    for (let k = before; k < after; k++) this.dropBall();
    this.updateRounds();
    if (deg >= max) this.state = 'spinning';   // knob locks once all rounds are turned
  },
  autoSpin() {
    this.state = 'spinning';
    const start = this.turned, end = this.pulls * 360;
    const dur = CONFIG.KNOB_SPIN_MS * (end - start) / 360;
    const t0 = performance.now();
    const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const step = now => {
      const t = Math.min(1, (now - t0) / dur);
      // ease each full round separately so every turn feels like a "clunk"
      const rounds = (end - start) / 360, p = t * rounds, k = Math.floor(p), f = p - k;
      this.setTurn(t >= 1 ? end : start + (k + ease(f)) * 360);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },
  updateRounds() {
    const done = Math.min(this.pulls, Math.floor(this.turned / 360));
    document.getElementById('gm-rounds').innerHTML =
      Array.from({ length: this.pulls }, (_, i) => `<i class="${i < done ? 'on' : ''}"></i>`).join('');
  },

  /* ---------- 6. BALL DROPS INTO THE HOLD ---------- */
  dropBall() {
    const i = this.dropped++;
    const holder = document.getElementById('gm-hold-balls');
    const b = document.createElement('div');
    b.className = 'gm-ball';
    const spread = this.pulls === 1 ? 0 : (i - (this.pulls - 1) / 2) * 15;
    b.style.setProperty('--x', spread + '%');
    b.style.setProperty('--spin', (Math.random() > 0.5 ? 1 : -1) * (200 + Math.random() * 160) + 'deg');
    b.innerHTML = this.capsuleSVG(CONFIG.BALL_COLORS[i % CONFIG.BALL_COLORS.length], 100);
    holder.appendChild(b);
    if (this.dropped >= this.pulls) {
      setTimeout(() => {
        this.state = 'loaded';
        document.getElementById('gm').classList.remove('knob-ready');
        document.getElementById('gm').classList.add('hold-ready');
        this.setMsg('Tap the hold! ↓');
      }, 700);
    }
  },

  /* ---------- 7. OPEN HOLD → BLINDBOXES POP UP ---------- */
  openHold() {
    if (this.state !== 'loaded') return;
    this.state = 'reveal';
    const gm = document.getElementById('gm');
    gm.classList.remove('hold-ready');
    document.querySelectorAll('.gm-ball').forEach(b => b.classList.add('pop'));
    setTimeout(() => {
      document.getElementById('gm-hold-balls').innerHTML = '';
      this.showReveal();
    }, 380);
  },
  showReveal() {
    const row = document.getElementById('reveal-row'), layer = document.getElementById('reveal');
    row.innerHTML = ''; row.dataset.n = this.results.length;
    document.getElementById('reveal-title').textContent = 'Tear the flaps! ✂';
    layer.classList.remove('all-open');
    layer.classList.toggle('multi', this.results.length > 1);   // "Tear all" only for 5× pulls
    this.results.forEach((key, i) => row.appendChild(this.makeBox(key, i)));
    layer.classList.add('open');
  },
  makeBox(key, i) {
    const { s, rarity } = CONFIG.parse(key);
    const box = document.createElement('div');
    box.className = `bbox r-${rarity}`; box.style.setProperty('--d', i * 0.09 + 's');
    box.innerHTML = `<div class="bbox-glow"></div><div class="bbox-fig"></div>
      <img class="bbox-body" src="assets/gacha/box-body.svg" alt="" draggable="false">
      <img class="bbox-flap" src="assets/gacha/box-flap.svg" alt="" draggable="false">
      <div class="bbox-name">${STICKER.badge(rarity)}<span>${s.name}</span></div>`;
    box.querySelector('.bbox-fig').appendChild(STICKER.flat(key));
    // drag the flap upward (or tap) to tear it
    let y0 = null;
    box.addEventListener('pointerdown', e => { y0 = e.clientY; box.setPointerCapture(e.pointerId); });
    box.addEventListener('pointermove', e => {
      if (y0 === null || box.classList.contains('opened')) return;
      const dy = Math.min(0, e.clientY - y0);
      box.querySelector('.bbox-flap').style.transform = `translateY(${dy * 0.4}px) rotate(${dy * -0.15}deg)`;
      if (dy < -40) { y0 = null; this.tear(box); }
    });
    box.addEventListener('pointerup', () => {
      if (y0 === null) return; y0 = null;
      if (!box.classList.contains('opened')) this.tear(box);
      else UI.viewer(key);
    });
    return box;
  },
  tear(box) {
    if (box.classList.contains('opened')) return;
    box.querySelector('.bbox-flap').style.transform = '';
    box.classList.add('opened');
    if (document.querySelectorAll('.bbox:not(.opened)').length === 0) {
      setTimeout(() => {
        document.getElementById('reveal').classList.add('all-open');
        document.getElementById('reveal-title').textContent = 'Tap a sticker to spin it 360°';
      }, 600);
    }
  },
  /* tear every unopened box, one after another */
  tearAll() {
    [...document.querySelectorAll('.bbox:not(.opened)')].forEach((box, i) => setTimeout(() => this.tear(box), i * 140));
  },
  closeReveal() {
    document.getElementById('reveal').classList.remove('open');
    this.state = 'select'; this.turned = 0; this.dropped = 0;
    document.getElementById('gm-knob').style.transform = 'rotate(0deg)';
    document.getElementById('gm-rounds').innerHTML = '';
    this.setMsg(`Insert ${this.pulls} coin${this.pulls > 1 ? 's' : ''}`);
    BOOK.renderTray();
  },
};
