/**
 * bgm.js
 * 程式合成音效 + 背景音樂（Web Audio API，不需要任何 MP3 檔案）
 *
 * 【給玩家的話】
 *  這裡所有聲音都是用程式即時合成的（振盪器 + 白噪音），
 *  音質比較陽春，但完全不需下載檔案，馬上有聲音。
 *  之後你要換成真實音效，只要：
 *    1. 把 MP3 放到 assets/sfx/<id>.mp3 或 assets/bgm/<id>.mp3
 *    2. 把下方 USE_REAL_FILES 改成 true
 *  每個音效下方都有「→ 用途」註解，方便你對應要換哪個檔案。
 */

// 想換成真實 MP3 檔案時，把這個改成 true（檔名見各 SFX_RECIPES 的 key）
const USE_REAL_FILES = false;

// ════════════════════════════════════════
// 共用 AudioContext（必須在使用者互動後才能啟動）
// ════════════════════════════════════════
let _ctx = null;
function ctx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

// ── 合成工具：單一振盪器音 ──
function tone(c, { freq = 440, type = 'sine', dur = 0.2, vol = 0.3, attack = 0.005, decay = null, slideTo = null, when = 0 }) {
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g   = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + (decay ?? dur));
  osc.connect(g).connect(_masterSFX);
  osc.start(t0);
  osc.stop(t0 + (decay ?? dur) + 0.02);
}

// ── 合成工具：白噪音爆裂（打擊感、爆炸）──
function noise(c, { dur = 0.15, vol = 0.3, filterType = 'lowpass', filterFreq = 1200, when = 0 }) {
  const t0 = c.currentTime + when;
  const frames = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(g).connect(_masterSFX);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

// ════════════════════════════════════════
// 音效配方表 —— 每個對應一種遊戲事件
// key 就是未來要替換的 MP3 檔名（assets/sfx/<key>.mp3）
// ════════════════════════════════════════
const SFX_RECIPES = {
  // → 用途：普通攻擊命中（短促金屬聲）
  hit_light:    (c) => { noise(c, { dur: 0.08, vol: 0.25, filterFreq: 2500 }); tone(c, { freq: 320, type: 'square', dur: 0.06, vol: 0.12 }); },
  // → 用途：技能命中（較重的衝擊聲）
  hit_medium:   (c) => { noise(c, { dur: 0.14, vol: 0.32, filterFreq: 1600 }); tone(c, { freq: 180, type: 'triangle', dur: 0.12, vol: 0.18, slideTo: 90 }); },
  // → 用途：重擊／爆發命中（沉重爆炸聲）
  hit_heavy:    (c) => { noise(c, { dur: 0.3, vol: 0.4, filterFreq: 700 }); tone(c, { freq: 110, type: 'sawtooth', dur: 0.25, vol: 0.25, slideTo: 45 }); },
  // → 用途：暴擊（金屬碎裂 + 能量爆發）
  crit:         (c) => { noise(c, { dur: 0.12, vol: 0.35, filterType: 'highpass', filterFreq: 3000 }); tone(c, { freq: 880, type: 'square', dur: 0.15, vol: 0.2, slideTo: 1760 }); },
  // → 用途：擊殺普通敵人（短促勝利聲）
  kill:         (c) => { tone(c, { freq: 440, type: 'triangle', dur: 0.1, vol: 0.2 }); tone(c, { freq: 660, type: 'triangle', dur: 0.12, vol: 0.18, when: 0.06 }); },
  // → 用途：擊殺 BOSS（宏大衝擊聲）
  boss_kill:    (c) => { tone(c, { freq: 220, type: 'sawtooth', dur: 0.5, vol: 0.3, slideTo: 110 }); tone(c, { freq: 330, type: 'square', dur: 0.4, vol: 0.2, when: 0.1 }); tone(c, { freq: 660, type: 'triangle', dur: 0.5, vol: 0.18, when: 0.2 }); noise(c, { dur: 0.6, vol: 0.25, filterFreq: 500 }); },
  // → 用途：選擇卡牌（卡片翻轉聲）
  card_pick:    (c) => { tone(c, { freq: 520, type: 'sine', dur: 0.08, vol: 0.18 }); tone(c, { freq: 780, type: 'sine', dur: 0.1, vol: 0.16, when: 0.05 }); },
  // → 用途：升級／天賦解鎖（魔法叮聲）
  level_up:     (c) => { [523, 659, 784, 1047].forEach((f, i) => tone(c, { freq: f, type: 'triangle', dur: 0.18, vol: 0.18, when: i * 0.08 })); },
  // → 用途：拾取金幣／購買（金幣叮鈴聲）
  gold:         (c) => { tone(c, { freq: 988, type: 'square', dur: 0.06, vol: 0.15 }); tone(c, { freq: 1319, type: 'square', dur: 0.08, vol: 0.13, when: 0.05 }); },
  // → 用途：VAREK 完美格擋（盾牌鐺聲）
  varek_parry:  (c) => { tone(c, { freq: 1200, type: 'sine', dur: 0.25, vol: 0.25, slideTo: 600 }); noise(c, { dur: 0.06, vol: 0.2, filterType: 'highpass', filterFreq: 4000 }); },
  // → 用途：VAREK 聖怒爆發（聖光轟鳴）
  varek_wrath:  (c) => { tone(c, { freq: 660, type: 'sawtooth', dur: 0.6, vol: 0.28, slideTo: 1320 }); tone(c, { freq: 330, type: 'sine', dur: 0.6, vol: 0.2 }); },
  // → 用途：LYRA 元素連鎖觸發（魔法共鳴聲）
  lyra_chain:   (c) => { [440, 587, 880].forEach((f, i) => tone(c, { freq: f, type: 'sine', dur: 0.2, vol: 0.16, when: i * 0.05 })); },
  // → 用途：KAEL 影遁啟動（暗影消散聲）
  kael_shadow:  (c) => { tone(c, { freq: 300, type: 'sine', dur: 0.3, vol: 0.22, slideTo: 60 }); noise(c, { dur: 0.25, vol: 0.15, filterFreq: 800 }); },
  // → 用途：KAEL 暗殺標記爆炸（暗黑爆炸）
  kael_detonate:(c) => { noise(c, { dur: 0.35, vol: 0.38, filterFreq: 600 }); tone(c, { freq: 140, type: 'sawtooth', dur: 0.3, vol: 0.26, slideTo: 50 }); },
  // → 用途：玩家受傷
  player_hurt:  (c) => { tone(c, { freq: 200, type: 'sawtooth', dur: 0.18, vol: 0.22, slideTo: 90 }); },
};

// ════════════════════════════════════════
// SFX 管理
// ════════════════════════════════════════
let _masterSFX = null;
const SFX = {
  enabled: true,
  volume: 0.8,
  play(id) {
    if (!this.enabled) return;
    try {
      const c = ctx();
      if (!_masterSFX) { _masterSFX = c.createGain(); _masterSFX.gain.value = this.volume; _masterSFX.connect(c.destination); }
      _masterSFX.gain.value = this.volume;
      const recipe = SFX_RECIPES[id];
      if (recipe) recipe(c);
      else tone(c, { freq: 440, dur: 0.1, vol: 0.15 }); // 未知音效的預設叮聲
    } catch (e) { /* 忽略尚未互動時的播放錯誤 */ }
  },
  setVolume(v) { this.volume = Math.max(0, Math.min(1, v)); },
  setEnabled(v) { this.enabled = v; },
};

// ════════════════════════════════════════
// BGM 程式合成背景音樂（簡單的循環和弦 + 琶音）
// 每個章節用不同音階／速度區分跑圖與 BOSS 戰
// ════════════════════════════════════════
const BGM_PRESETS = {
  // [根音Hz, 音階(半音), 每拍秒數, 波形]
  ch1_explore: { root: 110, scale: [0, 3, 5, 7, 10], beat: 0.5, wave: 'triangle' },
  ch1_boss:    { root: 98,  scale: [0, 2, 3, 7, 8],  beat: 0.32, wave: 'sawtooth' },
  ch2_explore: { root: 123, scale: [0, 3, 5, 8, 10], beat: 0.5, wave: 'triangle' },
  ch2_boss:    { root: 110, scale: [0, 1, 5, 6, 10], beat: 0.3, wave: 'sawtooth' },
  ch3_explore: { root: 146, scale: [0, 2, 4, 7, 9],  beat: 0.55, wave: 'sine' },
  ch3_boss:    { root: 130, scale: [0, 3, 5, 7, 10], beat: 0.3, wave: 'sawtooth' },
  ch4_explore: { root: 138, scale: [0, 1, 5, 8, 11], beat: 0.5, wave: 'triangle' },
  ch4_boss:    { root: 116, scale: [0, 2, 3, 8, 9],  beat: 0.28, wave: 'sawtooth' },
  ch5_explore: { root: 164, scale: [0, 4, 7, 11, 12],beat: 0.5, wave: 'triangle' },
  ch5_boss:    { root: 146, scale: [0, 3, 6, 7, 10], beat: 0.26, wave: 'sawtooth' },
};

const BGM = {
  enabled: true,
  volume: 0.35,
  _master: null,
  _timer: null,
  _step: 0,
  _curId: null,

  play(id) {
    if (!this.enabled) return;
    if (this._curId === id) return; // 同一首不重啟
    this.stop();
    this._curId = id;
    const preset = BGM_PRESETS[id] || BGM_PRESETS.ch1_explore;
    try {
      const c = ctx();
      this._master = c.createGain();
      this._master.gain.value = this.volume;
      this._master.connect(c.destination);
      this._step = 0;
      const playStep = () => {
        const c2 = ctx();
        const t0 = c2.currentTime;
        // 低音根音（每小節）
        if (this._step % 4 === 0) this._bassNote(c2, preset.root, preset.beat * 4, t0);
        // 琶音旋律
        const semi = preset.scale[this._step % preset.scale.length];
        const oct  = Math.floor((this._step % (preset.scale.length * 2)) / preset.scale.length);
        const freq = preset.root * 2 * Math.pow(2, (semi + oct * 12) / 12);
        this._melNote(c2, freq, preset.beat * 0.9, t0, preset.wave);
        this._step++;
      };
      playStep();
      this._timer = setInterval(playStep, preset.beat * 1000);
    } catch (e) { /* 忽略 */ }
  },

  _bassNote(c, freq, dur, t0) {
    const osc = c.createOscillator(); const g = c.createGain();
    osc.type = 'sine'; osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(this.volume * 0.5, t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this._master); osc.start(t0); osc.stop(t0 + dur + 0.05);
  },

  _melNote(c, freq, dur, t0, wave) {
    const osc = c.createOscillator(); const g = c.createGain();
    osc.type = wave; osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(this.volume * 0.3, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this._master); osc.start(t0); osc.stop(t0 + dur + 0.05);
  },

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    if (this._master) { try { this._master.disconnect(); } catch (_) {} this._master = null; }
    this._curId = null;
  },

  setVolume(v) { this.volume = Math.max(0, Math.min(1, v)); if (this._master) this._master.gain.value = this.volume; },
  setEnabled(v) { this.enabled = v; if (!v) this.stop(); },
};

// ── 便利函數（保持與舊版相同的對外介面）──
export function playBGM(id) { return BGM.play(id); }
export function stopBGM()   { BGM.stop(); }
export function playSFX(id)  { SFX.play(id); }
export function setBGMVolume(v) { BGM.setVolume(v); }
export function setSFXVolume(v) { SFX.setVolume(v); }
export function setBGMEnabled(v) { BGM.setEnabled(v); }
export function setSFXEnabled(v) { SFX.setEnabled(v); }

export { BGM, SFX };

// 掛載到 window 讓設定頁面 / 暫停選單可以存取
window.__Audio = { BGM, SFX, playBGM, playSFX, setBGMVolume, setSFXVolume, setBGMEnabled, setSFXEnabled };
