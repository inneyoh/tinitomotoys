/* ================================================================
   OFFLINE — Auto Reply keeps working while the game is closed
   A web page can't run after it is closed, so instead the game
   remembers when you left. When you come back (or return to the
   tab), Auto Reply pays for the calls it would have answered.
   Settings: CONFIG.OFFLINE (js/config.js)
   ================================================================ */
const OFFLINE = {

  /* ---------- 1. SETUP ---------- */
  init() {
    this.collect();                                   // game just opened
    setInterval(() => { if (!document.hidden && !this.away) this.stamp(); }, 15000);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.leave();
      else if (this.away) { this.away = false; this.collect(); }
    });
    window.addEventListener('pagehide', () => this.leave());
    window.addEventListener('pageshow', e => {
      if (e.persisted && this.away && !document.hidden) { this.away = false; this.collect(); }
    });
  },
  away: false,
  leave() { if (!this.away) { this.stamp(); this.away = true; } },
  stamp() { SAVE.data.lastSeen = Date.now(); SAVE.saveNow(); },

  /* ---------- 2. PAY FOR TIME AWAY ---------- */
  collect() {
    const O = CONFIG.OFFLINE, last = SAVE.data.lastSeen;
    this.stamp();
    if (!last || !SAVE.data.autoResponse || !PC.autoUnlocked()) return;
    const awayMs = Date.now() - last;
    const paidMs = Math.min(awayMs, O.MAX_HOURS * 3600000);
    const calls = Math.floor(paidMs / (O.CALL_EVERY_MIN * 60000));
    const cash = calls * O.REWARD;
    SAVE.data.calls.ok += calls;
    SAVE.earn(cash);
    SAVE.saveNow(); // Commit the reward before the popup; reload cannot pay twice.
    PC.renderStats();
    this.showWelcome(awayMs, calls, cash, awayMs > paidMs);
  },

  /* ---------- 3. WELCOME-BACK POP-UP ---------- */
  fmt(ms) {
    const m = Math.floor(ms / 60000), h = Math.floor(m / 60);
    return h ? `${h}h ${m % 60}m` : `${m}m`;
  },
  showWelcome(awayMs, calls, cash, capped) {
    UI.openModal(card => {
      card.innerHTML = `<div class="modal-title">🤖 Welcome back!<small>You were away ${this.fmt(awayMs)}</small></div>
        <p class="off-text">Auto Reply answered <b>${calls}</b> call${calls > 1 ? 's' : ''} while you were gone.</p>
        <div class="off-cash">+$${cash}</div>
        ${!calls ? `<p class="off-note">One call earns $${CONFIG.OFFLINE.REWARD} every ${CONFIG.OFFLINE.CALL_EVERY_MIN} minutes away.</p>` : ''}
        ${capped ? `<p class="off-note">Auto Reply works up to ${CONFIG.OFFLINE.MAX_HOURS} hours while you're away.</p>` : ''}
        <div class="modal-actions"></div>`;
      card.querySelector('.modal-actions').appendChild(UI.button('Collect', () => UI.closeModal()));
    });
  },
};
