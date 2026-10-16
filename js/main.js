/* ================================================================
   MAIN — boot order + debug keys
   ================================================================ */
(function boot() {
  SAVE.load();
  AUDIO.init();
  UI.init();
  STICKER.preload();
  OFFICE.init();
  GACHA.init();
  BOOK.init();
  SCENES.init(SAVE.data.lastScene || 0);
  OFFLINE.init();   // Auto Reply pay for time spent away

  // stop iOS long-press menus / double-tap zoom inside the game
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault());

  /* ---------- DEBUG ---------- */
  if (!CONFIG.DEBUG) return;
  window.addEventListener('keydown', e => {
    if (!e.altKey) return;
    // Alt + S: force Soso's special call through the normal ringing flow.
    if (e.code === 'KeyS') {
      e.preventDefault();
      if (e.repeat) return;
      if (OFFICE.callActive() || OFFICE.ringing || OFFICE.result) {
        UI.toast('DEBUG: Finish the current call and close its result first');
        return;
      }
      clearTimeout(OFFICE._ringT); OFFICE._ringT = null;
      clearTimeout(OFFICE._autoT); OFFICE._autoT = null;
      SCENES.go(0);
      OFFICE.ring(true);
      UI.toast('DEBUG: Soso is calling!');
      return;
    }
    if (e.code === 'KeyM') { SAVE.earn(30); UI.toast("DEBUG +$30"); }
    if (e.code === 'KeyR' && confirm('Reset all saved data?')) SAVE.reset();
  });
  let holdT = null;
  const pill = document.getElementById('hud-money');
  pill.addEventListener('pointerdown', () => { holdT = setTimeout(() => { SAVE.earn(30); UI.toast("DEBUG +$30"); }, 2000); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => pill.addEventListener(ev, () => clearTimeout(holdT)));
})();
