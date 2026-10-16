/* ================================================================
   SCENE 1 — OFFICE (player's reception desk)
   Interactive: plant, telephone (calls), photo frame, top loaders
   The monitor and its apps live in js/pc.js, call rules in js/calls.js
   ================================================================ */
const OFFICE = {

  /* ---------- 1. SETUP ---------- */
  init() {
    this.initPlant();
    this.initPhone();
    PC.init();
    this.initFrame();
    this.initTopLoaders();
    this.renderFrame();
    this.renderTopLoaders();
  },

  /* ---------- 2. POTTED PLANT — tap to shake leaves ---------- */
  initPlant() {
    const plant = document.getElementById('o-plant');
    plant.onclick = () => {
      plant.classList.remove('shake'); void plant.offsetWidth; plant.classList.add('shake');
    };
  },

  /* ---------- 3. TELEPHONE ----------
     The phone is the controller for CALLS (js/calls.js has the rules).
       handset / phone body : pick up a ringing call
       HOLD                 : hold / un-hold
       XFER                 : start transfer → type extension → XFER again
       END                  : hang up
     Auto Reply ON (monitor app) → calls are picked up and handled for you. */
  ringing: false,
  initPhone() {
    const phone = document.getElementById('o-phone');
    const keys = phone.querySelector('.o-phone-keys');
    // keypad: 1-9, *, 0, DEL (DEL = delete the last digit typed for a transfer)
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', 'DEL'].forEach(k => {
      const b = document.createElement('button'); b.textContent = k; b.dataset.key = k;
      if (k === 'DEL') b.className = 'o-key-del';
      keys.appendChild(b);
    });
    keys.addEventListener('click', e => { const k = e.target.dataset.key; if (k) this.pressKey(k); });
    phone.querySelector('.o-phone-fn').addEventListener('click', e => {
      const fn = e.target.dataset.fn;
      if (fn === 'hold') this.pressHold();
      if (fn === 'transfer') this.pressTransfer();
      if (fn === 'end') this.pressEnd();
    });
    // handset: lift it to answer a ringing call, tap it again to put the phone down (= END)
    document.getElementById('o-handset').onclick = () => (this.ringing ? this.pickUp() : this.putDown());
    phone.querySelectorAll('.o-phone-body, .o-phone-body-wide').forEach(el => el.onclick = () => this.ringing && this.pickUp());
    document.getElementById('o-call').addEventListener('click', e => {
      const b = e.target.closest('[data-reply]'); if (!b) return;
      if (b.dataset.reply === 'hold') this.pressHold();
      else this.showResult(CALLS.inform(b.dataset.reply));
    });
    setInterval(() => this.tick(), 1000);
    // ringing alert shown on the gacha / sticker book screens (tap = go to office)
    document.getElementById('ring-alert').onclick = () => SCENES.go(0);
    SCENES.onChange.push(() => this.renderAlert());
    this.scheduleRing();
  },
  isCallback() { return CALLS.call && CALLS.call.state === 'callback'; },

  /* ring → new call (or the same caller calling back after a bad transfer) */
  scheduleRing() {
    if (typeof TUTORIAL !== 'undefined' && TUTORIAL.active) return;   // the tutorial rings its own call
    const wait = CONFIG.RING_MIN_MS + Math.random() * (CONFIG.RING_MAX_MS - CONFIG.RING_MIN_MS);
    clearTimeout(this._ringT);
    this._ringT = setTimeout(() => { this._ringT = null; this.ring(); }, wait);
  },
  callActive() { const c = CALLS.call; return !!c && c.state !== 'done'; },
  ring(forceSpecial = false) {
    if (document.hidden) return this.scheduleRing();
    // never start a new call while one is still on the line or its result is showing
    if (!this.isCallback() && (this.callActive() || this.result)) return this.scheduleRing();
    if (!this.isCallback()) CALLS.newCall(forceSpecial);
    this.ringing = true; this.ringLeft = CONFIG.RING_TIMEOUT_S;
    document.getElementById('o-phone').classList.add('ringing');
    document.getElementById('o-phone').classList.remove('oncall', 'held');
    this.lcd(this.isCallback() ? 'CALL BACK' : 'INCOMING');
    this.renderCall(); PC.refresh(); this.renderAlert();
    // Auto Reply handles normal calls; Soso (special caller) always needs you
    if (SAVE.data.autoResponse && !CALLS.call.special) {
      clearTimeout(this._autoT);
      this._autoDue = Date.now() + CONFIG.AUTO_REPLY_DELAY_MS;
      const incoming = CALLS.call;
      this._autoT = setTimeout(() => { if (CALLS.call === incoming) this.autoHandle(); }, CONFIG.AUTO_REPLY_DELAY_MS);
    }
  },
  /* Auto Reply: pick up and handle the call for a smaller fixed bonus */
  autoHandle() {
    if (document.hidden) return;
    const c = CALLS.call;
    if (!SAVE.data.autoResponse || !c || c.special || c.state === 'done') return;
    clearTimeout(this._autoT); this._autoT = null; this._autoDue = 0;
    AUDIO.stopSamples('caller'); AUDIO.stopHold();
    this.ringing = false;
    const phone = document.getElementById('o-phone');
    phone.classList.remove('ringing', 'oncall', 'held'); phone.classList.add('answered');
    this.lcd('AUTO REPLY', 1000);
    CALLS.call = null;
    SAVE.data.calls.ok++;
    SAVE.earn(CONFIG.AUTO_REPLY_REWARD);
    UI.floatText('+$' + CONFIG.AUTO_REPLY_REWARD, phone);
    setTimeout(() => phone.classList.remove('answered'), 900);
    this.renderCall(); PC.refresh(); this.renderAlert();
    this.scheduleRing();
  },
  pickUp() {
    if (!this.ringing) return this.lcd(CALLS.call ? 'ON LINE' : 'NO CALL', 700);
    if (SAVE.data.autoResponse && CALLS.call && !CALLS.call.special) return this.autoHandle();
    clearTimeout(this._autoT);
    this.ringing = false;
    const phone = document.getElementById('o-phone');
    phone.classList.remove('ringing'); phone.classList.add('oncall');
    CALLS.pickUp();
    this.lcd('LINE 1');
    this.renderCall(); PC.refresh(); this.renderAlert();
    AUDIO.play('caller');
  },
  pressHold() {
    AUDIO.play("button");
    const st = CALLS.toggleHold();
    if (!st) return this.lcd(CALLS.call ? '----' : 'NO CALL', 700);
    document.getElementById('o-phone').classList.toggle('held', st === 'hold');
    this.lcd(st === 'hold' ? 'ON HOLD' : 'LINE 1');
    this.renderCall(); PC.refresh();
  },
  pressTransfer() {
    AUDIO.play("button");
    const r = CALLS.transferPress();
    if (r.done) return this.showResult(r);
    if (r.callback) {
      // wrong transfer: the line drops, then the caller rings back
      const phone = document.getElementById('o-phone');
      phone.classList.remove('oncall', 'held');
      this.lcd('CALL BACK');
      UI.toast('✗ ' + r.why);
      this.renderCall(); PC.refresh();
      clearTimeout(this._ringT);
      this._ringT = setTimeout(() => { this._ringT = null; this.ring(); }, 1500);
      return;
    }
    this.lcd(r.msg === 'XFER' ? 'XFER' : r.msg, r.msg === 'XFER' ? 0 : 700);
    this.renderCall();
  },
  pressKey(k) {
    AUDIO.play("dial", k);
    const c = CALLS.call;
    if (k === 'DEL') {
      if (c && c.state === 'xfer') { CALLS.backspace(); this.lcd(c.xferDigits || 'XFER'); this.renderCall(); }
      else this.lcd('DEL', 400);
      return;
    }
    if (c && c.state === 'xfer') { CALLS.digit(k); this.lcd(c.xferDigits || 'XFER'); this.renderCall(); }
    else this.lcd(k, 500);
  },
  /* END always puts the phone down and restarts it:
     ringing → call declined · on a call → hang up · stuck → reset */
  pressEnd() {
    clearTimeout(this._autoT);
    const phone = document.getElementById('o-phone');
    if (this.ringing) {
      this.ringing = false;
      phone.classList.remove('ringing');
      if (CALLS.call && CALLS.call.state !== 'done') {
        CALLS.call.state = 'live';
        return this.showResult(CALLS.finish(false, 'You declined the call', 'ENDED'));
      }
    }
    const r = CALLS.hangUp();
    if (r) return this.showResult(r);
    // nothing on the line: hard reset the phone
    phone.classList.remove('oncall', 'held', 'ringing', 'answered');
    if (!this.result) { CALLS.call = null; this.renderCall(); }
    clearTimeout(this._ringT); this._ringT = null;
    if (!this.result) this.scheduleRing();
    this.lcd('ENDED', 700); this.renderAlert();
  },
  /* tapping the lifted handset puts the phone down */
  putDown() {
    if (this.callActive()) return this.pressEnd();
    this.resetPhone();
    this.lcd(CALLS.call ? 'ON LINE' : 'NO CALL', 700);
  },
  /* safety net: handset back on the cradle and make sure another call is coming */
  resetPhone() {
    document.getElementById('o-phone').classList.remove('oncall', 'held');
    if (!this.ringing && !this.callActive() && !this.result && !this._ringT) this.scheduleRing();
  },
  tick() {
    if (document.hidden) return;
    // Recover after a hidden-tab timer, or Auto Reply enabled during a live call.
    const autoCall = CALLS.call;
    if (SAVE.data.autoResponse && autoCall && !autoCall.special && autoCall.state !== 'done') {
      if (!this.ringing || Date.now() >= (this._autoDue || 0)) return this.autoHandle();
    }
    if (this.ringing) {
      if (--this.ringLeft <= 0) {
        this.ringing = false;
        document.getElementById('o-phone').classList.remove('ringing');
        this.renderAlert();
        if (!CALLS.call) { this.renderCall(); return this.resetPhone(); }
        CALLS.call.state = 'live';
        return this.showResult(CALLS.finish(false, 'Missed call — nobody picked up', 'MISSED'));
      }
      return;
    }
    // watchdog: phone off the hook (or idle) with no call and nothing scheduled → recover
    if (!this.callActive() && !this.result) this.resetPhone();
    const r = CALLS.tick(1);
    if (r) return this.showResult(r);
    if (CALLS.call && CALLS.call.state !== 'done') this.renderPatience();
  },

  /* call finished → show result, reset phone, next call later */
  showResult(r) {
    if (!r) return;
    const phone = document.getElementById('o-phone');
    phone.classList.remove('oncall', 'held', 'ringing');
    this.lcd(r.msg, 1800);
    if (r.reward) UI.floatText('+$' + r.reward, phone);
    if (r.coins) UI.floatText(`+${r.coins} coins`, phone, '#d99a2b');
    this.result = r;
    this.renderAlert();
    this.renderCall(); PC.resetDraft(); PC.refresh();
    clearTimeout(this._resT);
    clearTimeout(this._ringT); this._ringT = null;
    const finished = CALLS.call;
    // after the result has been shown: clear THIS call, then start counting down to the next one
    this._resT = setTimeout(() => {
      if (CALLS.call === finished) CALLS.call = null;
      this.result = null; this.renderCall(); PC.refresh();
      this.scheduleRing();
    }, 4200);
  },
  /* ---------- RINGING ALERT (other screens) ----------
     shown while the phone rings and you are not on the office screen,
     unless Auto Reply will take the call anyway (Soso always alerts)        */
  renderAlert() {
    const el = document.getElementById('ring-alert'); if (!el) return;
    const c = CALLS.call;
    const autoTakes = SAVE.data.autoResponse && c && !c.special;
    const show = this.ringing && SCENES.index !== 0 && !autoTakes;
    el.classList.toggle('show', show);
    el.querySelector('span').textContent = c && c.special ? 'Soso is calling!' : 'Phone ringing!';
    document.querySelector('#nav-dots button')?.classList.toggle('ringing', show);
  },
  lcd(text, revertMs = 0) {
    const el = document.getElementById('o-phone-lcd');
    el.textContent = String(text).slice(0, 10);
    clearTimeout(this._lcdT);
    if (revertMs) this._lcdT = setTimeout(() => {
      const c = CALLS.call;
      el.textContent = this.ringing ? 'INCOMING' : !c || c.state === 'done' ? 'TINITOMO'
        : c.state === 'hold' ? 'ON HOLD' : c.state === 'xfer' ? (c.xferDigits || 'XFER') : 'LINE 1';
    }, revertMs);
  },

  /* ---------- 4. CALLER SPEECH BUBBLE ---------- */
  renderCall() {
    const box = document.getElementById('o-call'), c = CALLS.call, r = this.result;
    box.className = 'o-call';
    if (r) {
      box.classList.add('show', r.success ? 'good' : 'bad');
      box.innerHTML = `<div class="oc-result">${r.perfect ? '★ Perfect call!' : r.success ? '✓ Call handled' : '✗ Call failed'}
        ${r.reward ? `<b>+$${r.reward}</b>` : ''}${r.coins ? `<b class="oc-coins">+${r.coins} 🪙</b>` : ''}</div><p>${r.summary}</p>
        ${r.notes.length ? `<ul class="oc-notes">${r.notes.map(n => `<li>${n} (−$${CONFIG.MISTAKE_PENALTY})</li>`).join('')}</ul>` : ''}`;
      return;
    }
    if (!c || (this.ringing === false && c.state === 'ringing')) { box.innerHTML = ''; return; }
    box.classList.add('show', 'st-' + c.state);
    const head = `<div class="oc-head"><span class="oc-ava">☎</span><div><b>${c.caller.name}</b><small>${c.caller.org}</small></div><div class="oc-pat"><i></i></div></div>`;
    if (this.ringing) {
      box.innerHTML = `<div class="oc-ring">${c.state === 'callback' ? '📞 The caller is calling back — pick up and fix it!' : '📞 Incoming call — pick up the handset!'}</div>`;
      return;
    }
    if (c.state === 'callback') { box.innerHTML = head + `<p class="oc-line">…line dropped. Wait for the call back.</p>`; return; }
    if (c.state === 'hold') {
      box.innerHTML = head + `<p class="oc-line oc-music">♪ ♫ On hold… ♪</p>
        <p class="oc-hint">Check <b>Messenger</b> for the status of the right person (see <b>Memo</b>). Then <b>XFER</b>, or press <b>HOLD</b> again to talk to the caller.</p>`;
    } else if (c.state === 'xfer') {
      box.innerHTML = head + `<p class="oc-line">Transfer to extension: <span class="oc-digits">${(c.xferDigits || '').padEnd(4, '_')}</span></p>
        <p class="oc-hint">Type the extension on the keypad (see <b>Phone Book</b>), then press <b>XFER</b> again.</p>`;
    } else {
      box.innerHTML = head + `<p class="oc-line">“${c.line}”${c.note ? `<i class="oc-note">${c.note}</i>` : ''}</p>
        <div class="oc-replies">
          <button data-reply="hold"><span class="long">Please hold a moment</span><span class="short">Please hold</span></button>
          <button data-reply="later"><span class="long">They're not available — they'll call you back later</span><span class="short">They'll call you back later</span></button>
          <button data-reply="another-day"><span class="long">They're not in today — please call back another day</span><span class="short">Call back another day</span></button>
        </div>`;
    }
    this.renderPatience();
  },
  renderPatience() {
    const bar = document.querySelector('#o-call .oc-pat i'), c = CALLS.call;
    if (bar && c) {
      const p = Math.max(0, c.patience / CONFIG.CALLER_PATIENCE_S);
      bar.style.width = (p * 100) + '%';
      bar.style.background = p > .5 ? 'var(--mint-deep)' : p > .25 ? 'var(--butter)' : 'var(--pink-deep)';
    }
  },

  /* ---------- 5. PHOTO FRAME — favourite character ---------- */
  initFrame() {
    document.getElementById('o-frame').onclick = () => UI.picker({
      title: 'Favourite sticker photo', mode: 'favourite', current: SAVE.data.favourite,
      onPick: id => { SAVE.data.favourite = id; SAVE.save(); this.renderFrame(); },
    });
  },
  renderFrame() {
    const f = document.getElementById('o-frame'), img = f.querySelector('img');
    const id = SAVE.data.favourite;
    f.classList.toggle('filled', !!id);
    if (id) img.src = CONFIG.img(id);
  },

  /* ---------- 6. TOP LOADERS — stickers displayed in the shelf under the PC ---------- */
  initTopLoaders() {
    const wrap = document.getElementById('o-loaders');
    for (let i = 0; i < CONFIG.TOP_LOADER_SLOTS; i++) {
      const b = document.createElement('button');
      b.className = 'o-loader'; b.dataset.slot = i;
      b.innerHTML = '<div class="o-loader-card"></div><div class="o-loader-shine"></div>';
      b.onclick = () => this.tapLoader(i);
      wrap.appendChild(b);
    }
  },
  tapLoader(i) {
    const cur = SAVE.data.topLoaders[i];
    const set = key => { SAVE.data.topLoaders[i] = key; SAVE.save(); this.renderTopLoaders(); BOOK.renderTray(); };
    if (!cur) return UI.picker({ title: 'Put a sticker in the top loader', onPick: set });
    UI.viewer(cur, [
      { label: 'Swap', style: 'ghost', onClick: () => { UI.closeModal(); UI.picker({ title: 'Swap sticker', current: cur, onPick: set }); } },
      { label: 'Take out', style: 'ghost', onClick: () => { UI.closeModal(); set(null); } },
    ]);
  },
  renderTopLoaders() {
    document.querySelectorAll('.o-loader').forEach(b => {
      const key = SAVE.data.topLoaders[+b.dataset.slot];
      const card = b.querySelector('.o-loader-card');
      card.innerHTML = key ? '' : '<span>+</span>';
      b.className = 'o-loader' + (key ? ' filled r-' + CONFIG.parse(key).rarity : '');
      if (key) card.appendChild(STICKER.flat(key));
    });
  },
};
