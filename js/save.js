/* ================================================================
   SAVE — player data stored in the browser (localStorage)
   Everything the game remembers is inside SAVE.data.
   ================================================================ */
const SAVE = {
  KEY: 'tinitomo-gacha-rush-v1',   // never change this name: a new name = an empty save for every player
  VERSION: 2,

  /* ---------- 1. DEFAULT DATA (a brand-new player) ---------- */
  defaults() {
    return {
      version: this.VERSION,
      money: CONFIG.START_MONEY,      // current wallet in $
      totalEarned: 0,                 // lifetime $ earned
      totalPulls: 0,
      inventory: {},                  // { "space-momo:SR": 2, "space-momo:UR": 1 }
      book: Array.from({ length: CONFIG.BOOK_PAGES }, () => []),
      //  book[page] = [{ uid, key, x, y, rot, scale }]   x/y = 0..1 of the page
      topLoaders: Array(CONFIG.TOP_LOADER_SLOTS).fill(null),   // sticker keys
      favourite: null,                // sticker id shown in the photo frame
      autoResponse: false,            // office monitor app toggle
      lastSeen: 0,                    // last time the game was open (offline Auto Reply)
      bonusCoins: 0,                  // coins given directly (Soso calls)
      gachaPending: null,             // stickers in capsules not opened yet
      calls: { ok: 0, bad: 0 },       // calls handled well / badly (all time)
      lastScene: 0,
      lastPage: 0,
      seenThemes: {},                 // series backgrounds already celebrated
      marketUnlocked: false,          // Sticker Market app (PC)
      market: null,                   // { plans: [...], at: time offers were made }
      tutorialDone: false,            // finished or skipped the new-player tutorial
      parked: [],                     // book stickers whose sticker is missing from CONFIG (kept, not lost)
    };
  },

  data: null,
  BACKUP_KEY: 'tinitomo-gacha-rush-v1-backup',   // last save that loaded fine
  resetting: false,

  /* ---------- 2. LOAD (+ upgrade old saves) ----------
     Updates must never wipe progress, so loading is forgiving:
     - a broken main save falls back to the backup copy
     - new fields get their default value, old fields are kept
     - a field with a wrong type is fixed on its own, never the whole save
     - only the very old figurine save (v1) is converted                  */
  load() {
    const read = key => { try { const v = JSON.parse(localStorage.getItem(key)); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } };
    let stored = read(this.KEY);
    if (!stored) stored = read(this.BACKUP_KEY);          // main save missing / corrupt → backup
    if (stored && stored.version === 1) stored = this.migrate(stored);
    this.data = this.repair(stored || {});
    if (stored) this.backup();                            // remember this good save
    this.persist();
    return this.data;
  },
  /* defaults + stored values, each field checked so one bad value can't break the game */
  repair(stored) {
    const d = this.defaults();
    const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
    Object.keys(stored).forEach(k => {
      const v = stored[k];
      if (v === undefined || v === null && d[k] !== null) return;
      if (k in d && d[k] !== null && typeof d[k] !== typeof v) return;      // wrong type → keep default
      if (Array.isArray(d[k]) && !Array.isArray(v)) return;
      d[k] = v;                                                             // unknown keys are kept too
    });
    d.version = this.VERSION;
    if (!Number.isFinite(d.money)) d.money = CONFIG.START_MONEY;
    if (!isObj(d.inventory)) d.inventory = {};
    if (!isObj(d.calls)) d.calls = { ok: 0, bad: 0 };
    // book + top loaders: stickers missing from CONFIG (renamed / removed for now) are parked
    // in d.parked instead of deleted, and put back automatically once the sticker exists again
    const known = k => typeof k === 'string' && !!CONFIG.parse(k).s;
    const parked = Array.isArray(d.parked) ? d.parked : [];
    const b = (Array.isArray(d.book) ? d.book : []).map(p => Array.isArray(p) ? p : []);
    while (b.length < CONFIG.BOOK_PAGES) b.push([]);
    b.slice(CONFIG.BOOK_PAGES).forEach((p, i) => p.forEach(st => parked.push({ page: CONFIG.BOOK_PAGES + i, st })));
    d.book = b.slice(0, CONFIG.BOOK_PAGES).map((p, i) => p.filter(st => {
      if (st && known(st.key)) return true;
      if (st) parked.push({ page: i, st });
      return false;
    }));
    d.parked = parked.filter(e => {
      if (e.st && known(e.st.key) && e.page < CONFIG.BOOK_PAGES) { d.book[e.page].push(e.st); return false; }
      return true;
    });
    d.topLoaders = this.fit(d.topLoaders, CONFIG.TOP_LOADER_SLOTS).map(k => known(k) ? k : null);
    if (d.favourite && !CONFIG.sticker(d.favourite)) d.favourite = null;
    return d;
  },
  /* v1 (figurines) → v2 (stickers): Momo/Soso figurines become their SR stickers */
  migrate(old) {
    const map = { momo: 'space-momo', soso: 'supermart-soso' };
    const inv = {};
    Object.entries(old.inventory || {}).forEach(([k, n]) => { if (map[k]) inv[CONFIG.key(map[k], 'SR')] = n; });
    return {
      money: old.money, totalEarned: old.totalEarned || 0, totalPulls: old.totalPulls || 0,
      inventory: inv, favourite: map[old.favourite] || null,
      autoResponse: !!old.autoResponse, lastScene: old.lastScene || 0, version: this.VERSION,
    };
  },
  fit(arr, n) { const a = (Array.isArray(arr) ? arr : []).slice(0, n); while (a.length < n) a.push(null); return a; },
  /* ask the browser not to clear this site's storage when space is low */
  persist() { try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {} },
  backup() { if (this.resetting || !this.data) return; try { localStorage.setItem(this.BACKUP_KEY, JSON.stringify(this.data)); } catch (e) {} },

  /* ---------- 3. SAVE (debounced so rapid changes write once) ---------- */
  _t: null,
  save() {
    clearTimeout(this._t);
    this._t = setTimeout(() => this.saveNow(), 150);
  },
  saveNow() {
    if (this.resetting || !this.data) return;     // a reset must not be undone by the closing page
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { /* storage full / blocked */ }
  },
  /* wipe this game's save (both copies) and start again */
  reset() {
    this.resetting = true; clearTimeout(this._t);
    try { localStorage.removeItem(this.KEY); localStorage.removeItem(this.BACKUP_KEY); } catch (e) {}
    location.reload();
  },

  /* ---------- 4. MONEY & COINS ---------- */
  /* coins = cash ÷ coin price + bonus coins (Soso's gift, no cash) */
  coins() { return Math.floor(this.data.money / CONFIG.DOLLARS_PER_COIN) + (this.data.bonusCoins || 0); },
  giveCoins(n) { this.data.bonusCoins = (this.data.bonusCoins || 0) + n; this.save(); UI.updateHud(true); },
  earn(dollars) {
    this.data.money += dollars;
    this.data.totalEarned += dollars;
    this.save(); UI.updateHud(true);
  },
  spendCoins(n) {
    if (this.coins() < n) return false;
    const fromBonus = Math.min(n, this.data.bonusCoins || 0);   // bonus coins are used first
    this.data.bonusCoins = (this.data.bonusCoins || 0) - fromBonus;
    this.data.money -= (n - fromBonus) * CONFIG.DOLLARS_PER_COIN;
    this.save(); UI.updateHud(true);
    return true;
  },

  /* ---------- 5. STICKERS ---------- */
  addSticker(key) {
    this.data.inventory[key] = (this.data.inventory[key] || 0) + 1;
    this.data.totalPulls++;
    this.save();
  },
  /* market trades: add / remove stickers without counting as gacha pulls */
  giveSticker(key, n = 1) { this.data.inventory[key] = (this.data.inventory[key] || 0) + n; this.save(); },
  takeSticker(key, n = 1) { this.data.inventory[key] = Math.max(0, (this.data.inventory[key] || 0) - n); this.save(); },
  owned(key) { return this.data.inventory[key] || 0; },
  /* ever obtained (still true after trading every copy away) */
  obtained(key) { return key in this.data.inventory; },
  ownedKeys() {
    // sorted: rarest first, then pool order
    const order = k => { const p = CONFIG.parse(k); return CONFIG.RARITY_ORDER.indexOf(p.rarity) * 100 + CONFIG.STICKERS.indexOf(p.s); };
    return Object.keys(this.data.inventory).filter(k => this.data.inventory[k] > 0 && CONFIG.parse(k).s).sort((a, b) => order(a) - order(b));
  },
  placedCount(key) {
    let n = this.data.topLoaders.filter(k => k === key).length;
    this.data.book.forEach(p => p.forEach(st => { if (st.key === key) n++; }));
    return n;
  },
  available(key) { return this.owned(key) - this.placedCount(key); },
  totalOwned() { return Object.values(this.data.inventory).reduce((a, b) => a + b, 0); },
  ownsSticker(id) { return this.ownedKeys().some(k => k.startsWith(id + ':')); },
};

/* save when the tab is hidden / closed */
window.addEventListener('pagehide', () => { SAVE.saveNow(); SAVE.backup(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { SAVE.saveNow(); SAVE.backup(); } });
