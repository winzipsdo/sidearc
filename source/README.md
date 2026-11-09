# 主页、在线试用和介绍视频

这个分支(`gh-pages`)就是 https://winzipsdo.github.io/sidearc/ 发布出去的内容,所有东西都直接在这里改,`main` 上不放主页相关的文件。

| 位置 | 是什么 | 怎么来的 |
| --- | --- | --- |
| `source/index.html` | 主页的源文件,中英文写在一起(`data-l` 标明语言) | 手写 |
| `index.html`、`en/index.html`、`sitemap.xml` | 中文页、英文页和网站地图 | `source/pages.js` 从 `source/index.html` 生成,别手改 |
| `style.css`、`main.js` | 主页的样式和脚本,两个页面共用 | 手写 |
| `demo/` | 在线试用:模拟的 Chrome(`sim.js`)、假的浏览器窗口(`demo.js`、`demo.css`)、假网站和初始状态(`web.js`)、给插件页面注入接口的 `inject.js` | 手写;`brand-icons.js` 从 `main` 复制 |
| `ext/` | 插件本身的代码,在线试用直接跑它 | `source/build.js` 从 `main` 复制,别手改 |
| `store/`、`icons/` | 应用商店截图、插件图标 | `source/build.js` 从 `main` 复制 |
| `assets/` | 标志、介绍视频 `intro.mp4` 和封面 `intro-poster.jpg`;`videos/` 里是给短视频平台的竖屏短片(`douyin.mp4` 和没有配乐的 `douyin-silent.mp4`)和从介绍视频剪出来的落叶片段 `fallen-leaves.mp4`,主页上不引用 | 视频由 `source/video/make.js` 生成 |
| `source/` | 生成用的脚本,主页上不引用 | 手写 |

## 在线试用是怎么跑起来的

左边的侧边栏就是插件的 `sidepanel.html`(放在 iframe 里),后台 `background.js` 也在一个看不见的 iframe 里跑。
插件的代码一行没改:`source/build.js` 只在复制出来的 `sidepanel.html` 最前面插了一行 `demo/inject.js`,
它把 `window.chrome` 换成 `demo/sim.js` 模拟的接口(标签页、分组、存储、消息、最近关闭、网页导航……)。
所以插件的新功能,重新运行一次 `source/build.js` 就会出现在试用里。

如果插件用上了新的 `chrome.*` 接口,在 `sim.js` 的 `connect()` 里补上;试用的初始状态(空间、收藏、开着的标签页)在 `web.js` 的 `scenario()` 里。
主页右边的任务清单在 `main.js` 的 `TASKS` 里,完成条件是 `demo.js` 通过 `onAction` 报上来的操作。

## 插件更新后同步过来

在 `main` 的检出目录旁边开一个这个分支的工作目录(不要在同一个目录里来回切分支,两个分支的文件完全不同):

```bash
git worktree add ../sidearc-pages gh-pages
cd ../sidearc-pages
node source/build.js ../sidearc     # 参数是 main 的检出目录
git add -A && git commit -m "Site: update the extension to <版本号>" && git push
```

## 修改主页文字

改 `source/index.html`(中英文写在一起:同一处的两种语言各包在 `data-l="zh"`、`data-l="en"` 的元素里),然后运行:

```bash
node source/pages.js
```

它生成中文页 `index.html` 和英文页 `en/index.html`(各只留一种语言,有各自的标题、描述、canonical、hreflang 和结构化数据),写 `sitemap.xml`,再给引用的样式、脚本、视频加上版本号(否则浏览器会拿缓存里的旧文件配新页面)。改了 `style.css`、`main.js`、`demo/` 或重新生成了视频,也要运行一次。提交推送后几分钟内生效。本地预览:在这个目录起一个静态服务器,比如 `npx serve .`。

### 搜索引擎

- 中文页和英文页是两个网址,互相用 hreflang 标明;右上角的语言按钮是到另一个页面的链接,选择会被记住,下次直接打开那种语言。浏览器语言和页面不一样时,顶部提示有另一种语言的版本,但不自动跳转,免得爬虫收录不到中文页。
- 结构化数据(JSON-LD):`SoftwareApplication`(版本号取自 `ext/version.json`)和介绍视频的 `VideoObject`(时长从 MP4 读,上传时间是它最近一次提交的时间),都由 `source/pages.js` 生成。
- `ext/` 的两个页面和 `source/video/scene.html` 带 `noindex`,不会被当成空页面收录。
- 主页在 `winzipsdo.github.io` 的子目录里,根目录的 `robots.txt` 不归这个仓库管,`sitemap.xml`(https://winzipsdo.github.io/sidearc/sitemap.xml)要在 Google Search Console 里手动提交一次。

## README 里的动图

`main` 的 README 开头的三张动图(双向同步、空间、落叶)放在这个分支的 `assets/readme/<zh|en>/`,README 用 `https://winzipsdo.github.io/sidearc/assets/readme/...` 引用,`main` 上不放大文件。同一次录制还会生成同名的 `.mp4`、`.webm`(2 倍分辨率)和封面 `.webp`,主页的功能介绍用的是这些视频,比 GIF 清楚。它们是在在线试用里(插件本身的代码)用脚本操作一遍录下来的,界面改了重新录:

```bash
NODE_PATH=$(npm root -g) node source/readme/record.js          # 全部
NODE_PATH=$(npm root -g) node source/readme/record.js leaves   # 只录某一段:sync、spaces、leaves
```

需要 Playwright 和 ffmpeg。操作步骤在 `source/readme/record.js` 里,录制台是 `source/readme/stage.html`。

## 重新生成视频

需要本机装有 Chrome 和 ffmpeg,先运行过一次 `source/build.js`(视频的侧边栏用 `ext/sidepanel.css`,网站内容用 `demo/web.js`):

```bash
node source/video/make.js
```

生成 `assets/intro.mp4` 和 `assets/intro-poster.jpg`,大约 15 分钟。Chrome 不在默认位置时,用环境变量 `CHROME` 指定。

| 文件 | 作用 |
| --- | --- |
| `video/scene.html`、`video/scene.js` | 介绍视频的画面和时间线(1280×720 排版,输出时放大到 1920×1080) |
| `video/short.html`、`video/short.js` | 竖屏短片的画面和时间线(540×960 排版,输出时放大到 1080×1920) |
| `video/engine.js`、`video/content.js` | 两个视频共用的时间线工具、落叶,以及图标、标签页、侧边栏的行 |
| `video/music.js`、`video/music-short.js` | 用正弦波合成的背景音乐和音效(短片的配乐每分钟 120 拍,和画面对齐) |
| `video/make.js` | 用无头 Chrome 一帧帧截图,交给 ffmpeg 编码 |

### 竖屏短片

给抖音这类平台的短片,十几秒,一屏一句大字:标签栏挤爆了 → 按 Alt+S 一键竖起来 → 好久没看的标签页落满叶子 → 扫一扫 / 直接关 → GitHub 搜 Sidearc。

```bash
node source/video/make.js short
```

生成 `assets/videos/douyin.mp4` 和没有配乐的 `douyin-silent.mp4`(在平台上挂热门音乐用),一两分钟;封面在平台上发布时选。平台会在顶部、右侧和底部盖上自己的按钮和文字,要紧的内容放在中间偏左。预览:`/source/video/short.html?play`。

落叶片段 `assets/videos/fallen-leaves.mp4` 是从介绍视频里剪出来的(落叶那一幕,约 8 秒,头尾淡入淡出),介绍视频重新生成后可以照样再剪:

```bash
ffmpeg -ss 48.55 -i assets/intro.mp4 -t 8.35 -vf "fade=t=in:st=0:d=0.35,fade=t=out:st=7.75:d=0.6,format=yuv420p" -af "afade=t=in:st=0:d=0.35,afade=t=out:st=7.6:d=0.75" -c:v libx264 -crf 18 -c:a aac -b:a 160k -movflags +faststart assets/videos/fallen-leaves.mp4
```

想边改边看:起一个静态服务器,打开 `/source/video/scene.html?play` 实时播放;
控制台里调用 `seek(秒数)` 可以跳到任意一刻看定格的画面(插件 CSS 里的动效只有用 `seek` 时才会准确)。
