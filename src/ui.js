// 提示条、撤销栈、右键菜单的外壳和对话框。

import { $, h, icon } from './dom.js';
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
  const entry = { run, time: Date.now() };
  undoStack.push(entry);
  if (undoStack.length > 30) undoStack.shift();
  toast(text, '撤销', () => undo(entry));
}
// entry 为空 = 按了 Ctrl/Cmd+Z:撤销最近的一步。
// 在浏览器自己的标签栏里关掉的标签页不经过这个栈,所以先看浏览器的「最近关闭」:比栈顶更晚关掉的,先恢复它
export async function undo(entry) {
  if (!entry) {
    entry = undoStack.at(-1);
    const [closed] = await chrome.sessions.getRecentlyClosed().catch(() => []);
    // lastModified 是秒;侧边栏自己关掉的标签页,关闭时间不会晚于它那一步的记录时间
    if (closed?.tab && closed.lastModified * 1000 > (entry?.time ?? 0)) {
      await chrome.sessions.restore(closed.tab.sessionId).catch(() => {});
      return toast(`已恢复「${closed.tab.title || closed.tab.url}」`);
    }
  }
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
  // 条件不满足的项是 false;分隔线不出现在开头、结尾,也不连着出现
  const list = items.filter(Boolean).filter((it, i, all) => it !== '-' || (i > 0 && i < all.length - 1 && all[i + 1] !== '-'));
  menu.replaceChildren(
    ...list.map((it) => {
      if (it === '-') return h('hr');
      if (it.header) return h('div', { class: 'menu-head' }, it.header);
      // 图标:icon 是内置图标名,img 是图片地址(比如网站图标);note 是右侧的灰色小字
      const ico = it.img ? h('img', { class: 'i', src: it.img, alt: '' }) : it.icon && icon(it.icon);
      if (ico && it.color) ico.style.color = it.color;
      return h(
        'button',
        { class: it.danger ? 'danger' : it.link && 'link', title: it.title, onclick: () => (hideMenu(), it.run()) },
        ico || h('span', { class: 'i' }),
        h('span', { class: 'label' }, it.label),
        it.note && h('span', { class: 'note' }, it.note)
      );
    })
  );
  menu.hidden = false;
  // 用 offsetWidth/Height:弹出动画还在缩放时,getBoundingClientRect 量到的尺寸偏小,菜单会超出侧边栏被裁掉
  menu.style.left = Math.max(4, Math.min(e.clientX, innerWidth - menu.offsetWidth - 4)) + 'px';
  menu.style.top = Math.max(4, Math.min(e.clientY, innerHeight - menu.offsetHeight - 4)) + 'px';
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
