/* ================================================================
   MARKET — "Sticker Market" app on the office PC
   (spec: Scene1_Gameplay → e. Sticker Market)

   • Unlocks once the player owns 15 of the same sticker (stays unlocked).
   • Standalone app: opens in its own window, no Phone Book / Messenger /
     Memo tabs.
   • Exchange spare low-rarity stickers for rarer ones:
        R  = 20 N
        SR = 20 R  or  40 N
        UR = 30 of the SAME SR  (you get the UR edition of that sticker)
   • 5 offers at a time; 3% chance of a 6th SPECIAL offer at 20% off.
   • Offers refresh every 10 minutes, or as soon as all are traded.
   Only FREE copies can be traded (not ones in the sticker book or top loaders).
   ================================================================ */
const MARKET = {

  /* ---------- 1. UNLOCK ---------- */
  bestCount() { return Math.max(0, ...Object.values(SAVE.data.inventory)); },
  unlocked() {
    // Inventory is credited before unboxing; wait for the entire pull to reveal.
    if (!SAVE.data.marketUnlocked && SAVE.data.gachaPending?.length) {
      this._booted = true;
      return false;
    }
    if (!SAVE.data.marketUnlocked && this.bestCount() >= CONFIG.MARKET.UNLOCK_SAME_STICKER) {
      SAVE.data.marketUnlocked = true; SAVE.save();
      if (this._booted) UI.toast('🏪 Sticker Market unlocked! Trade spare stickers on the office PC');
    }
    this._booted = true;
    return !!SAVE.data.marketUnlocked;
  },

  /* ---------- 2. OFFERS ---------- */
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  makePlan(special = false) {
    const M = CONFIG.MARKET;
    const total = M.RECIPES.reduce((a, r) => a + r.weight, 0);
    let roll = Math.random() * total, rec = M.RECIPES[0];
    for (const r of M.RECIPES) { if ((roll -= r.weight) < 0) { rec = r; break; } }
    const ofRarity = r => CONFIG.STICKERS.filter(s => s.rarity === r);
    let give, get;
    if (rec.same) {                             // UR: 30 of the same SR → its UR edition
      const s = this.pick(ofRarity(rec.give));
      give = CONFIG.key(s.id, rec.give); get = CONFIG.key(s.id, rec.get);
    } else {
      const target = ofRarity(rec.get).length ? this.pick(ofRarity(rec.get)) : null;
      if (!target) return this.makePlan(special);
      give = CONFIG.key(this.pick(ofRarity(rec.give)).id, rec.give);
      get = CONFIG.key(target.id, rec.get);
    }
    const qty = special ? Math.ceil(rec.qty * (1 - M.SPECIAL_DISCOUNT)) : rec.qty;
    return { give, qty, fullQty: rec.qty, get, special, done: false };
  },
  generate() {
    const plans = Array.from({ length: CONFIG.MARKET.PLANS }, () => this.makePlan());
    if (Math.random() < CONFIG.MARKET.SPECIAL_CHANCE) plans.push(this.makePlan(true));
    SAVE.data.market = { plans, at: Date.now() };
    SAVE.save();
  },
  msLeft() {
    const m = SAVE.data.market;
    return m ? m.at + CONFIG.MARKET.REFRESH_MIN * 60000 - Date.now() : 0;
  },
  /* refresh when the timer runs out or every offer has been traded */
  ensureFresh() {
    const m = SAVE.data.market;
    if (!m || !m.plans || this.msLeft() <= 0 || m.plans.every(p => p.done)) { this.generate(); return true; }
    return false;
  },

  /* ---------- 3. TRADE ---------- */
  canTrade(p) { return !p.done && SAVE.available(p.give) >= p.qty; },
  trade(i) {
    const p = SAVE.data.market.plans[i];
    if (!p || !this.canTrade(p)) return;
    SAVE.takeSticker(p.give, p.qty);
    SAVE.giveSticker(p.get);
    p.done = true; SAVE.save();
    BOOK.renderTray(); OFFICE.renderTopLoaders();
    const { s, rarity } = CONFIG.parse(p.get);
    UI.toast(`Traded! You got ${s.name} (${rarity}) ✨`);
    if (SAVE.data.market.plans.every(x => x.done)) {
      this.generate();
      setTimeout(() => UI.toast('🏪 All offers traded — new offers are in!'), 1900);
    }
    PC.refresh();
    UI.viewer(p.get);
  },

  /* ---------- 4. DRAW (inside the PC window) ---------- */
  fmt(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; },
  render(body) {
    this.ensureFresh();
    const plans = SAVE.data.market.plans;
    body.innerHTML = `<div class="mk-head"><span>Trade spare stickers for rarer ones</span>
        <span class="mk-timer">New offers in <b id="mk-time">${this.fmt(this.msLeft())}</b></span></div>
      <div class="mk-list"></div>`;
    const list = body.querySelector('.mk-list');
    plans.forEach((p, i) => {
      const g = CONFIG.parse(p.give), t = CONFIG.parse(p.get), free = SAVE.available(p.give);
      // stickers the player has never obtained stay a mystery: silhouette + "???"
      const gKnown = SAVE.obtained(p.give), tKnown = SAVE.obtained(p.get);
      const card = document.createElement('div');
      card.className = 'mk-card' + (p.special ? ' special' : '') + (p.done ? ' done' : '');
      card.innerHTML = `${p.special ? '<b class="mk-tag">SPECIAL −20%</b>' : ''}
        <div class="mk-side"><div class="mk-art${gKnown ? '' : ' unknown'}"></div><div class="mk-info">
          <b class="mk-qty">×${p.qty}${p.special ? ` <s>×${p.fullQty}</s>` : ''}</b>
          <span>${STICKER.badge(g.rarity)} ${gKnown ? g.s.name : '???'}</span>
          <small class="${free >= p.qty ? 'ok' : ''}">You have ${free} free</small></div></div>
        <div class="mk-arrow">➜</div>
        <div class="mk-side"><div class="mk-art${tKnown ? '' : ' unknown'}"></div><div class="mk-info">
          <b class="mk-qty">×1</b><span>${STICKER.badge(t.rarity)} ${tKnown ? t.s.name : '???'}</span>
          <small>${t.r.label}</small></div></div>
        <button class="btn mk-trade" ${this.canTrade(p) ? '' : 'disabled'}>${p.done ? 'Traded ✓' : 'Trade'}</button>`;
      const arts = card.querySelectorAll('.mk-art');
      arts[0].appendChild(STICKER.flat(p.give)); arts[1].appendChild(STICKER.flat(p.get));
      card.querySelector('.mk-trade').onclick = () => this.trade(i);
      list.appendChild(card);
    });
  },

  /* ---------- 5. TIMER (runs every second) ---------- */
  tick() {
    if (!SAVE.data.marketUnlocked || !SAVE.data.market) return;
    const refreshed = this.msLeft() <= 0 && this.ensureFresh();
    if (!PC.isOpen() || PC.tab !== 'market') return;
    if (refreshed) { PC.render(); UI.toast('🏪 New offers in the Sticker Market!'); return; }
    const el = document.getElementById('mk-time');
    if (el) el.textContent = this.fmt(this.msLeft());
  },
  init() { setInterval(() => this.tick(), 1000); },
};
