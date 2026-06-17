/**
 * keybindui.js  ──  自訂按鍵設定面板（彈窗）
 * ════════════════════════════════════════════════════════════════
 * 從暫停選單或大廳開啟。列出所有動作 + 目前鍵位，可逐項重新綁定。
 * 流程：點某動作的鍵 → 顯示「請按新鍵…」→ 下一次 keydown 即綁定。
 * 綁定立即存進 localStorage（keybind.js 負責）。
 * ════════════════════════════════════════════════════════════════
 */
import { ACTIONS, getBindings, rebindAction, resetBindings, keyLabel } from './keybind.js';

let listening = null;   // 正在等待新鍵的 action

export function openKeybindPanel() {
  closeKeybindPanel();
  const ov = document.createElement('div');
  ov.id = 'keybind-overlay';
  ov.innerHTML = `
    <div id="keybind-box">
      <h2>按鍵設定</h2>
      <p class="kb-hint">點一下右側按鍵，再按下你想綁定的鍵</p>
      <div id="keybind-list"></div>
      <div class="kb-actions">
        <button id="kb-reset" class="kb-btn">回復預設</button>
        <button id="kb-close" class="kb-btn kb-main">完成</button>
      </div>
    </div>`;
  document.body.appendChild(ov);

  renderList();

  document.getElementById('kb-close').onclick = closeKeybindPanel;
  document.getElementById('kb-reset').onclick = () => { resetBindings(); listening = null; renderList(); };

  // 攔截鍵盤：聆聽中就綁定，否則 Esc 關閉
  window.addEventListener('keydown', onKey, true);
}

export function closeKeybindPanel() {
  const ov = document.getElementById('keybind-overlay');
  if (ov) ov.remove();
  listening = null;
  window.removeEventListener('keydown', onKey, true);
}

function onKey(ev) {
  if (!document.getElementById('keybind-overlay')) return;
  if (listening) {
    ev.preventDefault(); ev.stopPropagation();
    if (ev.key !== 'Escape') rebindAction(listening, ev.key);
    listening = null;
    renderList();
    return;
  }
  if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); closeKeybindPanel(); }
}

function renderList() {
  const list = document.getElementById('keybind-list');
  if (!list) return;
  const b = getBindings();
  list.innerHTML = '';
  for (const [act, def] of Object.entries(ACTIONS)) {
    const keys = (b[act] || []).map(keyLabel).join(' / ') || '—';
    const row = document.createElement('div');
    row.className = 'kb-row';
    row.innerHTML = `
      <span class="kb-label">${def.label}</span>
      <button class="kb-key ${listening === act ? 'kb-wait' : ''}" data-act="${act}">
        ${listening === act ? '按下新鍵…' : keys}
      </button>`;
    list.appendChild(row);
  }
  list.querySelectorAll('.kb-key').forEach(btn => {
    btn.onclick = () => { listening = btn.dataset.act; renderList(); };
  });
}
