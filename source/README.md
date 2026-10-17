# 主页和介绍视频的源文件

这个分支(`gh-pages`)就是 https://winzipsdo.github.io/sidearc/ 发布出去的内容:根目录下的 `index.html`、`style.css`、`main.js`、`assets/` 是主页本身,`store/` 和 `icons/` 是从 `main` 复制来的截图和图标。

`source/` 里是生成用的脚本,不在主页上引用:

| 文件 | 作用 |
| --- | --- |
| `build.js` | 把主页、截图和图标收集到 `dist/site/` |
| `video/scene.html`、`video/scene.js` | 介绍视频的画面和动画 |
| `video/music.js` | 视频的背景音乐 |
| `video/make.js` | 用无头 Chrome 一帧帧截图,交给 ffmpeg 编码成 `assets/intro.mp4` 和封面 `assets/intro-poster.jpg` |

## 修改主页文字

直接改根目录的 `index.html`,提交并推送 `gh-pages` 即可生效。

## 重新生成视频

脚本要用到插件本身的 `sidepanel.css` 和 `store/screenshots/brand-icons.js`,所以要在 `main` 的检出目录里运行:

1. 在 `main` 的检出目录里新建 `site/`,把这里的 `index.html`、`style.css`、`main.js`、`assets/` 和 `source/` 下的文件按原样放进去(`source/build.js` → `site/build.js`,`source/video/` → `site/video/`)。
2. 需要本机装有 Chrome 和 ffmpeg,运行 `node site/video/make.js`,生成 `site/assets/intro.mp4` 和 `site/assets/intro-poster.jpg`。
3. 运行 `node site/build.js`,把 `dist/site/` 的内容复制回这个分支的根目录,再把改过的脚本放回 `source/`,提交推送。
4. 删掉 `main` 检出目录里临时放的 `site/` 和 `dist/`,不要提交到 `main`。
