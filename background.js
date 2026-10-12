// 点击工具栏图标(或快捷键)直接开关侧边栏
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

// 标签页关闭后,清掉它的空间归属(t:<tabId>)和与固定项的绑定(b:<itemId> -> tabId)
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const all = await chrome.storage.session.get(null);
  const keys = Object.keys(all).filter(
    (k) => k === `t:${tabId}` || (k.startsWith('b:') && all[k] === tabId)
  );
  if (keys.length) await chrome.storage.session.remove(keys);
});
