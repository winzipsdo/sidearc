# 主页、在线试用和介绍视频

这个分支(`gh-pages`)就是 https://winzipsdo.github.io/sidearc/ 发布出去的内容,所有东西都直接在这里改,`main` 上不放主页相关的文件。

| 位置 | 是什么 | 怎么来的 |
| --- | --- | --- |
| `index.html`、`style.css`、`main.js` | 主页本身(中英文写在一起) | 手写 |
| `demo/` | 在线试用:模拟的 Chrome(`sim.js`)、假的浏览器窗口(`demo.js`、`demo.css`)、假网站和初始状态(`web.js`)、给插件页面注入接口的 `inject.js` | 手写;`brand-icons.js` 从 `main` 复制 |
| `ext/` | 插件本身的代码,在线试用直接跑它 | `source/build.js` 从 `main` 复制,别手改 |
| `store/`、`icons/` | 应用商店截图、插件图标 | `source/build.js` 从 `main` 复制 |
| `assets/` | 标志、介绍视频 `intro.mp4` 和封面 `intro-poster.jpg` | 视频由 `source/video/make.js` 生成 |
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

直接改 `index.html`,提交推送后几分钟内生效。本地预览:在这个目录起一个静态服务器,比如 `npx serve .`。

## 重新生成视频

需要本机装有 Chrome 和 ffmpeg,先运行过一次 `source/build.js`(视频的侧边栏用 `ext/sidepanel.css`,网站内容用 `demo/web.js`):

```bash
node source/video/make.js
```

生成 `assets/intro.mp4` 和 `assets/intro-poster.jpg`,大约 15 分钟。Chrome 不在默认位置时,用环境变量 `CHROME` 指定。

| 文件 | 作用 |
| --- | --- |
| `video/scene.html`、`video/scene.js` | 视频的画面和时间线(1280×720 排版,输出时放大到 1920×1080) |
| `video/music.js` | 用正弦波合成的背景音乐和点击音效 |
| `video/make.js` | 用无头 Chrome 一帧帧截图,交给 ffmpeg 编码 |

想边改边看:起一个静态服务器,打开 `/source/video/scene.html?play` 实时播放;
控制台里调用 `seek(秒数)` 可以跳到任意一刻看定格的画面(插件 CSS 里的动效只有用 `seek` 时才会准确)。
