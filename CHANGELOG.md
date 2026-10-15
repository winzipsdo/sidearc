# 更新日志

每条先用一句话说明变化,再说具体表现。末尾是对应的提交,点击可查看代码改动。

按提交日期分组,新的在前。

## 2026-10-15

### 新增

- **打开收藏或固定过的网址时,直接用那个收藏或固定标签打开。** [`f461947`](https://github.com/winzipsdo/sidearc/commit/f461947)
  - 比如在地址栏输入了一个已经固定的网址:以前会在下面的列表里多开一个标签页,现在它会直接出现在固定标签的位置上。
  - 如果那个固定标签已经开着、但后来点到了别的页面,会切回它并打开你输入的网址,不再多开一个。

## 2026-10-13

### 新增

- **同一个网址不再重复打开。** [`8801bbe`](https://github.com/winzipsdo/sidearc/commit/8801bbe)
  - 新开的标签页如果和当前窗口里已有的标签页是同一个网址,会切到已有的那个,并关掉新开的。
  - 底部提示条可以「撤销」,撤销后照常再开一份。
- **编辑收藏或固定标签时,名称清空即恢复成网页标题。** [`decf8d9`](https://github.com/winzipsdo/sidearc/commit/decf8d9)
- **可以把某个空间设为「不记录历史」。** [`7214d5d`](https://github.com/winzipsdo/sidearc/commit/7214d5d)
  - 在这个空间里打开的网页不会留在浏览历史里。这不是无痕模式,登录状态和缓存照常保留。
  - 为此新增了 `history` 权限。
- **可以从 Arc 浏览器导入。** [`07be4c0`](https://github.com/winzipsdo/sidearc/commit/07be4c0)
  - 在空间菜单里选「从 Arc 导入…」,收藏夹、各空间的固定标签和打开的标签页都会搬过来。导入后可以撤销。
- **关错标签页可以撤销。** [`d4aa762`](https://github.com/winzipsdo/sidearc/commit/d4aa762)
  - 关闭标签页、「清理」、「关闭下方所有标签页」之后,点底部提示条的「撤销」或按 `Ctrl+Z`(Mac 上是 `⌘+Z`)即可恢复,可以连续撤销多步。
  - 恢复的标签页回到原来的位置,所在空间、别名和子标签关系都保留。
  - 为此新增了 `sessions` 权限。
- **子标签。** 从某个标签页里打开的新标签页会缩进显示在它下面;可以拖拽调整;关闭父标签页时子标签一起关闭。 [`5820dbe`](https://github.com/winzipsdo/sidearc/commit/5820dbe)
- **别名。** 可以给标签页起个自己的名字,显示在标题前面,搜索时也能搜到。 [`5820dbe`](https://github.com/winzipsdo/sidearc/commit/5820dbe)
- **重启后不丢设置。** 浏览器重启后,标签页所在的空间、别名、子标签关系和固定标签都会自动恢复。 [`5820dbe`](https://github.com/winzipsdo/sidearc/commit/5820dbe)
- **取消固定、从收藏夹移除之后可以撤销。** [`5820dbe`](https://github.com/winzipsdo/sidearc/commit/5820dbe)
- **右键菜单新增**「关闭下方所有标签页」「复制链接地址」「解除所有子标签」。 [`5820dbe`](https://github.com/winzipsdo/sidearc/commit/5820dbe)
- **第一个版本。** 侧边栏里的垂直标签栏、收藏夹、固定标签和空间。[`637a72e`](https://github.com/winzipsdo/sidearc/commit/637a72e)

### 变更

- **从其他应用点开的链接不再变成子标签。** [`ef5fa20`](https://github.com/winzipsdo/sidearc/commit/ef5fa20)
  - 以前从飞书等应用点开链接,会被挂到你当时正在看的标签页下面;现在只有在网页里点开的链接才算子标签。
  - 为此新增了 `webNavigation` 权限。
- **收藏夹更紧凑。** [`bf96cd7`](https://github.com/winzipsdo/sidearc/commit/bf96cd7) · [`ef88f17`](https://github.com/winzipsdo/sidearc/commit/ef88f17)
  - 图标平均铺满每一行,右侧不再留空;高度和搜索栏一致。
- **右键菜单的「编辑别名、名称和网址…」简化为「编辑别名…」。** [`bf96cd7`](https://github.com/winzipsdo/sidearc/commit/bf96cd7)
- **商店简介改为「把标签页放到侧边栏:垂直排列,支持子标签和空间,常用的固定在顶部。」** [`4616d21`](https://github.com/winzipsdo/sidearc/commit/4616d21)

### 修复

- **飞书文档等页面的重复标签页有时没有被合并。** [`5fd70ba`](https://github.com/winzipsdo/sidearc/commit/5fd70ba)
  - 原因是这类页面打开后会自己改一次网址(比如去掉登录参数),第一次打开时的网址和最终网址对不上。现在会多等 10 秒再核对一次。
- **「已撤销」等提示后面多出了一个 `undefined`。** [`8801bbe`](https://github.com/winzipsdo/sidearc/commit/8801bbe)
- **标签页很多时,固定标签和下面的列表会叠在一起。** [`7214d5d`](https://github.com/winzipsdo/sidearc/commit/7214d5d)
- **「清理」有时会把当前正在看的标签页也关掉。** [`d4aa762`](https://github.com/winzipsdo/sidearc/commit/d4aa762)
  - 发生在当前标签页是某个被清理标签页的子标签时。

### 移除

- **右键菜单去掉了「关闭其他标签页」。** [`5820dbe`](https://github.com/winzipsdo/sidearc/commit/5820dbe)

### 内部改进

- **代码拆分成多个文件,并加了自动测试。** 使用上没有变化。[`4141ec4`](https://github.com/winzipsdo/sidearc/commit/4141ec4)

### 文档

- **README 重新整理。** 功能按类别分组,新增「权限与隐私」、快捷键表和「把侧边栏放到左边」的说明。[`34e9cc6`](https://github.com/winzipsdo/sidearc/commit/34e9cc6) · [`fa551d4`](https://github.com/winzipsdo/sidearc/commit/fa551d4) · [`4616d21`](https://github.com/winzipsdo/sidearc/commit/4616d21)
- **README 加了截图,补了隐私政策和应用商店上架资料。** [`f98f0cc`](https://github.com/winzipsdo/sidearc/commit/f98f0cc)
