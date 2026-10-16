/* ================================================================
   CALLS — reception call gameplay (rules from "Scene1_Gameplay")

   1. Phone rings → pick up the handset. The caller says who they want
      or why they are calling (keyword, see Memo app).
   2. Press HOLD, then check the staff member's status in Messenger.
   3. Depending on the status:
        Available → TRANSFER (XFER + extension + XFER)
        Busy      → message "who + purpose + Call coming in now",
                    wait for 👍, then TRANSFER
        DND       → message "… + Call back when you are available",
                    un-HOLD, tell caller they will be called back later
        Away      → message "… + Call coming in now"; if they come back
                    (Available + 👍) TRANSFER, otherwise un-HOLD and tell
                    caller they will be called back later
        Offline   → un-HOLD, tell caller to call back another day
   Transfer OK → phone shows ANSWERED. Transfer wrong → CALL BACK and the
   phone rings again (pick it up and fix it). END hangs up.
   ================================================================ */
const CALLS = {
  call: null,          // the current call (null = no call)
  statuses: {},        // staffId → 'available' | 'busy' | 'dnd' | 'away' | 'offline'
  chats: {},           // staffId → [{ text, reaction, note }]  (this call only)

  /* ---------- 1. HELPERS ---------- */
  rand(a, b) { return a + Math.random() * (b - a); },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  weighted(weights) {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (const [k, w] of Object.entries(weights)) { if ((r -= w) < 0) return k; }
    return Object.keys(weights)[0];
  },
  shuffle(a) { return a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(v => v[1]); },
  rollStatuses() {
    CONFIG.STAFF.forEach(s => { this.statuses[s.id] = this.weighted(CONFIG.STATUS_WEIGHTS); });
    this.chats = {};
  },

  /* ---------- 2. NEW CALL ---------- */
  newCall() {
    this.rollStatuses();
    const SP = CONFIG.SPECIAL_CALLER;
    if (SP && Math.random() < SP.chance) return this.call = this.blankCall({
      caller: SP.caller, keyword: SP.keyword, target: SP.target, special: true,
      line: SP.line, note: SP.note,
    });
    const target = this.pick(CONFIG.STAFF);
    const keyword = this.pick(target.keywords);
    const caller = this.pick(CONFIG.CALLERS);
    const line = CONFIG.ASK_FOR_KEYWORDS.includes(keyword)
      ? this.pick([
          `Hello, this is ${caller.name} from ${caller.org}. May I speak to <b>${keyword}</b>, please?`,
          `Hi! ${caller.name} here, from ${caller.org}. Could you put me through to <b>${keyword}</b>?`,
        ])
      : this.pick([
          `Hello, this is ${caller.name} from ${caller.org}. I'm calling about <b>${keyword}</b>.`,
          `Hi, ${caller.name} from ${caller.org} here. It's regarding <b>${keyword}</b>.`,
          `Good day! I'm ${caller.name} of ${caller.org}, calling about <b>${keyword}</b>.`,
        ]);
    return this.call = this.blankCall({ caller, keyword, target: target.id, line });
  },
  blankCall(base) {
    return {
      ...base,
      state: 'ringing',        // ringing | live | hold | xfer | callback | done
      mistakes: 0, notes: [],
      thumbs: false,           // got a 👍 from the target
      messaged: false,         // sent the target a correct message
      leftAlone: false,        // used Messenger without putting the caller on hold
      patience: CONFIG.CALLER_PATIENCE_S,
      xferDigits: '',
    };
  },
  mistake(note) { if (this.call) { this.call.mistakes++; this.call.notes.push(note); } },

  /* ---------- 3. PHONE ACTIONS (called by OFFICE) ---------- */
  pickUp() {
    const c = this.call; if (!c) return;
    if (c.state === 'callback' && c.special) c.note = '(she sounds annoyed — she still wants Momo)';
    if (c.state === 'callback') c.line = c.special ? 'Soso!! SOSO SOSO!'
      : `Hello? I was sent to the wrong line… I'm still trying to reach <b>${c.keyword}</b>.`;
    c.state = 'live';
  },
  toggleHold() {
    const c = this.call; if (!c || !['live', 'hold'].includes(c.state)) return null;
    c.state = c.state === 'hold' ? 'live' : 'hold';
    if (c.state === 'live') c.line = 'Hello? Are you still there?';
    return c.state;
  },
  /* XFER pressed: 1st press starts typing, 2nd press sends */
  transferPress() {
    const c = this.call; if (!c || !['live', 'hold', 'xfer'].includes(c.state)) return { msg: 'NO CALL' };
    if (c.state !== 'xfer') { c.prevState = c.state; c.state = 'xfer'; c.xferDigits = ''; return { msg: 'XFER' }; }
    return this.transfer(c.xferDigits);
  },
  backspace() {
    const c = this.call;
    if (c && c.state === 'xfer') c.xferDigits = c.xferDigits.slice(0, -1);
  },
  digit(k) {
    const c = this.call;
    if (!c || c.state !== 'xfer' || !/[0-9]/.test(k)) return;
    if (c.xferDigits.length < 4) c.xferDigits += k;
  },
  transfer(ext) {
    const c = this.call, staff = CONFIG.staffByExt(ext), st = staff && this.statuses[staff.id];
    let why = '';
    if (!staff) why = `No one has extension ${ext || '(blank)'}`;
    else if (staff.id !== c.target) why = `${staff.name} (${staff.title}) doesn't handle "${c.keyword}"`;
    else if (st === 'busy' && !c.thumbs) why = `${staff.name} is Busy — message them and wait for 👍 first`;
    else if (st !== 'available' && st !== 'busy') why = `${staff.name} is ${CONFIG.STATUSES[st]} — they can't take calls`;
    if (!why) return this.finish(true, `Transferred to ${staff.name} (${staff.title})`, 'ANSWERED');
    this.mistake(why);
    c.state = 'callback';
    return { msg: 'CALL BACK', callback: true, why };
  },
  /* reply to the caller when the call is live: 'later' | 'another-day' */
  inform(type) {
    const c = this.call; if (!c || c.state !== 'live') return null;
    const staff = CONFIG.staff(c.target), st = this.statuses[c.target];
    const name = `${staff.name} (${staff.title})`;
    if (type === 'later') {
      if (st === 'dnd' || st === 'away') {
        if (!c.messaged) this.mistake(`You didn't message ${staff.name} before telling the caller`);
        return this.finish(true, `Told the caller ${name} will call back later`, 'ENDED');
      }
      return this.finish(false, st === 'offline'
        ? `${name} is Offline — the caller should call back another day`
        : `${name} is ${CONFIG.STATUSES[st]} — you should transfer the call`, 'ENDED');
    }
    if (st === 'offline') return this.finish(true, `Told the caller to call back another day (${staff.name} is out today)`, 'ENDED');
    return this.finish(false, `${name} is in the office (${CONFIG.STATUSES[st]})`, 'ENDED');
  },
  hangUp() {
    const c = this.call; if (!c || c.state === 'done') return null;
    return this.finish(false, 'You hung up on the caller', 'ENDED');
  },
  tick(dt) {   // called every second by OFFICE while a call is picked up
    const c = this.call;
    if (!c || !['live', 'hold', 'xfer'].includes(c.state)) return null;
    c.patience -= dt;
    if (c.patience <= 0) return this.finish(false, 'The caller got tired of waiting and hung up', 'HUNG UP');
    return null;
  },

  /* ---------- 4. MESSENGER ---------- */
  sendMessage(staffId, who, purpose, action, onUpdate) {
    AUDIO.play("typing");
    const c = this.call;
    const msg = { text: `${who} · ${purpose} · ${CONFIG.MESSAGE_ACTIONS[action]}`, reaction: '', note: 'Sent' };
    (this.chats[staffId] = this.chats[staffId] || []).push(msg);
    if (!c || c.state === 'done' || c.state === 'ringing') { msg.note = 'No call right now'; return msg; }
    if (c.state === 'live' && !c.leftAlone) { c.leftAlone = true; this.mistake('Put the caller on HOLD before checking Messenger'); }
    const st = this.statuses[staffId];
    const correct = staffId === c.target && who === c.caller.name && purpose === c.keyword;
    const later = (fn, range) => setTimeout(() => { if (this.call === c) { fn(); onUpdate && onUpdate(); } }, this.rand(...range));

    if (st === 'offline') { msg.note = 'Not delivered — offline'; return msg; }
    if (!correct) {
      this.mistake(staffId !== c.target ? 'Messaged the wrong staff member' : 'Message had the wrong caller or purpose');
      later(() => { msg.reaction = '❓'; msg.note = 'Confused'; }, CONFIG.REPLY_DELAY_MS);
      return msg;
    }
    if (st === 'dnd') {
      c.messaged = true; msg.note = 'Delivered (Do Not Disturb)';
      if (action !== 'later') this.mistake('DND staff should get "Call back when you are available"');
    } else if (st === 'away') {
      c.messaged = true; msg.note = 'Delivered (Away)';
      if (action === 'now' && Math.random() < CONFIG.AWAY_RETURN_CHANCE) {
        later(() => { this.statuses[staffId] = 'available'; msg.reaction = '👍'; msg.note = 'Back at desk!'; c.thumbs = true; }, CONFIG.AWAY_RETURN_MS);
      }
    } else {   // available / busy
      c.messaged = true;
      if (action === 'now') later(() => { msg.reaction = '👍'; msg.note = 'Ready for the call'; c.thumbs = true; }, CONFIG.REPLY_DELAY_MS);
      else { this.mistake(`${CONFIG.STATUSES[st]} staff should get "Call coming in now"`); later(() => { msg.reaction = '❓'; }, CONFIG.REPLY_DELAY_MS); }
    }
    return msg;
  },

  /* ---------- 5. RESULT ---------- */
  finish(success, summary, lcd) {
    const c = this.call;
    c.state = 'done';
    const perfect = success && c.mistakes === 0;
    if (success) SAVE.data.calls.ok++; else SAVE.data.calls.bad++;
    if (c.special) {   // Soso: coins only, no cash
      const coins = success ? CONFIG.SPECIAL_CALLER.coins : 0;
      if (coins) SAVE.giveCoins(coins); else SAVE.save();
      return { done: true, success, perfect, reward: 0, coins, summary, notes: c.notes.slice(), msg: lcd };
    }
    const reward = success ? Math.max(0, CONFIG.CALL_REWARD - c.mistakes * CONFIG.MISTAKE_PENALTY) : 0;
    if (reward) SAVE.earn(reward); else SAVE.save();
    return { done: true, success, perfect, reward, summary, notes: c.notes.slice(), msg: lcd };
  },
};
