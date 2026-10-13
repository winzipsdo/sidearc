# 更新日志

版本号对应 `manifest.json` 里的 `version`。还没有版本号的改动以提交日期为标题。每条末尾括号里是对应的提交(commit hash),点击可查看具体改动。

## 2026-10-13

### 新增

- 相同地址只开一份:新开的标签页如果和本窗口里已有的标签页地址相同,会切到已有的那个并关掉新开的,可撤销。 ([`8801bbe`](https://github.com/winzipsdo/sidearc/commit/8801bbe))
- 编辑收藏或固定项时,名称留空会还原为网页标题。 ([`decf8d9`](https://github.com/winzipsdo/sidearc/commit/decf8d9))

### 变更

- 子标签只认网页里的链接:从其他应用点开的链接不再被挂到当前标签页下面。为此新增 `webNavigation` 权限。 ([`ef5fa20`](https://github.com/winzipsdo/sidearc/commit/ef5fa20))
- 收藏夹更紧凑:图标按数量均分每一行并撑满宽度,高度与搜索栏一致。 ([`bf96cd7`](https://github.com/winzipsdo/sidearc/commit/bf96cd7)、[`ef88f17`](https://github.com/winzipsdo/sidearc/commit/ef88f17))
- 右键菜单的「编辑别名、名称和网址…」改为「编辑别名…」。 ([`bf96cd7`](https://github.com/winzipsdo/sidearc/commit/bf96cd7))
- 扩展简介改为「把标签页放到侧边栏:垂直排列,支持子标签和空间,常用的固定在顶部。」 ([`4616d21`](https://github.com/winzipsdo/sidearc/commit/4616d21))

### 修复

- 相同地址查重漏掉了载入后自己改写地址的页面(比如飞书文档会先带着登录参数载入,再把地址改干净)。现在第一次载入后的 10 秒内,页面自己跳转或改写地址时会再查一次。 ([`5fd70ba`](https://github.com/winzipsdo/sidearc/commit/5fd70ba))
- 不带按钮的提示条(如「已撤销」)末尾多出 `undefined`。 ([`8801bbe`](https://github.com/winzipsdo/sidearc/commit/8801bbe))

### 重构

- `sidepanel.js` 拆成 `src/` 下的 ES 模块,纯逻辑抽到 `src/logic.js` 并加了测试(`npm test`);侧边栏和后台共用的存储键、消息格式集中到 `src/protocol.js`。行为不变。 ([`4141ec4`](https://github.com/winzipsdo/sidearc/commit/4141ec4))

### 文档

- README 的功能按类别分组,新增「权限与隐私」一节、快捷键表和「把侧边栏放到左边」的说明。 ([`34e9cc6`](https://github.com/winzipsdo/sidearc/commit/34e9cc6)、[`fa551d4`](https://github.com/winzipsdo/sidearc/commit/fa551d4)、[`4616d21`](https://github.com/winzipsdo/sidearc/commit/4616d21))

## 1.3.0 - 2026-10-13

### 新增

- 不记录历史的空间:在该空间里访问的网址会立刻从浏览历史中删除。为此新增 `history` 权限。 ([`7214d5d`](https://github.com/winzipsdo/sidearc/commit/7214d5d))
- 从 Arc 导入:通过空间菜单导入 `StorableSidebar.json` 里的收藏夹、各空间的固定标签和打开的标签页,可撤销。 ([`07be4c0`](https://github.com/winzipsdo/sidearc/commit/07be4c0))

### 修复

- 内容超出侧边栏高度时,固定标签与标签页列表互相重叠。 ([`7214d5d`](https://github.com/winzipsdo/sidearc/commit/7214d5d))

## 1.2.0 - 2026-10-13

### 新增

- 撤销:关闭标签页、清理、关闭下方所有标签页之后可以撤销,标签页会回到原来的位置,空间、别名和父子关系一并恢复。提示条上的「撤销」和 `Ctrl/⌘+Z` 共用一个撤销栈,可连续撤销多步。为此新增 `sessions` 权限。 ([`d4aa762`](https://github.com/winzipsdo/sidearc/commit/d4aa762))
- README 截图、隐私政策和 Chrome 应用商店上架资料。 ([`f98f0cc`](https://github.com/winzipsdo/sidearc/commit/f98f0cc))

### 修复

- 清理时,当前标签页会因为父标签页被关闭而一起被关掉。 ([`d4aa762`](https://github.com/winzipsdo/sidearc/commit/d4aa762))

## 1.1.0 - 2026-10-13

本版本的改动都在 [`5820dbe`](https://github.com/winzipsdo/sidearc/commit/5820dbe)。

### 新增

- 子标签:从某个标签页里打开的新标签页会缩进显示在它下面,最多两级;可拖拽归组或移出;关闭父标签页会连同子标签一起关闭。
- 别名:显示在标题左侧,搜索也会匹配。
- 重启后恢复:浏览器重启或扩展重新加载后,空间归属、别名、父子关系和固定绑定会自动对上。
- 取消固定或从收藏夹移除后可以撤销。
- 右键菜单新增「关闭下方所有标签页」「复制链接地址」「解除所有子标签」。

### 移除

- 右键菜单的「关闭其他标签页」。

## 1.0.0 - 2026-10-13

- 首个版本:垂直标签栏、收藏夹、按空间分组的固定标签、空间,基于 Manifest V3 和 `chrome.sidePanel`。 ([`637a72e`](https://github.com/winzipsdo/sidearc/commit/637a72e))
