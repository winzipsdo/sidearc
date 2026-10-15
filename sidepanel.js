// 侧边栏入口。各部分在 src/ 下:
//   store.js   状态和读写状态的函数        render.js  把状态画到页面上
//   tabs.js / items.js / spaces.js  对标签页、收藏/固定项、空间的操作
//   menus.js   右键菜单的内容              ui.js      提示条、撤销、菜单外壳、对话框
//   drag.js    拖拽                        events.js  事件绑定
//   folders.js 固定标签里的文件夹          dom.js     生成页面元素的小工具
//   logic.js   纯逻辑(有测试)              protocol.js 和 background.js 之间的约定

import { bindEvents } from './src/events.js';
import { render } from './src/render.js';
import { applySession, normalize, refreshTabs, save, setState, setWindowId } from './src/store.js';

async function init() {
  // 启动要读的几样互不依赖,一起读
  const [win, stored, session, tabs] = await Promise.all([
    chrome.windows.getCurrent(),
    chrome.storage.local.get('state'),
    chrome.storage.session.get(null),
    chrome.tabs.query({ windowId: chrome.windows.WINDOW_ID_CURRENT }),
  ]);
  setWindowId(win.id);
  setState(stored.state);
  normalize();
  if (!stored.state) save();
  for (const [k, v] of Object.entries(session)) applySession(k, v);
  bindEvents();
  await refreshTabs(tabs);
  render();
}

init();
