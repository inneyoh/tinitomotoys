/* ================================================================
   AUDIO — BGM, soft procedural SFX, saved volume and mobile unlock.
   All SFX are original Web Audio synthesis; no remote dependencies.
   Edit SETTINGS for defaults, and the named effects in play().
   ================================================================ */
const AUDIO = {
  SETTINGS: { music: 2, sfx: 3, musicGain: 0.25, sfxGain: 0.53, embeddedSfxBoost: 3 },
  samples: {}, voices: new Set(),
  key: 'tinitomo-audio-v1', ctx: null, bgm: null, bus: null,
  levels: null, unlocked: false, last: {}, ringTimer: null,
  init() {
    this.levels = {music:this.SETTINGS.music,sfx:this.SETTINGS.sfx};
    try { const v=JSON.parse(localStorage.getItem(this.key));
      for(const k of ['music','sfx']) if(Number.isInteger(v?.[k]) && v[k]>=0 && v[k]<=5) this.levels[k]=v[k];
    } catch (_) {}
    for(const [name,file] of Object.entries({typing:'keyboard-typing.mp3',send:'keyboard-enter.mp3'})){
      this.samples[name]=new Audio('assets/audio/'+file);this.samples[name].preload='auto';
    }
    this.bgm=new Audio('assets/audio/tiny-hustles.mp3');
    this.bgm.loop=true; this.bgm.preload='auto'; this.applyVolumes();
    this.controls();
    const unlock=()=>this.unlock();
    document.addEventListener('pointerdown',unlock,{capture:true});
    document.addEventListener('keydown',unlock,{capture:true});
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden){this.bgm.pause();this.stopSamples();this.stopRing();if(this.ctx?.state==='running')this.ctx.suspend().catch(()=>{});}
      else if(this.unlocked){this.unlock();this.syncRing();}
    });
    window.addEventListener('pagehide',()=>{this.bgm.pause();this.stopSamples();this.stopRing();});
    window.addEventListener('pageshow',()=>{if(this.unlocked){this.unlock();this.syncRing();}});
    // Observe actual ring state, including missed calls, auto reply and callbacks.
    const phone=document.getElementById('o-phone');
    if(phone)new MutationObserver(()=>this.syncRing()).observe(phone,{attributes:true,attributeFilter:['class']});
    document.addEventListener('click',e=>{if(e.target.closest('.pc-chip'))this.play('typing');});
  },
  unlock() {
    if(document.hidden)return;
    try {
      if(!this.ctx){const C=window.AudioContext||window.webkitAudioContext;if(C){this.ctx=new C();this.bus=this.ctx.createGain();this.bus.connect(this.ctx.destination);this.applyVolumes();}}
      if(this.ctx?.state==='suspended')this.ctx.resume().catch(()=>{});
      this.unlocked=true;
      if(this.levels.music && this.bgm.paused)this.bgm.play().catch(()=>{});
      this.syncRing();
    } catch (_) {} // Audio failure must never interrupt gameplay.
  },
  applyVolumes(){
    if(this.bgm){this.bgm.volume=this.levels.music/5*this.SETTINGS.musicGain;if(!this.levels.music)this.bgm.pause();}
    for(const voice of this.voices)voice.volume=this.levels.sfx/5*this.SETTINGS.sfxGain;
    if(!this.levels.sfx)this.stopSamples();
    if(this.bus)this.bus.gain.value=this.levels.sfx/5*this.SETTINGS.sfxGain*this.SETTINGS.embeddedSfxBoost;
  },
  setVolume(kind,value){
    if(!['music','sfx'].includes(kind))return;
    this.levels[kind]=Math.max(0,Math.min(5,Number(value)||0));
    try{localStorage.setItem(this.key,JSON.stringify(this.levels));}catch(_){}
    this.applyVolumes();this.unlock();
  },
  controls(){
    const details=document.createElement('details');details.className='audio-settings';details.setAttribute('data-nodrag','');
    details.innerHTML='<summary aria-label="Sound settings">♫</summary><div><b>Sound</b>'+['music','sfx'].map(k=>`<label>${k==='music'?'Music':'SFX'}<select aria-label="${k==='music'?'Music':'SFX'} volume" data-volume="${k}">${[0,1,2,3,4,5].map(n=>`<option value="${n}" ${this.levels[k]===n?'selected':''}>${n?'Level '+n:'Mute'}</option>`).join('')}</select></label>`).join('')+'</div>';
    details.addEventListener('change',e=>{if(e.target.dataset.volume)this.setVolume(e.target.dataset.volume,e.target.value);});
    document.body.append(details);
  },
  syncRing(){
    const ringing=document.getElementById('o-phone')?.classList.contains('ringing');
    const autoSilent=SAVE.data.autoResponse && !CALLS.call?.special;
    if(!ringing || autoSilent || document.hidden || !this.unlocked || !this.levels.sfx){this.stopRing();return;}
    if(this.ringTimer)return;
    this.play('ring');this.ringTimer=setInterval(()=>{
      if(SAVE.data.autoResponse && !CALLS.call?.special){this.stopRing();return;}
      this.play('ring');
    },2200);
  },
  stopRing(){clearInterval(this.ringTimer);this.ringTimer=null;(this.ringNodes||[]).forEach(n=>{try{n.stop();}catch(_){}});this.ringNodes=[];},
  sample(name){
    const source=this.samples[name];if(!source)return;
    // Limit overlapping keys without delaying rapid composing taps.
    if(this.voices.size>=6){const old=this.voices.values().next().value;old.pause();this.voices.delete(old);}
    const voice=source.cloneNode();voice.soundName=name;voice.volume=this.levels.sfx/5*this.SETTINGS.sfxGain;
    this.voices.add(voice);
    const clean=()=>this.voices.delete(voice);voice.onended=clean;voice.onerror=clean;
    voice.play().catch(clean);
  },
  stopSamples(name=null){
    for(const voice of [...this.voices]){
      if(name && voice.soundName!==name)continue;
      voice.pause();voice.currentTime=0;this.voices.delete(voice);
    }
  },
  /* Low-level voices: short gain ramps prevent clicks at start/end. */
  tone(freq,duration=.1,volume=.12,type='sine',delay=0,endFreq=null){
    const c=this.ctx,t=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,t);if(endFreq)o.frequency.exponentialRampToValueAtTime(endFreq,t+duration);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    o.connect(g);g.connect(this.bus);o.start(t);o.stop(t+duration+.02);
    if(this.effect==='ring'){(this.ringNodes ||= []).push(o);o.onended=()=>{this.ringNodes=this.ringNodes.filter(n=>n!==o);};}
  },
  noise(duration=.1,volume=.15,filter=1800,delay=0){
    const c=this.ctx,t=c.currentTime+delay,b=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),data=b.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(0.65+0.35*Math.sin(i*.17));
    const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=b;f.type='bandpass';f.frequency.value=filter;f.Q.value=.7;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    s.connect(f);f.connect(g);g.connect(this.bus);s.start(t);s.stop(t+duration+.02);
  },
  /* Named effects: throttle continuous gestures and rapid repeated input. */
  play(name,arg){
    // Sending cancels every active typing clip before any send audio begins.
    if(name==='send')this.stopSamples('typing');
    if(!this.ctx || this.ctx.state!=='running' || !this.unlocked || !this.levels.sfx || document.hidden)return;
    const now=performance.now(),gap={knob:85,typing:45,squeak:120}[name]||25;
    if(now-(this.last[name]??-Infinity)<gap)return;this.last[name]=now;
    this.effect=name;
    try{
      const tone=(...a)=>this.tone(...a),noise=(...a)=>this.noise(...a);
      if(name==='ring'){[0,.18,.48,.66].forEach(d=>{tone(660,.13,.10,'sine',d);tone(880,.13,.055,'sine',d);});}
      if(name==='typing' || name==='send'){this.sample(name);return;}
      if(name==='coin'){tone(1500,.16,.12,'sine');tone(2200,.22,.07,'sine',.045);noise(.08,.10,2300,.08);tone(650,.10,.07,'triangle',.14,350);}
      if(name==='dial'){
        const keys=['1','2','3','4','5','6','7','8','9','*','0','#'],i=keys.indexOf(String(arg));
        if(i>=0){tone([697,770,852,941][Math.floor(i/3)],.12,.075);tone([1209,1336,1477][i%3],.12,.055);}else tone(440,.07,.07);
      }
      if(name==='button'){noise(.055,.10,750);tone(180,.07,.09,'sine',0,100);}
      if(name==='knob'){noise(.07,.11,850);tone(140,.07,.07,'triangle',0,95);}
      if(name==='tear'){[0,.045,.09,.15,.21].forEach(d=>noise(.095,.19,1900+Math.random()*1400,d));}
      if(name==='place'){noise(.09,.16,850);tone(210,.10,.10,'sine',0,95);}
      if(name==='squeak'){tone(650,.12,.09,'sine',0,1250);tone(1250,.16,.07,'sine',.10,480);}
      if(name==='flip'){noise(.2,.16,1100);noise(.18,.10,2300,.10);}
      if(name==='result'){
        const notes={N:[523,659],R:[587,740,880],SR:[659,831,988,1318],UR:[523,659,784,1047,1319,1568],LR:[587,740,880,1175,1480,1760,2349]}[arg]||[523,659];
        notes.forEach((f,i)=>{tone(f,.38,.11,'sine',i*.085);tone(f*2,.22,.025,'sine',i*.085);});
      }
      if(name==='complete'){[523,659,784,1047,1319,1568,2093,2637].forEach((f,i)=>{tone(f,.8,.10,'sine',i*.09);tone(f*1.5,.5,.025,'sine',i*.09+.06);});}
    }catch(_){} finally {this.effect=null;}
  }
};
