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
    setInterval(() => this.stamp(), 15000);           // "still here" every 15s
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stamp(); else this.collect();
    });
    window.addEventListener('pagehide', () => this.stamp());
  },
  stamp() { SAVE.data.lastSeen = Date.now(); SAVE.saveNow(); },

  /* ---------- 2. PAY FOR TIME AWAY ---------- */
  collect() {
    const O = CONFIG.OFFLINE, last = SAVE.data.lastSeen;
    this.stamp();
    if (!last || !SAVE.data.autoResponse || !PC.autoUnlocked()) return;
    const awayMs = Date.now() - last;
    if (awayMs < O.MIN_AWAY_S * 1000) return;
    const paidMs = Math.min(awayMs, O.MAX_HOURS * 3600000);
    const calls = Math.floor(paidMs / (O.CALL_EVERY_MIN * 60000));
    if (!calls) return;
    const cash = calls * O.REWARD;
    SAVE.data.calls.ok += calls;
    SAVE.earn(cash);
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
        ${capped ? `<p class="off-note">Auto Reply works up to ${CONFIG.OFFLINE.MAX_HOURS} hours while you're away.</p>` : ''}
        <div class="modal-actions"></div>`;
      card.querySelector('.modal-actions').appendChild(UI.button('Collect', () => UI.closeModal()));
    });
  },
};
