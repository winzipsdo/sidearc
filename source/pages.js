// 从 source/index.html(中英文写在一起)生成两个页面,各自只留一种语言,方便搜索引擎分别收录:
//   index.html     中文,https://winzipsdo.github.io/sweeping-monk/
//   en/index.html  英文,https://winzipsdo.github.io/sweeping-monk/en/
// 带 data-l="zh" / data-l="en" 的元素(连同里面的内容)只留在对应语言的页面里;英文页在 en/ 下,相对地址前面补上 ../。
// 同时按语言填好结构化数据(JSON-LD:软件信息)和版本号、写 sitemap.xml,最后运行 stamp.js 加版本号。
// 改了 source/index.html、样式、脚本或视频后运行:node source/pages.js(source/build.js 最后也会运行)。

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = fileURLToPath(new URL('../', import.meta.url));
const ORIGIN = 'https://winzipsdo.github.io/sweeping-monk/';
const REPO = 'https://github.com/winzipsdo/sweeping-monk';
const PAGES = {
  zh: { file: 'index.html', url: ORIGIN, htmlLang: 'zh-CN' },
  en: { file: 'en/index.html', url: ORIGIN + 'en/', htmlLang: 'en' },
};
const VOID = new Set(['meta', 'link', 'img', 'br', 'input', 'source']);

// 去掉另一种语言的元素:从开始标签找到和它配对的结束标签(同名标签可以嵌套)
function dropLang(html, other) {
  const open = new RegExp(`<([a-z][a-z0-9]*)\\b[^>]*\\sdata-l="${other}"[^>]*>`, 'i');
  for (let m; (m = open.exec(html)); ) {
    const tag = m[1].toLowerCase();
    let end = m.index + m[0].length;
    if (!VOID.has(tag)) {
      const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
      re.lastIndex = end;
      for (let depth = 1, t; depth && (t = re.exec(html)); ) {
        depth += t[1] ? -1 : 1;
        end = re.lastIndex;
      }
    }
    html = html.slice(0, m.index) + html.slice(end);
  }
  return html;
}

// 英文页在 en/ 下:页面里的相对地址(脚本、样式、图片、视频)都往上一级
const relative = (v) => !/^(#|[a-z][a-z0-9+.-]*:|\/|\.\.\/)/i.test(v);
const upOneLevel = (html) => html.replace(/\s(src|srcset|href|poster)="([^"]*)"/g, (all, attr, v) => (v && relative(v) ? ` ${attr}="../${v}"` : all));

const TEXT = {
  zh: {
    name: '赭',
    alt: ['Sweeping Monk', '扫地僧', 'Sidearc'],
    app: 'Arc 风格的 Chrome 垂直标签页侧边栏,标签页各安其位:子标签、空间、固定标签、收藏夹和落叶提醒,和 Chrome 顶部标签栏双向同步。免费开源,数据只在本机。',
  },
  en: {
    name: 'Sweeping Monk',
    alt: ['赭', '扫地僧', 'Sidearc'],
    app: "Arc-style vertical tabs for Chrome, each tab in its place: child tabs, spaces, pinned tabs, favorites and fallen-leaf reminders, kept in two-way sync with Chrome's tab strip. Free and open source; data stays on your machine.",
  },
};

const { version } = JSON.parse(readFileSync(join(SITE, 'ext/version.json'), 'utf8'));

function jsonLd(lang) {
  const page = PAGES[lang];
  const t = TEXT[lang];
  const shots = lang === 'zh' ? 'store/' : 'store/en/';
  const graph = [
    {
      '@type': 'SoftwareApplication',
      '@id': ORIGIN + '#app',
      name: t.name,
      alternateName: t.alt,
      description: t.app,
      url: page.url,
      applicationCategory: 'BrowserApplication',
      applicationSubCategory: 'Chrome extension',
      operatingSystem: 'Chrome 116+',
      softwareVersion: version,
      downloadUrl: REPO + '/releases/latest',
      license: REPO + '/blob/main/LICENSE',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      image: ORIGIN + 'icons/128.png',
      screenshot: ['screenshot-1-tabs.jpg', 'screenshot-2-child-tabs.jpg', 'screenshot-3-spaces-dark.jpg'].map((f) => ORIGIN + shots + f),
      author: { '@type': 'Person', name: 'winzipsdo', url: 'https://github.com/winzipsdo' },
      sameAs: [REPO],
      inLanguage: ['zh-CN', 'en'],
    },
  ];
  // </script> 不能出现在内联脚本里
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2).replace(/</g, '\\u003c');
}

const source = readFileSync(join(SITE, 'source/index.html'), 'utf8');
for (const [lang, page] of Object.entries(PAGES)) {
  let html = dropLang(source, lang === 'zh' ? 'en' : 'zh');
  html = html.replace(/<html lang="[^"]*" data-lang="[^"]*">/, `<html lang="${page.htmlLang}" data-lang="${lang}">`);
  html = html.replace('<script type="application/ld+json" data-jsonld></script>', `<script type="application/ld+json">\n${jsonLd(lang)}\n</script>`);
  html = html.replace(/<!-- 项目主页的源文件[\s\S]*?-->/, '<!-- 由 source/pages.js 从 source/index.html 生成,不要直接改这个文件 -->');
  html = html.replaceAll('{{version}}', version);
  if (lang === 'en') html = upOneLevel(html);
  // 删掉另一种语言后留下的空行:<head> 里的全去掉,正文里连续的只留一行
  html = html.replace(/<head>[\s\S]*?<\/head>/, (head) => head.replace(/\n[ \t]*(?=\n)/g, '')).replace(/\n([ \t]*\n){2,}/g, '\n\n');
  mkdirSync(join(SITE, page.file, '..'), { recursive: true });
  writeFileSync(join(SITE, page.file), html);
}

// sitemap.xml:两个页面互为对方的另一种语言版本。主页在 winzipsdo.github.io 的子目录里,
// 根目录的 robots.txt 不归这个仓库管,所以 sitemap 要在 Google Search Console 里手动提交一次
const alt = Object.values(PAGES)
  .map((p) => `    <xhtml:link rel="alternate" hreflang="${p.htmlLang}" href="${p.url}"/>`)
  .join('\n');
writeFileSync(
  join(SITE, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    Object.values(PAGES)
      .map((p) => `  <url>\n    <loc>${p.url}</loc>\n${alt}\n  </url>`)
      .join('\n') +
    '\n</urlset>\n'
);
console.log('已生成 index.html、en/index.html 和 sitemap.xml');

// 页面的字体是只含用到的字的子集(assets/fonts/,由 source/fonts.py 生成):文字里出现了子集里没有的字,提醒重新生成,
// 不然那几个字会换成系统字体,和旁边的不一样
const have = new Set(readFileSync(join(SITE, 'assets/fonts/chars.txt'), 'utf8'));
const used = new Set(['index.html', 'en/index.html', 'main.js'].flatMap((f) => [...readFileSync(join(SITE, f), 'utf8')]));
const missing = [...used].filter((c) => c > ' ' && !have.has(c));
if (missing.length) console.warn(`字体子集里没有这 ${missing.length} 个字:${missing.join('')}
运行 python source/fonts.py 重新生成`);

await import('./stamp.js');
