# TiniTomo Gacha Rush — base prototype

Upload this whole folder to a GitHub repo (e.g. `inneyoh.github.io/tinitomo-gacharush`) and open `index.html`.

## Folder map
```
index.html            page structure (sectioned: HUD, 3 scenes, nav, overlays)
css/style.css         all looks + positions (section 5 = office, 6 = gacha, 7 = sticker book, 8 = stickers)
js/config.js          numbers to tweak: prices, call reward, stickers, rarity rates, series, debug
js/save.js            player save (localStorage) — money, stickers, book pages, top loaders
js/ui.js              HUD, pop-ups, sticker picker, 360° viewer pop-up
js/sticker.js         draws stickers + the 360° viewer with the prismatic (rarity) back
js/scenes.js          scene slider: drag / swipe, edge arrows, dots, ← → keys
js/calls.js           Scene 1 — call rules: callers, hold, messages, transfer, grading
js/pc.js              Scene 1 — monitor apps: Phone Book, Messenger, Memo, Auto Reply
js/market.js          Scene 1 — Sticker Market app (trade spare stickers for rarer ones)
js/office.js          Scene 1 — desk props, telephone buttons, caller speech bubble
js/gacha.js           Scene 2 — 1×/5×, coin slot, knob, ball drop, blindbox tearing
js/book.js            Scene 3 — sticker book (cover + pages, place / move / rotate stickers)
js/main.js            boot + debug keys
assets/stickers/<id>/front.png · mask.png · mask-back.png
assets/book/space/    Space Momo series page background (sky, Jupiter, Mars, stars)
assets/book/supermart/mart.jpg  Soso Supermart series page background (Soso Mart shelf)
assets/office/*.svg   monitor, riser, keyboard, mouse, phone, plant
assets/office/staff/  placeholder staff icons (pudding, ribbons, cookie, cat, dog, cheese)
assets/gacha/*.svg    knob, blindbox body + flap
assets/ui/*.svg       coin, arrow
```

## Reception calls (Scene 1)
1. Phone rings → tap the handset. The caller names a person or a topic (highlighted).
2. Press **HOLD**, open **Messenger** and check the right person's status (keywords are in **Memo**).
3. Available → **XFER**, type the extension (**Phone Book**), **XFER** again → ANSWERED.
   Busy → message *caller + purpose + Call coming in now*, wait for 👍, then transfer.
   Do Not Disturb → message *… + Call back when you are available*, press HOLD to un-hold, reply "they'll call you back later".
   Away → message *… + Call coming in now*; if they come back (green + 👍) transfer, otherwise un-hold and reply "call you back later".
   Offline → un-hold and reply "please call back another day".
4. Wrong transfer → CALL BACK: the caller rings again, pick up and fix it.
Rewards: $8 per correct call, −$3 per mistake, $0 if failed. Auto Reply handles calls for $2 each.
Auto Reply is locked until the player has done 30 gacha pulls (`AUTO_REPLY_UNLOCK_PULLS`); the monitor icon shows progress.
All of these numbers, the staff list, keywords and callers are in `js/config.js` (section 2b / 2c).

## Sticker Market (PC app, `js/market.js`)
Unlocks once the player owns 15 of the same sticker. Standalone window (no app tabs).
Trades: R = 20 N · SR = 20 R or 40 N · UR = 30 of the same SR. 5 offers, 3% chance of a 6th SPECIAL offer (−20%).
Offers refresh every 10 minutes or when all are traded. Only free copies (not in the book / top loaders) can be traded.
Stickers the player has never obtained show as a silhouette named "???".
All numbers are in `CONFIG.MARKET` (`js/config.js` section 2d).

## Rarity & drop rates
`CONFIG.RARITIES` in `js/config.js`: LR 1% (diamond/platinum back + puffy bubble-sticker front), UR 3% (rainbow),
SR 6% (gold), R 35% (silver), N 55% (blue).
No UR sticker art exists yet, so a UR pull gives a rainbow edition of a random SR sticker.
5× pulls get a "✂ Tear all" button on the result screen.

## Adding a new sticker
1. Make `assets/stickers/<id>/` with `front.png` (die-cut art), `mask.png` (its outline, white on transparent) and `mask-back.png` (mask flipped left-right).
2. Add `{ id, name, rarity, series }` to `CONFIG.STICKERS`.

## Series backgrounds
Put every sticker of a series on one book page and the page gets that series' background.
Space Momo series (Space Momo, Space Food, Pluto Monster) → space scene.
Soso Supermart series (Supermart Soso *or* Shutter Soso, Strawberry Milk, Potato Chips) → Soso Mart shelf
(`standsInFor` on a sticker lets it replace another one in its series).
Pudding Momo, Mini Picnic and Cafe Tunes series exist but have no background yet (`theme: false`).
To add another, set `theme: true`
in `CONFIG.SERIES` and style `.b-page.theme-<series>` in `css/style.css` section 7.

## Testing locally
The prismatic backs use image masks, which browsers block when you double-click `index.html`.
Test on GitHub Pages or run `python3 -m http.server` in this folder and open http://localhost:8000.

## Moving a prop
Open `css/style.css` → section **5a** (PC) or **5b** (phone).
PC: the office fills the whole window. Positions use `--u` (≈1% of the window height); the left group
(monitor, riser, keyboard, mouse) and right group (plant, frame, phone, caller bubble) spread apart on wide screens.
The Phone Book / Messenger / Memo window opens inside the monitor screen (section 5c, `.pc-panel` —
update it if you move or resize the monitor). Phone (portrait) uses a stacked layout in `cqw` (% of screen width):
monitor + photo + plant on top, full-width top-loader shelf, caller bubble, then a wide desk phone
(`assets/office/phone-body-wide.svg`) with big buttons. Keyboard, mouse and nameplate are hidden on phones.

## Debug
- PC: **Alt+M** = +$30, **Alt+R** = reset save
- Phone: hold the **$ pill** for 2 seconds = +$30
- Turn off with `DEBUG: false` in `js/config.js`
