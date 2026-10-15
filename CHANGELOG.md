# 更新日志

每条先用一句话说明变化,再说具体表现。末尾是对应的提交,点击可查看代码改动。

按提交日期分组,新的在前。

## 2026-10-16

### 新增

- **开着的固定标签点进了别的页面时,能看出它去了哪,并一键回到固定的地址。** [`19d0398`](https://github.com/winzipsdo/sidearc/commit/19d0398)
  - 这一行会显示当前页面的标题和图标,前面用灰色小标签标着原来固定的名字。
  - 右边的按钮换成常驻的 ↩,点它回到固定地址;右键菜单里也有「回到固定地址」。这时要关掉标签页,用鼠标中键或右键「关闭标签页(保留固定)」。
  - 只是 `#` 锚点不同不算离开;搜索时按当前页面的标题也能搜到它。
- **点进别的页面后,可以把当前页面另存为收藏或固定标签,不影响正在看的页面。** [`f3176bd`](https://github.com/winzipsdo/sidearc/commit/f3176bd)
  - 右键这个收藏或固定标签,在「当前页面」一组里选「加入收藏夹」或「固定到当前空间」;标签页留在原处,原来的固定标签也不变。已经存在的不会重复添加,加完可以撤销。
- **固定标签里可以建文件夹。** [`9011485`](https://github.com/winzipsdo/sidearc/commit/9011485)
  - 点空间名右边的「⋯」选「新建文件夹…」,或右键固定标签选「新建文件夹并移入…」。
  - 把固定标签,或者下面列表里的标签页,拖到文件夹上就放进去;拖出来或右键「移出文件夹」就移出。文件夹本身也能拖动排序。
  - 点文件夹折叠或展开,折叠时显示「开着几项/共几项」;右键可重命名、删除(里面的固定标签会留下,可撤销)。
- **文件夹可以设为不记录历史。** [`9011485`](https://github.com/winzipsdo/sidearc/commit/9011485)
  - 右键文件夹开启后,从里面打开的页面(包括之后点进的其他页面)访问后立刻从浏览历史中删除。和「不记录历史的空间」一样,不是无痕模式。

### 变更

- **收起再打开侧边栏时不再先空一下。** 会先显示上次的画面,再换成最新的;第一次打开也快了不少。 [`649a6fe`](https://github.com/winzipsdo/sidearc/commit/649a6fe)
- **右键菜单都加上了图标,收藏和固定标签的菜单重新分组。** [`f3176bd`](https://github.com/winzipsdo/sidearc/commit/f3176bd)
  - 「移到空间」前面是该空间颜色的小圆点。
  - 「将网址更新为当前页面」改名为「替换原来的固定地址」,归到「当前页面」一组,只在点进了别的页面时出现。
- **在网页里 Ctrl/⌘+点击、中键点击打开的标签页,地址重复也不再合并。** [`9011485`](https://github.com/winzipsdo/sidearc/commit/9011485)
  - 在新标签页打开的链接也一样。从地址栏、其他应用、书签打开已开着的网址时,仍会切到已有的那个。

### 移除

- **去掉了「从 Arc 导入」。** [`9011485`](https://github.com/winzipsdo/sidearc/commit/9011485)
- **去掉了双击设置别名和重命名。** 改用右键菜单里的「设置别名…」「编辑别名…」「重命名…」。 [`9011485`](https://github.com/winzipsdo/sidearc/commit/9011485)

### 修复

- **扩展错误列表里不再出现「ResizeObserver loop completed with undelivered notifications」。** 收藏夹宽度变化时重排列数会引发这条警告,不影响使用。 [`7b6431d`](https://github.com/winzipsdo/sidearc/commit/7b6431d)

## 2026-10-15

### 新增

- **每个空间在顶部标签栏里是一个分组,其他空间的分组自动折叠。** [`b5f3ee8`](https://github.com/winzipsdo/sidearc/commit/b5f3ee8)
  - 顶部标签页的顺序和侧边栏一致;在顶部把标签页拖进别的分组就是移到那个空间,点开折叠的分组会切过去。
- **打开收藏或固定过的网址时,直接用那个收藏或固定标签打开。** [`ddb9421`](https://github.com/winzipsdo/sidearc/commit/ddb9421)
  - 比如在地址栏输入了一个已经固定的网址:以前会在下面的列表里多开一个标签页,现在它会直接出现在固定标签的位置上。
  - 如果那个固定标签已经开着、但后来点到了别的页面,会切回它并打开你输入的网址,不再多开一个。
- **固定标签没打开时,鼠标移上去可以直接取消固定。** [`2cd3f44`](https://github.com/winzipsdo/sidearc/commit/2cd3f44)
  - 打开着时仍是「−」,只关闭标签页、保留固定。

### 变更

- **固定标签开没开一眼能看出来。** 开着的标题和下面列表一样深,没开的标题和别名都变淡。 [`925abdc`](https://github.com/winzipsdo/sidearc/commit/925abdc)
- **空间切换圆点更好认。** 当前空间带一圈细环,悬停时显示空间名。 [`dfdcb9f`](https://github.com/winzipsdo/sidearc/commit/dfdcb9f)

### 修复

- **在一个空间里打开的网址,会因为别的空间开着同一个网址而跳过去。** 现在各空间互不干扰,只有收藏夹是共用的。 [`41285f2`](https://github.com/winzipsdo/sidearc/commit/41285f2)
- **在空的空间里新建标签页,标签页会跑到别的空间。** [`41285f2`](https://github.com/winzipsdo/sidearc/commit/41285f2)
- **右键菜单打开后去点网页,菜单不会消失。** 现在鼠标离开侧边栏后菜单会自动收起。 [`a1064f4`](https://github.com/winzipsdo/sidearc/commit/a1064f4)
- **`Cmd+Z` 现在也能恢复在 Chrome 标签栏里关掉的标签页。** [`59d1e41`](https://github.com/winzipsdo/sidearc/commit/59d1e41)
  - 和侧边栏里的操作按时间先后一起撤销;恢复后不保留别名和子标签关系。

### 文档

- **重做了应用商店的三张截图。** 换成现在的界面,并画出按空间分组的顶部标签栏;以后可以用 `npm run screenshots` 重新生成。 [`52017db`](https://github.com/winzipsdo/sidearc/commit/52017db)

## 2026-10-13

### 新增

- **同一个网址不再重复打开。** [`a17eba1`](https://github.com/winzipsdo/sidearc/commit/a17eba1)
  - 新开的标签页如果和当前窗口里已有的标签页是同一个网址,会切到已有的那个,并关掉新开的。
  - 底部提示条可以「撤销」,撤销后照常再开一份。
- **编辑收藏或固定标签时,名称清空即恢复成网页标题。** [`b3477e2`](https://github.com/winzipsdo/sidearc/commit/b3477e2)
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

- **从其他应用点开的链接不再变成子标签。** [`43bbdd1`](https://github.com/winzipsdo/sidearc/commit/43bbdd1)
  - 以前从飞书等应用点开链接,会被挂到你当时正在看的标签页下面;现在只有在网页里点开的链接才算子标签。
  - 为此新增了 `webNavigation` 权限。
- **收藏夹更紧凑。** [`4fc6070`](https://github.com/winzipsdo/sidearc/commit/4fc6070) · [`e87d4bb`](https://github.com/winzipsdo/sidearc/commit/e87d4bb)
  - 图标平均铺满每一行,右侧不再留空;高度和搜索栏一致。
- **右键菜单的「编辑别名、名称和网址…」简化为「编辑别名…」。** [`4fc6070`](https://github.com/winzipsdo/sidearc/commit/4fc6070)
- **商店简介改为「把标签页放到侧边栏:垂直排列,支持子标签和空间,常用的固定在顶部。」** [`f829549`](https://github.com/winzipsdo/sidearc/commit/f829549)

### 修复

- **飞书文档等页面的重复标签页有时没有被合并。** [`a7b17b8`](https://github.com/winzipsdo/sidearc/commit/a7b17b8)
  - 原因是这类页面打开后会自己改一次网址(比如去掉登录参数),第一次打开时的网址和最终网址对不上。现在会多等 10 秒再核对一次。
- **「已撤销」等提示后面多出了一个 `undefined`。** [`a17eba1`](https://github.com/winzipsdo/sidearc/commit/a17eba1)
- **标签页很多时,固定标签和下面的列表会叠在一起。** [`7214d5d`](https://github.com/winzipsdo/sidearc/commit/7214d5d)
- **「清理」有时会把当前正在看的标签页也关掉。** [`d4aa762`](https://github.com/winzipsdo/sidearc/commit/d4aa762)
  - 发生在当前标签页是某个被清理标签页的子标签时。

### 移除

- **右键菜单去掉了「关闭其他标签页」。** [`5820dbe`](https://github.com/winzipsdo/sidearc/commit/5820dbe)

### 内部改进

- **代码拆分成多个文件,并加了自动测试。** 使用上没有变化。[`12ae2a8`](https://github.com/winzipsdo/sidearc/commit/12ae2a8)

### 文档

- **README 重新整理。** 功能按类别分组,新增「权限与隐私」、快捷键表和「把侧边栏放到左边」的说明。[`34e9cc6`](https://github.com/winzipsdo/sidearc/commit/34e9cc6) · [`fa551d4`](https://github.com/winzipsdo/sidearc/commit/fa551d4) · [`f829549`](https://github.com/winzipsdo/sidearc/commit/f829549)
- **README 加了截图,补了隐私政策和应用商店上架资料。** [`f98f0cc`](https://github.com/winzipsdo/sidearc/commit/f98f0cc)
