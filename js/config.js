/* ================================================================
   CONFIG — every tweakable number / list lives here
   ================================================================ */
const CONFIG = {

  /* ---------- 1. ECONOMY ---------- */
  DOLLARS_PER_COIN: 6,        // 1 coin = $6  (5 coins = $30)
  START_MONEY: 50,            // money given to a brand-new save (for testing)

  /* ---------- 2. OFFICE ---------- */
  RING_MIN_MS: 4000,          // shortest wait before the next call rings
  RING_MAX_MS: 9000,          // longest wait
  RING_TIMEOUT_S: 15,         // ring this long without pick-up = missed call
  AUTO_REPLY_DELAY_MS: 900,   // how fast Auto Reply picks up a ringing phone
  TOP_LOADER_SLOTS: 3,        // top loaders standing in the shelf under the PC

  /* ---------- 2b. CALL GAMEPLAY ---------- */
  CALL_REWARD: 8,             // $ for a call handled correctly (performance bonus)
  MISTAKE_PENALTY: 3,         // $ taken off that call's reward per mistake
  AUTO_REPLY_REWARD: 2,       // $ per call when Auto Reply handles it for you
  AUTO_REPLY_UNLOCK_PULLS: 30, // Auto Reply stays locked until this many gacha pulls
  CALLER_PATIENCE_S: 90,      // caller hangs up after this long
  AWAY_RETURN_CHANCE: 0.5,    // chance an "Away" staff comes back after your message
  REPLY_DELAY_MS: [1200, 2400],   // how long staff take to react 👍
  AWAY_RETURN_MS: [3000, 6000],   // how long an Away staff takes to come back
  /* how often each status appears (relative weights) */
  STATUS_WEIGHTS: { available: 35, busy: 25, dnd: 15, away: 15, offline: 10 },
  STATUSES: {
    available: 'Available',
    busy: 'Busy',
    dnd: 'Do Not Disturb',
    away: 'Away',
    offline: 'Offline',
  },

  /* ---------- 2d. STICKER MARKET (PC app) ----------
     give `qty` stickers of rarity `give` → get 1 sticker of rarity `get`
     same: true = must be the same sticker (SR → its UR edition)            */
  MARKET: {
    UNLOCK_SAME_STICKER: 15,  // own this many of one sticker to unlock the app
    PLANS: 5,                 // offers shown at a time
    SPECIAL_CHANCE: 0.03,     // chance of a 6th SPECIAL offer
    SPECIAL_DISCOUNT: 0.2,    // special offer needs 20% fewer stickers
    REFRESH_MIN: 10,          // new offers every 10 minutes (or when all traded)
    RECIPES: [
      { get: 'R',  give: 'N',  qty: 20, weight: 35 },
      { get: 'SR', give: 'R',  qty: 20, weight: 25 },
      { get: 'SR', give: 'N',  qty: 40, weight: 25 },
      { get: 'UR', give: 'SR', qty: 30, weight: 15, same: true },
    ],
  },

  /* ---------- 2c. STAFF (Phone Book / Messenger / Memo) ----------
     icon     = assets/office/staff/<icon>.svg  (placeholder icons)
     keywords = what a caller may say → transfer to this person              */
  STAFF: [
    { id: 'ceo',   title: 'CEO',             name: 'Momo',   ext: '01',  icon: 'pudding',
      keywords: ['Dr. Mo', 'Research', 'Shareholder', 'Board of Director'] },
    { id: 'cfo',   title: 'CFO',             name: 'Popo',   ext: '002', icon: 'ribbon-pink',
      keywords: ['Popo', 'Audit', 'Tax', 'Yearly Finance Report'] },
    { id: 'hr',    title: 'HR',              name: 'Nono',   ext: '003', icon: 'cookie',
      keywords: ['Nono', 'Ministry of Work', 'MOW', 'Payroll', 'Recruitment Agency'] },
    { id: 'sec',   title: 'Secretary',       name: 'Kew',    ext: '001', icon: 'cat',
      keywords: ['CEO', 'CFO', 'HR', 'GM', 'Meeting with Department Head', 'Memo'] },
    { id: 'sales', title: 'Sales & MKT GM',  name: 'Tinnie', ext: '100', icon: 'ribbon-polka',
      keywords: ['Tinnie', 'Sales Report', 'Advertisement Report', 'Talent Agency'] },
    { id: 'ip',    title: 'IP & Logistics GM', name: 'Bae',  ext: '300', icon: 'dog',
      keywords: ['Bae', 'IP research report', 'Development report', 'Warehouse Inventory'] },
    { id: 'gen',   title: 'General',         name: 'Tiki',   ext: '10',  icon: 'cheese',
      keywords: ['Help', 'recruitment', 'managing accounts', 'business opportunities', 'collaboration', 'influencer'] },
  ],
  /* keywords that are a person or a role → caller asks "May I speak to …?" */
  ASK_FOR_KEYWORDS: ['Dr. Mo', 'Popo', 'Nono', 'Tinnie', 'Bae', 'CEO', 'CFO', 'HR', 'GM'],

  CALLERS: [
    { name: 'Soso',      org: 'Soso' },
    { name: 'Guinny',      org: 'Penguin Herbs' },
    { name: 'Nemuchi',     org: 'Nemu Corp' },
    { name: 'Torter',    org: 'Ministry of Work' },
    { name: 'Toto',      org: 'Mame-shiba Co.' },
    { name: 'Mimi',     org: 'Mimi and Co.' },
    { name: 'Melon',   org: 'Melon Logistics' },
    { name: 'Underling',      org: 'Seally Group' },
    { name: 'Chuuhachi',      org: 'Hachi Accounting' },
    { name: 'Pachi',   org: 'KAWAII GAMING' },
     { name: 'Researcher',   org: 'Toy Research Lab' },
  ],
  MESSAGE_ACTIONS: {
    now:   'Call coming in now',
    later: 'Call back when you are available',
  },

  /* ---------- 3. GACHA ---------- */
  PULL_OPTIONS: [1, 5],
  KNOB_SPIN_MS: 850,          // time for one full knob turn (auto spin)
  BALL_COLORS: ['#ff9fb6', '#8fd3c1', '#ffd166', '#9ec9f5', '#c9b3f0'],

  /* ---------- 4. RARITY ----------
     rate  = drop chance in %  (must add up to 100)
     foil  = colours of the prismatic sticker back                      */
  RARITIES: {
    LR: { rate: 1,  name: 'Legend Rare', label: 'Diamond platinum foil · bubble sticker', badge: '#8d99ad',
          foil: ['#e9edf3', '#a9b4c4', '#ffffff', '#cfe3ff', '#b3bdcc', '#fdf0fa', '#97a3b6', '#e9edf3'] },
    UR: { rate: 3,  name: 'Ultra Rare', label: 'Rainbow prismatic', badge: '#c58cff',
          foil: ['#ff9aa2', '#ffd29a', '#fff5a8', '#b5ead7', '#9fd8ff', '#c7b8ff', '#ffb3e6', '#ff9aa2'] },
    SR: { rate: 6,  name: 'Super Rare', label: 'Golden prismatic',  badge: '#e8b021',
          foil: ['#fff2b3', '#f2c443', '#fffbe0', '#d9a521', '#ffe68a', '#c99317', '#fff2b3'] },
    R:  { rate: 35, name: 'Rare',       label: 'Silver prismatic',  badge: '#9aa3ae',
          foil: ['#f4f6f9', '#b7bfca', '#ffffff', '#98a2ae', '#e4e8ee', '#aab3bf', '#f4f6f9'] },
    N:  { rate: 55, name: 'Normal',     label: 'Blue prismatic',    badge: '#5c9ae0',
          foil: ['#d9eeff', '#7fb6f0', '#f0f8ff', '#5c9ae0', '#b9dcff', '#6aa6e8', '#d9eeff'] },
  },
  RARITY_ORDER: ['LR', 'UR', 'SR', 'R', 'N'],
  /* No UR sticker art yet → a UR pull gives a rainbow edition of a random SR sticker.
     Add a sticker with rarity 'UR' below and it will be used instead.                */
  UR_FALLBACK_FROM: 'SR',

  /* ---------- 5. STICKERS (gacha pool) ----------
     Images: assets/stickers/<id>/front.png, mask.png, mask-back.png
     series: null = not part of a series
     standsInFor: this sticker can replace that one to complete its series page   */
  STICKERS: [
    { id: 'space-momo',      name: 'Space Momo',      rarity: 'SR', series: 'space' },
    { id: 'supermart-soso',  name: 'Supermart Soso',  rarity: 'SR', series: 'supermart' },
    { id: 'strawberry-milk', name: 'Strawberry Milk', rarity: 'R',  series: 'supermart' },
    { id: 'space-food',      name: 'Space Food',      rarity: 'R',  series: 'space' },
    { id: 'potato-chips',    name: 'Potato Chips',    rarity: 'N',  series: 'supermart' },
    { id: 'pluto-monster',   name: 'Pluto Monster',   rarity: 'N',  series: 'space' },
    { id: 'shutter-soso',    name: 'Shutter Soso',    rarity: 'SR', series: 'supermart', standsInFor: 'supermart-soso' },
    { id: 'running-momo',    name: 'Running Momo',    rarity: 'SR', series: 'pudding' },
    { id: 'sandwich-kew',    name: 'Sandwich Kew',    rarity: 'SR', series: 'picnic' },
    { id: 'default-kew',     name: 'Default Kew',     rarity: 'SR', series: null },
    { id: 'cafetunes-kew',   name: 'Cafe Tunes Kew',  rarity: 'LR', series: 'cafe' },
  ],

  /* ---------- 6. SERIES ----------
     Put every sticker of a series on the same book page → that page gets the
     series background (theme = CSS class "theme-<id>" in style.css).               */
  SERIES: {
    space:     { name: 'Space Momo series', theme: true },
    supermart: { name: 'Soso Supermart series', theme: true },
    pudding:   { name: 'Pudding Momo series', theme: false },   // no background art yet
    picnic:    { name: 'Mini Picnic series', theme: false },
    cafe:      { name: 'Cafe Tunes series', theme: false },
  },

  /* ---------- 7. STICKER BOOK ---------- */
  BOOK_PAGES: 6,              // page 0 = front cover, then inner pages
  STICKER_SIZE: 0.3,          // default sticker width as fraction of the page width
  STICKER_SCALE_MIN: 0.45,
  STICKER_SCALE_MAX: 2.2,

  /* ---------- 8. SCENES ---------- */
  SCENES: ['office', 'gacha', 'book'],
  SWIPE_THRESHOLD: 0.18,      // drag this fraction of the screen to change scene
  SWIPE_FLICK_SPEED: 0.45,    // or flick faster than this (px per ms)

  /* ---------- 9. DEBUG ----------
     PC: Alt+M = +$30,  Alt+R = reset save
     Phone: hold the money pill for 2s = +$30                                        */
  DEBUG: true,
};

/* ---------- HELPERS ----------
   A sticker copy is stored by "key" = "<id>:<rarity>"  e.g. "space-momo:UR"        */
CONFIG.sticker = id => CONFIG.STICKERS.find(s => s.id === id);
CONFIG.staff = id => CONFIG.STAFF.find(s => s.id === id);
CONFIG.staffByExt = ext => CONFIG.STAFF.find(s => s.ext === ext);
CONFIG.img = (id, file = 'front') => `assets/stickers/${id}/${file}.png`;
CONFIG.key = (id, rarity) => `${id}:${rarity}`;
CONFIG.parse = key => { const [id, rarity] = key.split(':'); return { id, rarity, s: CONFIG.sticker(id), r: CONFIG.RARITIES[rarity] }; };
