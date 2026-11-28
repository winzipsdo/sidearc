// 字体:默认用系统的;也可以在右下角的设置菜单里换成仓耳今楷(和主页一样,见 menus.js 的 fontPicker)。
// 标签页的标题什么字都可能有,要用就得是完整的字体(约 9 MB),不放在插件里:第一次选的时候从主页下载一次,
// 存在浏览器的缓存(Cache API)里,以后每次打开都从本机读,不再联网。这是插件唯一会联网的地方,不带任何数据。
// 选择存在 chrome.storage.local 的 font 里,所有窗口的侧边栏一起换(见 events.js)。
// 样式见 sidepanel.css:<html data-font="kai">,字体装好了才加上这个属性

export const FONTS = ['default', 'kai'];
export const FONT_URL = 'https://winzipsdo.github.io/sweeping-monk/assets/fonts/TsangerJinKai02-W04.woff2';
const FAMILY = 'Monk Kai';
const CACHE = 'fonts';
export let fontPref = 'default';
// 已经装进页面的字体
let face = null;

const cached = async () => (await caches.open(CACHE)).match(FONT_URL);
export const hasFont = () => cached().then(Boolean, () => false);

// 下载字体存到本机。onProgress(0..1) 报进度(服务器没说总大小时是 null)。
// 下到的不是字体(半截的、被换成了别的页面)会在这里报错,不存
export async function downloadFont(onProgress) {
  const res = await fetch(FONT_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = +res.headers.get('content-length') || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress?.(total ? Math.min(1, got / total) : null);
  }
  const blob = new Blob(chunks, { type: 'font/woff2' });
  await new FontFace(FAMILY, await blob.arrayBuffer()).load();
  await (await caches.open(CACHE)).put(FONT_URL, new Response(blob, { headers: { 'content-type': 'font/woff2' } }));
}

// 把本机存着的字体装进页面;还没下载过就返回 false
async function install() {
  if (face) return true;
  const res = await cached();
  if (!res) return false;
  // 只有一个字重:声明成所有字重都用它,粗的地方不让浏览器硬描粗(笔画会糊)
  const f = new FontFace(FAMILY, await res.arrayBuffer(), { weight: '100 900' });
  await f.load();
  document.fonts.add(f);
  face = f;
  return true;
}

export async function applyFont(pref) {
  fontPref = FONTS.includes(pref) ? pref : 'default';
  const root = document.documentElement;
  // 选了今楷但本机没有(比如清过浏览器数据):照默认字体显示,在菜单里再点一次会重新下载
  const ready = fontPref === 'kai' && (await install().catch(() => false));
  if (ready && fontPref === 'kai') root.dataset.font = 'kai';
  else delete root.dataset.font;
}
