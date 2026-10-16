/* ================================================================
   SCENES — horizontal scene slider
   Change scene by: dragging/swiping left-right, the edge arrows,
   the dots at the bottom, or ← → keys on PC.
   Elements with  data-nodrag  (knob, figurine viewer, blindboxes)
   keep their own drag and never move the scene.
   ================================================================ */
const SCENES = {
  index: 0,
  count: 0,
  track: null,
  onChange: [],           // other modules can listen: SCENES.onChange.push(fn)

  /* ---------- 1. SETUP ---------- */
  init(startIndex = 0) {
    this.track = document.getElementById('track');
    this.count = this.track.children.length;

    // dots
    const dots = document.getElementById('nav-dots');
    [...this.track.children].forEach((s, i) => {
      const b = document.createElement('button');
      b.innerHTML = `<i></i><span>${s.dataset.name}</span>`;
      b.onclick = () => this.go(i);
      dots.appendChild(b);
    });

    document.getElementById('nav-left').onclick = () => this.go(this.index - 1);
    document.getElementById('nav-right').onclick = () => this.go(this.index + 1);
    window.addEventListener('keydown', e => {
      if (UI.isModalOpen()) return;
      if (e.key === 'ArrowLeft') this.go(this.index - 1);
      if (e.key === 'ArrowRight') this.go(this.index + 1);
    });
    window.addEventListener('resize', () => this.go(this.index, false));

    this.bindDrag();
    this.go(startIndex, false);
  },

  /* ---------- 2. GO TO SCENE ---------- */
  go(i, animate = true) {
    i = Math.max(0, Math.min(this.count - 1, i));
    const changed = i !== this.index;
    this.index = i;
    this.track.classList.toggle('animate', animate);
    this.setOffset(0);
    document.getElementById('nav-left').classList.toggle('hidden', i === 0);
    document.getElementById('nav-right').classList.toggle('hidden', i === this.count - 1);
    [...document.getElementById('nav-dots').children].forEach((d, k) => d.classList.toggle('on', k === i));
    [...this.track.children].forEach((s, k) => s.classList.toggle('current', k === i));
    if (changed) {
      SAVE.data.lastScene = i; SAVE.save();
      this.onChange.forEach(fn => fn(CONFIG.SCENES[i]));
    }
  },

  /* moves the track; dx = live drag offset in px */
  setOffset(dx) {
    const w = window.innerWidth;
    this.track.style.transform = `translate3d(${-this.index * w + dx}px,0,0)`;
    // slight parallax: each scene's stage drifts a little slower than its background
    [...this.track.children].forEach((s, k) => {
      const rel = (k - this.index) * w + dx;              // scene position relative to screen
      s.querySelector('.stage').style.transform = `translate(-50%,-50%) translateX(${-rel * 0.12}px)`;
    });
  },

  /* ---------- 3. DRAG / SWIPE ---------- */
  bindDrag() {
    const vp = document.getElementById('viewport');
    let startX = 0, startY = 0, dx = 0, active = false, decided = false, horizontal = false, t0 = 0, pid = null;

    vp.addEventListener('pointerdown', e => {
      if (UI.isModalOpen() || e.target.closest('[data-nodrag]')) return;
      if (e.button !== undefined && e.button !== 0) return;
      active = true; decided = false; horizontal = false; dx = 0;
      startX = e.clientX; startY = e.clientY; t0 = performance.now(); pid = e.pointerId;
    });

    vp.addEventListener('pointermove', e => {
      if (!active || e.pointerId !== pid) return;
      const mx = e.clientX - startX, my = e.clientY - startY;
      if (!decided && Math.hypot(mx, my) > 8) {
        decided = true; horizontal = Math.abs(mx) > Math.abs(my);
        if (horizontal) { vp.setPointerCapture(pid); this.track.classList.remove('animate'); document.body.classList.add('dragging'); }
      }
      if (!horizontal) return;
      dx = mx;
      // rubber-band at the first / last scene
      if ((this.index === 0 && dx > 0) || (this.index === this.count - 1 && dx < 0)) dx *= 0.3;
      this.setOffset(dx);
    });

    const end = e => {
      if (!active || (e && e.pointerId !== pid)) return;
      active = false; document.body.classList.remove('dragging');
      if (!horizontal) return;
      const w = window.innerWidth, speed = dx / Math.max(1, performance.now() - t0);
      let next = this.index;
      if (dx < -w * CONFIG.SWIPE_THRESHOLD || speed < -CONFIG.SWIPE_FLICK_SPEED) next++;
      if (dx > w * CONFIG.SWIPE_THRESHOLD || speed > CONFIG.SWIPE_FLICK_SPEED) next--;
      this._justDragged = true; setTimeout(() => this._justDragged = false, 50);
      this.go(next);
    };
    vp.addEventListener('pointerup', end);
    vp.addEventListener('pointercancel', end);
    // a drag must not also count as a tap on whatever was under the finger
    vp.addEventListener('click', e => { if (this._justDragged) { e.stopPropagation(); e.preventDefault(); } }, true);
  },
};
