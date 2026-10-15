/* ================================================================
   STICKER — how a sticker is drawn
     STICKER.flat(key)          → flat sticker (book pages, tray, top loaders)
     STICKER.create3D(key, el)  → spinning 360° sticker with a prismatic back
   Each sticker image set (assets/stickers/<id>/):
     front.png      die-cut art with white border
     mask.png       sticker outline (used for the foil back + shine)
     mask-back.png  same outline mirrored (for the back side)
   ================================================================ */
const STICKER = {
  active: null,      // the 3D sticker inside the viewer pop-up (if open)

  /* ---------- 1. SETTINGS ---------- */
  EDGE_LAYERS: 3,
  THICKNESS: 0.018,  // sticker depth as a fraction of its height
  DRAG_SPEED: 0.55,  // degrees per pixel dragged
  FRICTION: 0.94,    // spin slow-down after release
  AUTO_SPIN: 0.45,   // degrees per frame when idle

  _aspect: {},

  /* ---------- 2. PRISMATIC FOIL (CSS background for a rarity) ---------- */
  foil(rarity) {
    const c = CONFIG.RARITIES[rarity].foil.join(', ');
    const glitter = 'repeating-linear-gradient(55deg, rgba(255,255,255,0) 0 6px, rgba(255,255,255,.45) 7px, rgba(255,255,255,0) 9px)';
    const rainbow = rarity === 'UR'
      ? 'conic-gradient(from 0deg at 50% 50%, rgba(255,154,162,.45), rgba(255,245,168,.45), rgba(181,234,215,.45), rgba(159,216,255,.45), rgba(199,184,255,.45), rgba(255,154,162,.45)),'
      : rarity === 'LR'   // diamond / platinum: criss-cross facets + tiny glints over platinum
      ? 'repeating-linear-gradient(60deg, rgba(255,255,255,0) 0 14px, rgba(255,255,255,.9) 15px, rgba(255,255,255,0) 17px),' +
        'repeating-linear-gradient(-60deg, rgba(110,125,150,0) 0 14px, rgba(110,125,150,.55) 15px, rgba(110,125,150,0) 17px),' +
        'radial-gradient(circle at 30% 40%, #fff 0 1.6px, transparent 2.8px),' +
        'conic-gradient(from 45deg, rgba(255,255,255,.55) 0 25%, rgba(120,135,160,.28) 0 50%, rgba(255,255,255,.55) 0 75%, rgba(120,135,160,.28) 0),' +
        'conic-gradient(from 90deg, rgba(200,230,255,.35), rgba(255,220,245,.35), rgba(220,255,240,.35), rgba(200,230,255,.35)),' : '';
    return `${glitter}, ${rainbow} linear-gradient(115deg, ${c})`;
  },
  /* one size per background layer of foil() */
  foilSize(rarity) {
    return rarity === 'LR' ? '100% 100%, 100% 100%, 100% 100%, 19px 19px, 26px 26px, 300% 300%, 300% 300%'
                           : '100% 100%, 300% 300%, 300% 300%';
  },
  maskCss(id, file = 'mask') {
    const u = `url(${CONFIG.img(id, file)})`;
    return `-webkit-mask-image:${u};mask-image:${u};-webkit-mask-size:100% 100%;mask-size:100% 100%;`;
  },

  /* ---------- 3. FLAT STICKER ---------- */
  flat(key) {
    const { id, rarity } = CONFIG.parse(key);
    const d = document.createElement('div');
    d.className = `stk r-${rarity}`;
    d.innerHTML = `<img src="${CONFIG.img(id)}" alt="" draggable="false">` +
      (['LR', 'UR', 'SR'].includes(rarity) ? `<div class="stk-sheen" style="${this.maskCss(id)}"></div>` : '') +
      (rarity === 'LR' ? `<div class="stk-bubble" style="${this.maskCss(id)}"></div>` : '');   // puffy epoxy dome
    return d;
  },
  /* small rarity tag, e.g. <span class="rar r-SR">SR</span> */
  badge(rarity) { return `<span class="rar r-${rarity}">${rarity}</span>`; },

  /* ---------- 4. 3D STICKER (viewer) ---------- */
  create3D(key, container, { autoSpin = true } = {}) {
    const self = this;
    const { id, rarity } = CONFIG.parse(key);
    const root = document.createElement('div');
    root.className = 'stk3d';
    container.appendChild(root);
    const state = { angle: -25, tilt: -6, vel: 0, dragging: false, idleAt: 0, raf: 0, dead: false, t: 0 };
    let spin, back, sheen;

    this._loadAspect(id).then(aspect => {
      if (state.dead) return;
      const H = Math.min(container.clientHeight * 0.78, container.clientWidth * 0.82 / aspect);
      const W = H * aspect, D = Math.max(3, H * self.THICKNESS * (rarity === 'LR' ? 3 : 1));   // LR = thick bubble sticker
      root.innerHTML = `<div class="stk3d-shadow" style="width:${W * 0.8}px"></div><div class="stk3d-spin"></div>`;
      spin = root.querySelector('.stk3d-spin');
      spin.style.width = W + 'px'; spin.style.height = H + 'px';
      let html = '';
      for (let i = 0; i < self.EDGE_LAYERS; i++) {
        const z = -D / 2 + (D * (i + 0.5)) / self.EDGE_LAYERS;
        html += `<div class="stk3d-layer stk3d-edge${rarity === 'LR' ? ' resin' : ''}" style="${self.maskCss(id)}transform:translateZ(${z.toFixed(2)}px)"></div>`;
      }
      html += `<img class="stk3d-layer stk3d-face" src="${CONFIG.img(id)}" style="transform:translateZ(${D / 2}px)" draggable="false">`;
      html += `<div class="stk3d-layer stk3d-face stk3d-sheen r-${rarity}" style="${self.maskCss(id)}transform:translateZ(${D / 2 + 0.4}px)"></div>`;
      if (rarity === 'LR') html += `<div class="stk3d-layer stk3d-face stk3d-bubble" style="${self.maskCss(id)}transform:translateZ(${D / 2 + 0.8}px)"></div>`;
      html += `<div class="stk3d-layer stk3d-face stk3d-back r-${rarity}" style="${self.maskCss(id, 'mask-back')}transform:rotateY(180deg) translateZ(${D / 2}px);background:${self.foil(rarity)};background-size:${self.foilSize(rarity)}">
                 <div class="stk3d-back-logo" style="font-size:${H * 0.075}px">TiniTomo<b style="font-size:${H * 0.16}px">${rarity}</b></div></div>`;
      spin.innerHTML = html;
      back = spin.querySelector('.stk3d-back'); sheen = spin.querySelector('.stk3d-sheen');
      render();
    });

    /* render: rotate + move the foil highlight with the angle */
    function render() {
      if (!spin) return;
      spin.style.transform = `translateY(${Math.sin(state.t / 600) * 6}px) rotateX(${state.tilt}deg) rotateY(${state.angle}deg)`;
      const a = ((state.angle % 360) + 360) % 360;
      const p = (a / 360) * 100;
      back.style.backgroundPosition = `0 0, ${p}% ${50 + state.tilt}%, ${100 - p}% ${50 - state.tilt}%`;
      back.style.filter = `brightness(${(1.05 - 0.15 * Math.cos(a * Math.PI / 180)).toFixed(3)})`;
      sheen.style.backgroundPosition = `${(p * 3) % 300}% 0`;
      sheen.style.opacity = (0.25 + 0.35 * Math.abs(Math.sin(a * Math.PI / 180))).toFixed(2);
      const bubble = spin.querySelector('.stk3d-bubble');   // dome highlight slides as it turns
      if (bubble) bubble.style.setProperty('--hx', (30 - Math.sin(a * Math.PI / 180) * 25).toFixed(1) + '%');
    }
    function loop(t) {
      if (state.dead) return;
      state.t = t;
      if (!state.dragging) {
        if (Math.abs(state.vel) > 0.05) { state.angle += state.vel; state.vel *= self.FRICTION; state.idleAt = t; }
        else if (autoSpin && t - state.idleAt > 1400) state.angle += self.AUTO_SPIN;
        state.tilt += (-6 - state.tilt) * 0.06;
      }
      render();
      state.raf = requestAnimationFrame(loop);
    }
    state.raf = requestAnimationFrame(loop);

    /* drag to spin */
    let lx = 0, ly = 0, lt = 0;
    container.addEventListener('pointerdown', e => {
      state.dragging = true; state.vel = 0; lx = e.clientX; ly = e.clientY; lt = performance.now();
      container.setPointerCapture(e.pointerId);
    });
    container.addEventListener('pointermove', e => {
      if (!state.dragging) return;
      const dx = e.clientX - lx, dy = e.clientY - ly, now = performance.now();
      state.angle += dx * self.DRAG_SPEED;
      state.tilt = Math.max(-30, Math.min(20, state.tilt - dy * 0.25));
      state.vel = (dx * self.DRAG_SPEED) * Math.min(1, 16 / Math.max(1, now - lt));
      lx = e.clientX; ly = e.clientY; lt = now;
    });
    const up = () => { state.dragging = false; state.idleAt = performance.now(); };
    container.addEventListener('pointerup', up);
    container.addEventListener('pointercancel', up);

    return { el: root, destroy() { state.dead = true; cancelAnimationFrame(state.raf); root.remove(); } };
  },

  /* ---------- 5. HELPERS ---------- */
  _loadAspect(id) {
    if (this._aspect[id]) return Promise.resolve(this._aspect[id]);
    return new Promise(res => {
      const img = new Image();
      img.onload = () => res(this._aspect[id] = img.naturalWidth / img.naturalHeight);
      img.onerror = () => res(0.8);
      img.src = CONFIG.img(id);
    });
  },
  preload() {
    CONFIG.STICKERS.forEach(s => ['front', 'mask', 'mask-back'].forEach(f => { new Image().src = CONFIG.img(s.id, f); }));
  },
};
