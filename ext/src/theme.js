// 浅色 / 深色:默认跟随系统,也可以在右下角的设置菜单里固定成浅色或深色(见 menus.js 的 themePicker)。
// 选择存在 chrome.storage.local 的 theme 里,所有窗口的侧边栏一起换(见 events.js);
// 另外抄一份到 localStorage,下次打开时 boot.js 在画出来之前就套上,不会先闪一下系统的颜色。
// 样式见 sidepanel.css 开头:<html data-theme="light|dark">,没有这个属性就是跟随系统

export const THEMES = ['auto', 'light', 'dark'];
// localStorage 里的键(boot.js 里也写着):名字带上 panel,主页的在线试用里侧边栏和主页同一个域,主页自己也有个 theme
const THEME_KEY = 'panel-theme';
export let themePref = 'auto';

export function applyTheme(pref) {
  themePref = THEMES.includes(pref) ? pref : 'auto';
  const root = document.documentElement;
  if (themePref === 'auto') delete root.dataset.theme;
  else root.dataset.theme = themePref;
  try {
    localStorage.setItem(THEME_KEY, themePref);
  } catch {}
}
