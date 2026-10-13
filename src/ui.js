// 提示条、撤销栈、右键菜单的外壳和对话框。

import { $, h } from './dom.js';
import { COLORS } from './store.js';

let toastTimer;
// 底部提示条;给了 action 就带一个按钮(比如「撤销」)
export function toast(text, action, run) {
  const el = $('#toast');
  el.replaceChildren(h('span', {}, text), ...(action ? [h('button', { onclick: () => ((el.hidden = true), run()) }, action)] : []));
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), action ? 8000 : 2000);
}

// 可撤销的操作都进这个栈:提示条上的「撤销」和 Ctrl/Cmd+Z 走同一条路,后做的先撤
const undoStack = [];
export function pushUndo(text, run) {
  const entry = { run };
  undoStack.push(entry);
  if (undoStack.length > 30) undoStack.shift();
  toast(text, '撤销', () => undo(entry));
}
export async function undo(entry = undoStack.at(-1)) {
  if (!entry) return toast('没有可撤销的操作');
  undoStack.splice(undoStack.indexOf(entry), 1);
  await entry.run();
  toast('已撤销');
}

export async function copyText(text, done) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // 面板没拿到焦点时 Clipboard API 会拒绝,退回老办法
    const ta = h('textarea', { value: text, style: 'position:fixed;opacity:0' });
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast(done);
}

export function hideMenu() {
  $('#menu').hidden = true;
}

// items: [{ label, run, danger? } | '-' | 假值(跳过)]
export function showMenu(e, items) {
  e.preventDefault();
  const menu = $('#menu');
  menu.replaceChildren(
    ...items
      .filter(Boolean)
      .map((it) => (it === '-' ? h('hr') : h('button', { class: it.danger && 'danger', onclick: () => (hideMenu(), it.run()) }, it.label)))
  );
  menu.hidden = false;
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.max(4, Math.min(e.clientX, innerWidth - r.width - 4)) + 'px';
  menu.style.top = Math.max(4, Math.min(e.clientY, innerHeight - r.height - 4)) + 'px';
}

// fields: [{key,label,value}];color 非空时显示颜色选择。取消返回 null
export function ask(title, fields, color, okLabel = '保存') {
  return new Promise((resolve) => {
    const dlg = $('#dlg');
    const inputs = {};
    let picked = color;
    const swatches =
      color &&
      h(
        'div',
        { class: 'swatches' },
        COLORS.map((c) =>
          h('button', {
            type: 'button',
            class: 'swatch' + (c === color ? ' on' : ''),
            style: `background:${c};color:${c}`,
            onclick: (e) => {
              picked = c;
              for (const s of e.currentTarget.parentNode.children) s.classList.toggle('on', s === e.currentTarget);
            },
          })
        )
      );
    dlg.replaceChildren(
      h(
        'form',
        { method: 'dialog' },
        h('h3', {}, title),
        fields.map((f) => h('label', {}, f.label, (inputs[f.key] = h('input', { type: 'text', value: f.value ?? '', required: !f.optional })))),
        swatches,
        h(
          'div',
          { class: 'btns' },
          h('button', { type: 'button', onclick: () => dlg.close('cancel') }, '取消'),
          h('button', { value: 'ok', class: 'primary' }, okLabel)
        )
      )
    );
    dlg.returnValue = '';
    dlg.addEventListener(
      'close',
      () => {
        if (dlg.returnValue !== 'ok') return resolve(null);
        const out = { color: picked };
        for (const [k, input] of Object.entries(inputs)) out[k] = input.value.trim();
        resolve(out);
      },
      { once: true }
    );
    dlg.showModal();
    Object.values(inputs)[0]?.select();
  });
}
