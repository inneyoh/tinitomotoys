/* ================================================================
   PC — the office monitor and its apps
     Phone Book : staff titles, names and extensions
     Messenger  : staff status dots + send "who · purpose · action"
     Memo       : which keywords go to which staff member
     Auto Reply : ON = calls are picked up and handled for you
     Sticker Market : standalone app → js/market.js
   Apps open in a big window over the monitor ("zoomed in") so they
   stay readable on phones while the telephone remains reachable.
   ================================================================ */
const PC = {
  tab: 'messenger',
  chatWith: null,      // staff id open in Messenger
  mobileChat: false,
  isPhone() { return matchMedia('(orientation: portrait)').matches; },
  draft: { who: null, purpose: null, action: null },

  /* ---------- 1. SETUP ---------- */
  init() {
    const chat = document.createElement('section');
    chat.id = 'mobile-chat'; chat.setAttribute('data-nodrag', '');
    chat.innerHTML = `<div class="mobile-chat-bar"><button id="chat-back">‹ Staff</button><b>Messenger</b><button id="chat-close" aria-label="Close chat">×</button></div>
      <div id="mobile-chat-body" class="pc-body pc-messenger"></div>
      <div class="mobile-phone"><div id="mobile-phone-lcd"></div><div class="mobile-phone-actions"><button data-phone="hold">HOLD</button><button data-phone="transfer">XFER</button><button data-phone="end">END</button></div>
      <div id="mobile-dial">${['1','2','3','4','5','6','7','8','9','*','0','DEL'].map(k=>`<button data-digit="${k}">${k}</button>`).join('')}</div></div>`;
    document.body.appendChild(chat);
    document.getElementById('chat-back').onclick = () => this.leaveChat();
    document.getElementById('chat-close').onclick = () => this.close();
    chat.querySelector('.mobile-phone').onclick = e => {
      const digit = e.target.closest('[data-digit]');
      if (digit) OFFICE.pressKey(digit.dataset.digit);
      const action = e.target.closest('[data-phone]')?.dataset.phone;
      if (action === 'hold') OFFICE.pressHold();
      if (action === 'transfer') OFFICE.pressTransfer();
      if (action === 'end') OFFICE.pressEnd();
      this.refresh();
    };
    window.addEventListener('resize', () => { if (!this.isPhone() && this.mobileChat) this.leaveChat(); });
    if (!Object.keys(CALLS.statuses).length) CALLS.rollStatuses();
    const mon = document.getElementById('o-monitor');
    mon.querySelector('.o-screen-off').onclick = () => mon.classList.add('on');
    mon.querySelector('.o-apps').addEventListener('click', e => {
      const app = e.target.closest('.o-app'); if (!app) return;
      if (app.dataset.app === 'auto') this.toggleAuto();
      else this.open(app.dataset.app);
    });
    const panel = document.getElementById('pc-panel');
    panel.querySelector('.pc-close').onclick = () => this.close();
    panel.querySelector('.pc-tabs').addEventListener('click', e => {
      const t = e.target.closest('[data-tab]'); if (t) this.open(t.dataset.tab);
    });
    this.renderAuto();
    this.renderStats();
    MARKET.init();
    setInterval(() => this.clock(), 10000); this.clock();
  },

  /* ---------- 2. WINDOW ---------- */
  open(tab) {
    this.mobileChat = false; this.syncMobileChat();
    if (tab === 'market' && !MARKET.unlocked()) {
      return UI.toast(`🔒 Sticker Market unlocks when you own ${CONFIG.MARKET.UNLOCK_SAME_STICKER} of the same sticker (best: ${MARKET.bestCount()}/${CONFIG.MARKET.UNLOCK_SAME_STICKER})`);
    }
    this.tab = tab;
    document.getElementById('o-monitor').classList.add('on');
    document.getElementById('pc-panel').classList.add('open');
    this.render();
  },
  close() { this.mobileChat = false; this.syncMobileChat(); document.getElementById('pc-panel').classList.remove('open'); },
  leaveChat() { this.mobileChat = false; this.syncMobileChat(); this.render(); },
  syncMobileChat() {
    const open = this.mobileChat && this.isPhone() && this.tab === 'messenger';
    document.getElementById('mobile-chat')?.classList.toggle('open', open);
    document.body.classList.toggle('mobile-chat-open', open);
  },
  isOpen() { return document.getElementById('pc-panel').classList.contains('open'); },
  refresh() { if (this.isOpen()) this.render(); this.renderStats(); },
  render() {
    document.querySelectorAll('.pc-tabs [data-tab]').forEach(t => t.classList.toggle('on', t.dataset.tab === this.tab));
    // Sticker Market is a standalone app: its own title bar, no app tabs
    document.getElementById('pc-panel').classList.toggle('standalone', this.tab === 'market');
    this.syncMobileChat();
    const body = document.getElementById(this.mobileChat && this.isPhone() ? 'mobile-chat-body' : 'pc-body');
    const oldLog = body.querySelector('.pc-log');
    const scroll = oldLog ? {top:oldLog.scrollTop, bottom:oldLog.scrollHeight-oldLog.scrollTop-oldLog.clientHeight<24} : null;
    body.className = 'pc-body pc-' + this.tab;
    body.innerHTML = '';
    ({ phonebook: () => this.phonebook(body), messenger: () => this.messenger(body), memo: () => this.memo(body),
       market: () => MARKET.render(body) })[this.tab]();
    const log = body.querySelector('.pc-log');
    if (log && scroll && !scroll.bottom) log.scrollTop = scroll.top;
    const c = CALLS.call;
    document.getElementById('mobile-phone-lcd').textContent = !c || c.state === 'done' ? 'TINITOMO' : c.state === 'xfer' ? (c.xferDigits || 'ENTER EXTENSION') : c.state === 'hold' ? 'ON HOLD' : 'LINE 1';
    document.getElementById('mobile-dial').classList.toggle('open', c?.state === 'xfer');
  },
  icon(s) { return `<img class="pc-icon" src="assets/office/staff/${s.icon}.svg" alt="" draggable="false">`; },
  dot(id) { return `<i class="st-dot st-${CALLS.statuses[id] || 'offline'}"></i>`; },

  /* ---------- 3. PHONE BOOK ---------- */
  phonebook(body) {
    body.innerHTML = `<table class="pc-table"><thead><tr><th></th><th>Title</th><th>Name</th><th>Ext.</th></tr></thead><tbody>${
      CONFIG.STAFF.map(s => `<tr><td>${this.icon(s)}</td><td>${s.title}</td><td>${s.name}</td><td class="pc-ext">${s.ext}</td></tr>`).join('')
    }</tbody></table>`;
  },

  /* ---------- 4. MEMO (keywords) ---------- */
  memo(body) {
    body.innerHTML = `<p class="pc-note">Callers mention these words → transfer to:</p>` + CONFIG.STAFF.map(s =>
      `<div class="pc-memo-row"><div class="pc-memo-who">${this.icon(s)}<span>${s.title}<small>${s.name} · ext ${s.ext}</small></span></div>
       <div class="pc-memo-kw">${s.keywords.map(k => `<span>${k}</span>`).join('')}</div></div>`).join('');
  },

  /* ---------- 5. MESSENGER ---------- */
  messenger(body) {
    if (!this.chatWith) this.chatWith = CONFIG.STAFF[0].id;
    const s = CONFIG.staff(this.chatWith), st = CALLS.statuses[s.id] || 'offline';
    const c = CALLS.call, canSend = c && !['ringing', 'done', 'callback'].includes(c.state);
    // compose options stay fixed for one call
    if (c && !c.opts) {
      const others = CONFIG.CALLERS.filter(x => x.name !== c.caller.name).map(x => x.name);
      const kws = CONFIG.STAFF.flatMap(x => x.keywords).filter(k => k !== c.keyword);
      c.opts = {
        who: CALLS.shuffle([c.caller.name, ...CALLS.shuffle(others).slice(0, 2)]),
        purpose: CALLS.shuffle([c.keyword, ...CALLS.shuffle(kws).slice(0, 2)]),
      };
    }
    const chips = (field, list) => list.map(v => `<button class="pc-chip${this.draft[field] === v ? ' on' : ''}" data-f="${field}" data-v="${v}">${field === 'action' ? CONFIG.MESSAGE_ACTIONS[v] : v}</button>`).join('');
    const log = (CALLS.chats[s.id] || []).map(m => `<div class="pc-msg"><div class="pc-bubble">${m.text}${m.reaction ? `<b class="pc-react">${m.reaction}</b>` : ''}</div><small>${m.note}</small></div>`).join('');
    const callNote = c && !['ringing', 'done'].includes(c.state)
      ? `<div class="pc-callnote">📞 <b>${c.caller.name}</b> (${c.caller.org}): ${c.line.includes(c.keyword) ? c.line : `…about <b>${c.keyword}</b>`}</div>` : '';
    body.innerHTML = `${callNote}
      <div class="pc-staff">${CONFIG.STAFF.map(x => `<button class="pc-person${x.id === s.id ? ' on' : ''}" data-id="${x.id}">
          <span class="pc-ava">${this.icon(x)}${this.dot(x.id)}</span><small>${x.name}</small></button>`).join('')}</div>
      <div class="pc-chat-head">${this.icon(s)}<div><b>${s.name}</b> · ${s.title}<small>${this.dot(s.id)} ${CONFIG.STATUSES[st]}</small></div></div>
      <div class="pc-log">${log || '<p class="pc-empty">No messages yet</p>'}</div>
      ${canSend ? `<div class="pc-compose">
          <div class="pc-row"><label>Who</label>${chips('who', c.opts.who)}</div>
          <div class="pc-row"><label>Purpose</label>${chips('purpose', c.opts.purpose)}</div>
          <div class="pc-row"><label>Action</label>${chips('action', Object.keys(CONFIG.MESSAGE_ACTIONS))}</div>
          <button class="btn pc-send" ${this.draft.who && this.draft.purpose && this.draft.action ? '' : 'disabled'}>Send</button>
        </div>` : `<p class="pc-empty">Pick up a call first — then you can message staff about it.</p>`}`;
    body.querySelector('.pc-staff').onclick = e => { const p = e.target.closest('.pc-person'); if (p) {
      this.chatWith = p.dataset.id; this.resetDraft();
      if (this.isPhone()) this.mobileChat = true;
      this.render();
    } };
    body.querySelectorAll('.pc-chip').forEach(b => b.onclick = () => { this.draft[b.dataset.f] = b.dataset.v; this.render(); });
    const send = body.querySelector('.pc-send');
    if (send) send.onclick = () => {
      CALLS.sendMessage(s.id, this.draft.who, this.draft.purpose, this.draft.action, () => { this.refresh(); OFFICE.renderCall(); });
      this.draft = { who: null, purpose: null, action: null };
      this.render(); OFFICE.renderCall();
    };
    const lg = body.querySelector('.pc-log'); lg.scrollTop = lg.scrollHeight;
  },
  resetDraft() { this.draft = { who: null, purpose: null, action: null }; },

  /* ---------- 6. AUTO REPLY ---------- */
  autoUnlocked() { return SAVE.data.totalPulls >= CONFIG.AUTO_REPLY_UNLOCK_PULLS; },
  toggleAuto() {
    if (!this.autoUnlocked()) {
      return UI.toast(`🔒 Auto Reply unlocks after ${CONFIG.AUTO_REPLY_UNLOCK_PULLS} gacha pulls (${SAVE.data.totalPulls}/${CONFIG.AUTO_REPLY_UNLOCK_PULLS})`);
    }
    SAVE.data.autoResponse = !SAVE.data.autoResponse; SAVE.save(); this.renderAuto();
    AUDIO.syncRing();
    UI.toast(SAVE.data.autoResponse ? `Auto Reply ON — calls are handled for you (+$${CONFIG.AUTO_REPLY_REWARD} each) 🤖` : 'Auto Reply OFF — handle calls yourself for bigger bonuses');
    if (SAVE.data.autoResponse) OFFICE.autoHandle();
    else { clearTimeout(OFFICE._autoT); OFFICE._autoT = null; OFFICE._autoDue = 0; }
    OFFICE.renderAlert();
  },
  /* called on start-up and after every gacha pull */
  renderAuto() {
    const s = document.getElementById('o-auto-state');
    const unlocked = this.autoUnlocked();
    if (!unlocked && SAVE.data.autoResponse) { SAVE.data.autoResponse = false; SAVE.save(); }   // older saves
    if (unlocked && !SAVE.data.autoUnlockSeen) {
      SAVE.data.autoUnlockSeen = true; SAVE.save();
      if (this._booted) UI.toast('🤖 Auto Reply unlocked! Turn it on from the office monitor');
    }
    this._booted = true;
    s.closest('.o-app').classList.toggle('locked', !unlocked);
    s.textContent = !unlocked ? `🔒 ${SAVE.data.totalPulls}/${CONFIG.AUTO_REPLY_UNLOCK_PULLS}` : SAVE.data.autoResponse ? 'ON' : 'OFF';
    s.classList.toggle('on', SAVE.data.autoResponse);
    document.getElementById('o-phone').classList.toggle('auto-on', SAVE.data.autoResponse);
    this.renderMarketIcon();
  },
  /* Sticker Market icon: locked until 15 of the same sticker */
  renderMarketIcon() {
    const b = document.getElementById('o-market-state'), open = MARKET.unlocked();
    b.closest('.o-app').classList.toggle('locked', !open);
    b.textContent = open ? 'OPEN' : `🔒 ${Math.min(MARKET.bestCount(), CONFIG.MARKET.UNLOCK_SAME_STICKER)}/${CONFIG.MARKET.UNLOCK_SAME_STICKER}`;
    b.classList.toggle('on', open);
  },

  /* ---------- 7. DESKTOP BAR ---------- */
  renderStats() {
    const el = document.getElementById('o-stats');
    if (el) el.textContent = `✓${SAVE.data.calls.ok} ✗${SAVE.data.calls.bad}`;
  },
  clock() { document.getElementById('o-clock').textContent = new Date().toTimeString().slice(0, 5); },
};
