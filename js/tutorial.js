/* ================================================================
   TUTORIAL — guided first playthrough for new players
   Runs once on a brand-new save (no calls, no pulls yet).
   Each step spotlights one thing and either waits for the player to
   do it ("wait") or shows a Next button. A Skip button is always there.
   The first call is scripted so it always works the same way:
     caller asks about "Payroll" → Memo says HR (Nono, ext 003) →
     Nono is Available → HOLD, XFER, 003, XFER.
   Replay: TUTORIAL.start() (debug: Alt+T)
   ================================================================ */
const TUTORIAL = {
  active: false,
  i: 0,
  CALL: { target: 'hr', keyword: 'Payroll' },   // scripted first call

  /* ---------- 1. STEPS ---------- */
  steps() {
    const T = this.CALL, staff = CONFIG.staff(T.target);
    const call = () => CALLS.call;
    return [
      { title: 'Welcome to TiniTomo Toys! 🎀',
        text: `You're the new receptionist. <b>Answer calls</b> to earn money, then spend it on <b>sticker blindboxes</b> and fill your <b>sticker book</b>.` },
      { target: '#hud', title: 'Money & coins',
        text: `This is your cash and your coins. <b>1 coin = $${CONFIG.DOLLARS_PER_COIN}</b>. Coins pay for gacha pulls.` },
      { target: '#o-handset', title: 'The phone is ringing!', enter: () => this.ringScripted(),
        text: 'Tap the <b>handset</b> to answer the call.',
        wait: () => call() && call().state === 'live' },
      { target: '#o-call', title: 'Listen to the caller',
        text: `The highlighted word tells you what the call is about. 
        This call is about <b>${T.keyword}</b>.` },
      { target: '[data-fn="hold"]', title: 'Put them on hold',
        text: 'Always press <b>HOLD</b> before checking who can take the call.',
        wait: () => call() && call().state === 'hold' },
      { target: '.o-app[data-app="memo"]', title: 'Who handles it?', enter: () => document.getElementById('o-monitor').classList.add('on'),
        text: `Open <b>Memo</b> on the computer to see who handles "${T.keyword}".`,
        wait: () => PC.isOpen() && PC.tab === 'memo' },
      { target: '#pc-panel', title: 'Memo',
        text: `"${T.keyword}" is handled by <b>${staff.title}</b>, <b>${staff.name}</b>.`},
      { target: '.pc-tabs [data-tab="messenger"]', title: 'Check their status',
        text: `Open <b>Messenger</b> to see if ${staff.name} can take calls.`,
        wait: () => PC.isOpen() && PC.tab === 'messenger' },
      { target: `.pc-person[data-id="${T.target}"]`, title: 'Status dots',
        text: `${staff.name} has a <b class="tut-g">green dot = Available</b>, so you can transfer straight away.
          <ul class="tut-list">
            <li><i class="st-dot st-busy"></i> Busy → message “Call coming in now”, wait for 👍, then transfer</li>
            <li><i class="st-dot st-dnd"></i> Do Not Disturb → message “Call back when you are available”, un-HOLD, tell the caller to call back later</li>
            <li><i class="st-dot st-away"></i> Away → message, transfer if they come back, otherwise tell the caller to call back later</li>
            <li><i class="st-dot st-off-demo"></i> No dot (Offline) → un-HOLD, ask them to call back another day</li>
          </ul>` },
{target: '.pc-tabs [data-tab="phonebook"]',
 title: 'Phone Book',
text: `Open <b>Phone Book</b> to check <b>${staff.name}</b>'s extension.`, 
wait: () => PC.isOpen() && PC.tab === 'phonebook'},
{target: '#pc-body .pc-table',
title: 'Find the extension',
text: `Find <b>${staff.name}</b> in the Phone Book for their extension. Press <b>Next</b> when you are ready to transfer.`
},
   
      { target: '[data-fn="transfer"]', title: 'Transfer the call', enter: () => PC.close(),
        text: 'Press <b>XFER</b> to start a transfer.',
        wait: () => call() && call().state === 'xfer' },
      { target: ['.o-phone-keys', '[data-fn="transfer"]'], title: 'Dial the extension',
        text: `Type <b>${staff.ext.split('').join(' ')}</b> (${staff.name}'s extension), then press <b>XFER</b> again. DEL fixes a mistake.`,
        update: () => (call() && ['callback', 'ringing'].includes(call().state) || OFFICE.ringing)
          ? `Oops, wrong line! <b>Pick up</b> the handset again, press <b>HOLD</b>, then <b>XFER ${staff.ext} XFER</b>.` : null,
        wait: () => OFFICE.result && OFFICE.result.success },
      { target: '#hud', title: `Call answered! +$${CONFIG.CALL_REWARD}`,
        text: `Every correct call pays <b>$${CONFIG.CALL_REWARD}</b>. Mistakes cost <b>$${CONFIG.MISTAKE_PENALTY}</b> each, and missed or wrong calls pay nothing.` },
      { target: '#nav-right', title: 'Time to spend it!',
        text: 'Swipe left, or tap the <b>arrow</b>, to visit the gacha machine.',
        wait: () => SCENES.index === 1 },
      { target: '.gm-screen', title: '1 or 5 pulls',
        text: 'Choose <b>1×</b> (1 coin) or <b>5×</b> (5 coins). Let\'s start with 1×.' },
      { target: '#gm-slot', title: 'Insert coins',
        text: 'Tap the <b>COIN</b> slot.',
        wait: () => GACHA.state !== 'select' },
      { target: '#gm-knob-wrap', title: 'Turn the knob',
        text: 'Drag the knob round, or just <b>tap</b> it.',
        wait: () => GACHA.state === 'loaded' || GACHA.state === 'reveal' },
      { target: '#gm-hold', title: 'Your capsule!',
        text: 'Tap the <b>hold</b> to open it.',
        wait: () => document.getElementById('reveal').classList.contains('open') },
      { target: '#reveal-row', title: 'Tear it open',
        text: 'Swipe the flap <b>up</b> (or tap the box) to tear it.',
        wait: () => document.getElementById('reveal').classList.contains('all-open') },
      { target: '#reveal-row .bbox', title: 'Your sticker!',
        text: `Tap it to spin it <b>360°</b>. The foil on the back shows its rarity:
          <span class="tut-rar">${['N', 'R', 'SR', 'UR', 'LR'].map(r => STICKER.badge(r)).join(' ')}</span>
          blue → silver → gold → rainbow → diamond.` },
      { target: '#reveal-done', title: 'Collect',
        text: 'Tap <b>Collect</b> to keep your sticker.',
        wait: () => !document.getElementById('reveal').classList.contains('open') },
      { target: '#nav-right', title: 'Your sticker book',
        text: 'Swipe left, or tap the <b>arrow</b>, to open your sticker book.',
        wait: () => SCENES.index === 2 },
      { target: '.b-tray', title: 'Decorate!',
        text: 'Drag a sticker from here onto the page. Tap a placed sticker to <b>move</b>, <b>rotate ↻</b>, <b>remove ✕</b> or view it in <b>360°</b>.',
        wait: () => SAVE.data.book.some(p => p.length), next: true },
      { target: '#b-page', title: 'Complete a series',
        text: 'Put every sticker of a series on <b>one page</b> to unlock a special page background!' },
      { title: 'You\'re all set! ✨',
        text: `<ul class="tut-list">
            <li>🤖 <b>Auto Reply</b> unlocks after ${CONFIG.AUTO_REPLY_UNLOCK_PULLS} pulls. It answers calls for you, even while the game is closed.</li>
            <li>🏪 <b>Sticker Market</b> unlocks when you own ${CONFIG.MARKET.UNLOCK_SAME_STICKER} of one sticker. Trade spares for rarer ones.</li>
            <li>📞 Watch out for special callers…</li>
          </ul>Have fun!`, done: true },
    ];
  },

  /* ---------- 2. START / STOP ---------- */
  shouldAutoStart() {
    const d = SAVE.data;
    return !d.tutorialDone && !d.totalPulls && !(d.calls && (d.calls.ok || d.calls.bad));
  },
  start() {
    this.active = true; this.i = 0; this.list = this.steps();
    clearTimeout(OFFICE._ringT); OFFICE._ringT = null;   // no random calls during the tutorial
    UI.isModalOpen() && UI.closeModal();
    SCENES.go(0);
    this.build(); this.show();
    clearInterval(this._t); this._t = setInterval(() => this.tick(), 200);
  },
  finish() {
    this.active = false; clearInterval(this._t);
    document.getElementById('tut')?.remove();
    SAVE.data.tutorialDone = true; SAVE.save();
    if (!OFFICE.ringing && !OFFICE.callActive() && !OFFICE.result) OFFICE.scheduleRing();
  },
  /* the scripted first call (always Available, always the same keyword) */
  ringScripted() {
    if (CALLS.call || OFFICE.ringing) return;
    CALLS.scripted = this.CALL;
    OFFICE.ring();
  },

  /* ---------- 3. DRAW ---------- */
  build() {
    document.getElementById('tut')?.remove();
    const el = document.createElement('div');
    el.id = 'tut'; el.setAttribute('data-nodrag', '');
    el.innerHTML = `<div class="tut-hole"></div>
      <div class="tut-card"><div class="tut-step"></div><div class="tut-title"></div><div class="tut-text"></div>
        <div class="tut-actions"><button class="tut-skip">Skip tutorial</button><button class="btn tut-next">Next</button></div></div>`;
    document.body.appendChild(el);
    el.querySelector('.tut-skip').onclick = () => this.finish();
    el.querySelector('.tut-next').onclick = () => this.advance();
  },
  show() {
    const s = this.list[this.i], el = document.getElementById('tut');
    s.enter && s.enter();
    el.querySelector('.tut-step').textContent = `${this.i + 1} / ${this.list.length}`;
    el.querySelector('.tut-title').innerHTML = s.title;
    el.querySelector('.tut-text').innerHTML = s.text;
    const next = el.querySelector('.tut-next');
    next.textContent = s.done ? "Let's go!" : 'Next';
    next.style.display = (!s.wait || s.next) ? '' : 'none';
    el.querySelector('.tut-skip').style.display = s.done ? 'none' : '';
    el.classList.toggle('waiting', !!s.wait && !s.next);
    this.place();
  },
  advance() {
    const s = this.list[this.i];
    if (s.done) return this.finish();
    this.i++; this.show();
  },
  /* box around the target (a selector, or a list of selectors joined together) */
  rect(target) {
    if (!target) return null;
    const rs = [].concat(target).map(sel => [...document.querySelectorAll(sel)]
      .map(n => n.getBoundingClientRect()).find(r => r.width && r.height)).filter(Boolean);
    if (!rs.length) return null;
    const left = Math.min(...rs.map(r => r.left)), top = Math.min(...rs.map(r => r.top));
    const right = Math.max(...rs.map(r => r.right)), bottom = Math.max(...rs.map(r => r.bottom));
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  },
  /* spotlight the target + put the card above or below it */
  place() {
    const s = this.list[this.i], el = document.getElementById('tut'); if (!el) return;
    const hole = el.querySelector('.tut-hole'), card = el.querySelector('.tut-card');
    const r = this.rect(s.target), vw = innerWidth, vh = innerHeight;
    if (!r) {
      hole.className = 'tut-hole full';
      Object.assign(card.style, { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' });
      return;
    }
    const pad = 8;
    hole.className = 'tut-hole';
    Object.assign(hole.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
    const cw = Math.min(360, vw - 24), ch = card.offsetHeight || 160;
    let left = Math.min(Math.max(12, r.left + r.width / 2 - cw / 2), vw - cw - 12);
    let top = r.bottom + pad + 12;
    if (top + ch > vh - 12) top = r.top - pad - 12 - ch;       // no room below → above
    if (top < 12) top = Math.max(12, vh - ch - 12);             // tall target → bottom of screen
    Object.assign(card.style, { left: left + 'px', top: top + 'px', width: cw + 'px', transform: 'none' });
  },

  /* ---------- 4. LOOP ---------- */
  tick() {
    if (!this.active) return;
    const el = document.getElementById('tut'), s = this.list[this.i];
    el.classList.toggle('behind', UI.isModalOpen());   // let the 360° viewer show on top
    if (this.i >= 2 && this.i <= 12) {
      if (OFFICE.ringing) OFFICE.ringLeft = CONFIG.RING_TIMEOUT_S;            // no missed call
      if (CALLS.call) CALLS.call.patience = CONFIG.CALLER_PATIENCE_S;          // caller never hangs up
      if (!CALLS.call && !OFFICE.ringing && !OFFICE.result) { this.i = 2; this.show(); }   // lost it → ring again
    }
    if (s.update) { const msg = s.update(); el.querySelector('.tut-text').innerHTML = msg || s.text; }
    if (s.wait && s.wait()) return this.advance();
    this.place();
  },
};
