/**
 * bgm.js
 * BGMManager：懶加載背景音樂 + 交叉淡化
 * SFX：音效播放（輕量 Audio 物件）
 *
 * 【教學】Web Audio API 懶加載：
 *  瀏覽器規定：必須在「使用者互動後」才能播放音頻
 *  所以我們在第一次點擊時才建立 AudioContext
 *  MP3 檔案也只在「第一次需要播放時」才 fetch 下載
 *  這樣不會在進入網頁時就下載全部音樂，節省流量
 */

class BGMManager {
  constructor() {
    this.tracks   = {};    // id → AudioBuffer（已解碼的音訊）
    this.current  = null;  // 當前播放中的 AudioBufferSourceNode
    this.ctx      = null;  // AudioContext（懶建立）
    this.gainNode = null;  // 音量控制節點
    this.enabled  = true;
    this.volume   = 0.7;
  }

  // 確保 AudioContext 已建立（必須在使用者互動後呼叫）
  _ensureCtx() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = this.volume;
    this.gainNode.connect(this.ctx.destination);
  }

  // 預載指定曲目（可選，提前觸發）
  async load(id) {
    if (this.tracks[id]) return;
    const url = `assets/bgm/${id}.mp3`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`BGM 找不到：${url}`);
      const buf = await res.arrayBuffer();
      this._ensureCtx();
      this.tracks[id] = await this.ctx.decodeAudioData(buf);
    } catch (e) {
      console.warn('[BGM] 載入失敗:', id, e.message);
    }
  }

  // 播放指定曲目
  async play(id, { loop = true, fadeIn = 1.5 } = {}) {
    if (!this.enabled) return;
    this._ensureCtx();

    // 若 AudioContext 被瀏覽器暫停（自動播放政策），先恢復
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    // 淡出當前曲目
    if (this.current) this._fadeOut(this.current, 1.0);

    // 載入新曲目（若已載入就直接使用快取）
    await this.load(id);
    if (!this.tracks[id]) return;

    const src = this.ctx.createBufferSource();
    src.buffer = this.tracks[id];
    src.loop   = loop;
    src.connect(this.gainNode);

    // 淡入
    this.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
    this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    this.gainNode.gain.linearRampToValueAtTime(this.volume, this.ctx.currentTime + fadeIn);

    src.start();
    this.current = src;
  }

  // 停止（淡出）
  stop(duration = 1.0) {
    if (!this.current || !this.ctx) return;
    this._fadeOut(this.current, duration);
    this.current = null;
  }

  _fadeOut(src, duration) {
    if (!this.gainNode || !this.ctx) return;
    try {
      this.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.ctx.currentTime);
      this.gainNode.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
      setTimeout(() => { try { src.stop(); } catch(_) {} }, duration * 1000 + 100);
    } catch(_) {}
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.gainNode) this.gainNode.gain.value = this.volume;
  }

  setEnabled(val) {
    this.enabled = val;
    if (!val) this.stop(0.5);
  }
}

// ════════════════════════════════════════
// SFX 管理（輕量 Audio 物件池）
// ════════════════════════════════════════
class SFXManager {
  constructor() {
    this.enabled = true;
    this.volume  = 0.8;
    this.pool    = {};   // id → HTMLAudioElement[]
  }

  _getAudio(id) {
    const url = `assets/sfx/${id}.mp3`;
    if (!this.pool[id]) this.pool[id] = [];

    // 找一個沒在播的 Audio 物件複用（避免每次 new Audio）
    const free = this.pool[id].find(a => a.paused || a.ended);
    if (free) { free.currentTime = 0; return free; }

    // 沒有空閒的，建新的（池最大5個）
    if (this.pool[id].length < 5) {
      const audio = new Audio(url);
      audio.volume = this.volume;
      this.pool[id].push(audio);
      return audio;
    }
    return null;
  }

  play(id) {
    if (!this.enabled) return;
    const audio = this._getAudio(id);
    if (!audio) return;
    audio.volume = this.volume;
    audio.play().catch(() => {}); // 忽略自動播放錯誤
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    Object.values(this.pool).flat().forEach(a => a.volume = this.volume);
  }

  setEnabled(val) { this.enabled = val; }
}

// ── 全局單例 ──
export const BGM = new BGMManager();
export const SFX = new SFXManager();

// ── 便利函數 ──
export function playBGM(id, opts) { return BGM.play(id, opts); }
export function stopBGM()         { BGM.stop(); }
export function playSFX(id)       { SFX.play(id); }

// ── 音量設定（從設定頁面呼叫）──
export function setBGMVolume(v) { BGM.setVolume(v); }
export function setSFXVolume(v) { SFX.setVolume(v); }
export function setBGMEnabled(v) { BGM.setEnabled(v); }
export function setSFXEnabled(v) { SFX.setEnabled(v); }

// 掛載到 window 讓設定頁面可以存取
window.__Audio = { BGM, SFX, playBGM, playSFX, setBGMVolume, setSFXVolume };
