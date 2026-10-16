/* ================================================================
   SAVE — player data stored in the browser (localStorage)
   Everything the game remembers is inside SAVE.data.
   ================================================================ */
const SAVE = {
  KEY: 'tinitomo-gacha-rush-v1',
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
    };
  },

  data: null,

  /* ---------- 2. LOAD (+ upgrade old saves) ---------- */
  load() {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(this.KEY)); } catch (e) { /* private mode etc. */ }
    const d = this.defaults();
    if (stored && stored.version !== this.VERSION) stored = this.migrate(stored);
    this.data = stored ? Object.assign(d, stored) : d;
    // keep array sizes correct if config changes
    const b = this.data.book.slice(0, CONFIG.BOOK_PAGES);
    while (b.length < CONFIG.BOOK_PAGES) b.push([]);
    this.data.book = b;
    this.data.topLoaders = this.fit(this.data.topLoaders, CONFIG.TOP_LOADER_SLOTS);
    if (this.data.favourite && !CONFIG.sticker(this.data.favourite)) this.data.favourite = null;
    return this.data;
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
  fit(arr, n) { const a = (arr || []).slice(0, n); while (a.length < n) a.push(null); return a; },

  /* ---------- 3. SAVE (debounced so rapid changes write once) ---------- */
  _t: null,
  save() {
    clearTimeout(this._t);
    this._t = setTimeout(() => this.saveNow(), 150);
  },
  saveNow() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { /* storage full / blocked */ }
  },
  reset() {
    try { localStorage.removeItem(this.KEY); } catch (e) {}
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
window.addEventListener('pagehide', () => SAVE.data && SAVE.saveNow());
document.addEventListener('visibilitychange', () => document.hidden && SAVE.data && SAVE.saveNow());
