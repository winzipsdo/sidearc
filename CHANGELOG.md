# 更新日志

每条先用一句话说明变化,再说具体表现。末尾是对应的提交,点击可查看代码改动。

按提交日期分组,新的在前。

## 2026-11-10

### 变更

- **拆分视图里和正在看的那个并排的标签页,不再画足迹。** 它就显示在眼前,不算离开;空出来的名额留给更早离开的标签页。 [`a89af87`](https://github.com/winzipsdo/sidearc/commit/a89af87)
- **休眠的固定标签在行尾标着睡了多久,和关掉的分得开。** 以前休眠的和已经关掉的固定标签变淡得一模一样;现在休眠的和下面标签页列表里一样,行尾显示休眠了多久(比如「3 小时」),关掉的没有。 [`826a376`](https://github.com/winzipsdo/sidearc/commit/826a376)

### 修复

- **关掉休眠了的固定标签时,也不再凭空飞出一阵落叶。** 标签页从下面的列表里固定或收藏之后,原来积下的叶子还记在它身上;关掉时会从它很久以前在列表里的位置飞出来。现在不在眼前的叶子直接丢掉,只有列表里看得到的才被吹走。 [`0dc7a40`](https://github.com/winzipsdo/sidearc/commit/0dc7a40)
- **关掉收藏或固定标签时,不再莫名其妙地飘一阵落叶。** 关掉后它会先作为普通标签页在下面的列表里闪一下,带着积下的落叶,随即叶子被吹走;现在关掉后直接消失。 [`73e56e9`](https://github.com/winzipsdo/sidearc/commit/73e56e9)

## 2026-11-09

### 新增

- **右键一个标签页,就能和正在看的那个拼成拆分视图。** 右键任意一个不是正在看的标签页,选「与当前标签页拆分视图」,它挪到正在看的那个右边,两个并排,不用先多选。这一项是 Chrome 标签页菜单里「使用当前标签页创建新的拆分视图」的简写。两个里有一个已经在拆分视图里、或者不在同一个分组里(比如一个是收藏)时不显示。需要 Chrome 155 以上。 [`b835b91`](https://github.com/winzipsdo/sidearc/commit/b835b91) [`93ebfbd`](https://github.com/winzipsdo/sidearc/commit/93ebfbd)
- **把标签页拖到另一行的右半边,拼成拆分视图。** 拖到一行的中间偏右时,右半边出现一个写着「拆分视图」的虚线框,松手后拖的那个放到右边,两个并排;中间偏左还是变成子标签,上下边缘还是排序。多选一起拖、拖到已经在拆分视图里的行上时没有这个框。带着子标签拖时子标签跟着走。需要 Chrome 155 以上。 [`3376646`](https://github.com/winzipsdo/sidearc/commit/3376646)

### 变更

- **打开侧边栏时,落叶从上面飘下来。** 以前已经落着的叶子会从行的左边横着滑到位置上;现在等列表淡入后,它们错开着从上面飘落。拖宽、拖窄侧边栏时,叶子直接换到新的位置,不再横着滑。系统开了「减少动态效果」时直接显示。 [`e871f96`](https://github.com/winzipsdo/sidearc/commit/e871f96)

### 修复

- **固定标签和收藏不再能拼进拆分视图。** 以前正在看固定标签时,右键列表里的标签页会出现「与当前标签页拆分视图」,右键固定标签也会出现,拼出来的一对在侧边栏里没有合适的位置。现在右键菜单、多选两个后的「在拆分视图中打开」、拖到另一行右半边,都只在列表里的普通标签页之间可用。 [`76c5f70`](https://github.com/winzipsdo/sidearc/commit/76c5f70)

## 2026-11-08

### 新增

- **支持 Chrome 的分屏(Split View)。** 两个标签页在 Chrome 里并排显示时,侧边栏里它们挨在一起、合成一块浅底,正在看的那个照常是白卡片。拖动其中一个、移到别的空间、拖进别的标签页当子标签,两个都一起走;以前顶部标签栏同步或拖动排序时会把分屏拆开,现在不会了。往这一对中间放标签页时会放到它们前面。正在看分屏里的一个时,另一个不再被当成多选;在分屏里新开的标签页也不会因为地址重复被关掉。需要 Chrome 140 以上。 [`66db092`](https://github.com/winzipsdo/sidearc/commit/66db092)
- **可以在侧边栏右键里创建、反转、取消拆分视图。** 多选两个标签页后右键选「在拆分视图中打开」,不挨着的会先挪到一起,然后切过去;右键拆分视图里的任意一个,选「反转视图」把两边对调,原来在看的那个照样在看,选「取消拆分视图」把两个分开、都留在原地;多选里有拆分视图时,多选菜单也能取消。叫法和 Chrome 自己的菜单一样。需要 Chrome 155 以上,更早的版本菜单里不显示。 [`9cf95d1`](https://github.com/winzipsdo/sidearc/commit/9cf95d1)
- **可以把空间或选中的标签页复制成 Markdown,方便贴给 AI。** 右键空间圆点(或点右上角三个点)选「复制成 Markdown」,整个空间的标签页变成「- [标题](链接)」的列表,开头一行是空间名;固定区的文件夹单独一行、里面的项缩进,子标签页也缩进;新标签页跳过,收藏所有空间共用,不算在内。多选标签页后右键,只复制选中的。用的是网页自己的标题,不是别名。 [`b97a657`](https://github.com/winzipsdo/sidearc/commit/b97a657)
- **可以自己撒落叶了。** 右键标签页选「撒落叶」,在现有的基础上随机再落 1 到 6 片,一样最多 12 片,落满了这一项置灰;多选时每个各撒各的。正在看的标签页也能撒,离开后还留着,再点回来时被吹走。撒的叶子和按时间落的不叠加:撒到 4 片后,要等按时间该落第 5 片时才会再多;扫干净或点进去时一起清掉。 [`212ec74`](https://github.com/winzipsdo/sidearc/commit/212ec74)

### 变更

- **手动休眠时顺便取消保持唤醒。** 以前开着保持唤醒的标签页休眠后,行上还挂着保持唤醒的小锁,看着自相矛盾;现在休眠时一起取消,提示里会说明。 [`fa9b7c1`](https://github.com/winzipsdo/sidearc/commit/fa9b7c1)
- **标签页右键菜单里去掉「移出为顶级标签页」。** 子标签页行上关闭按钮左边的移出按钮还在,右键父标签页选「解除所有子标签」也还能一次全部移出。 [`c19782d`](https://github.com/winzipsdo/sidearc/commit/c19782d)
- **右键菜单更紧凑,悬停改成浅灰底。** 每一项从 30px 收到 28px,四周留白和分隔线也收紧一点,长菜单矮了一截。鼠标停在某一项上时是浅灰底、文字和图标不变色,不再用空间主题色底白字:主题色是红色时,每一项悬停都像「删除」。删除一类的项还是红字。 [`989e7ce`](https://github.com/winzipsdo/sidearc/commit/989e7ce)
- **离开满一天就落第一片叶子。** 以前要先空一天、再等一个间隔才落第一片,按默认的每 12 小时一片算要 36 小时;现在满 24 小时落第一片,之后每个间隔多一片,最多还是 12 片。更新后已有的标签页会多出一片。 [`847521c`](https://github.com/winzipsdo/sidearc/commit/847521c)
- **右键菜单挂在被右键的那一项旁边,不再盖住它。** 以前菜单从鼠标位置弹出,侧边栏放不下就往回推,常常盖住被右键的那一行,每次出现的位置也不一样。现在菜单出现在这一行(或收藏磁贴)正下方,左右从鼠标的位置展开;下面放不下就翻到上面,底部的空间圆点往上弹;上下都放不下时才往回推,让整个菜单露出来。多选时挂在点的那一行上,用键盘菜单键打开也一样。 [`16a6e3b`](https://github.com/winzipsdo/sidearc/commit/16a6e3b)

## 2026-11-07

### 新增

- **右键菜单开着时,看得出它是给谁的。** 被右键的那一行(标签页、固定标签、文件夹)、收藏磁贴或空间圆点染一层主题色,和菜单里高亮的项同色;多选时右键,选中的几行都亮。菜单关了就恢复。 [`676b985`](https://github.com/winzipsdo/sidearc/commit/676b985)

### 修复

- **列表末尾的加号悬停时不再放大过头。** 圆圈里多套了一层,底色叠了两遍,悬停时也放大了两次;现在只有一层,平时看起来和原来一样,悬停时按设计放大一点。 [`5145018`](https://github.com/winzipsdo/sidearc/commit/5145018)
- **搜索时侧边栏不再一直报错。** 1.9.0 新加的「回到当前标签页」小胶囊,在搜索框里有字时每次重画、每次滚动都会抛出错误;现在搜索时它安静地收起。 [`22dcab7`](https://github.com/winzipsdo/sidearc/commit/22dcab7)
- **再点一次三个点、设置或最近关闭按钮,菜单会关上。** 以前刚关上又被同一次点击打开,看起来关不掉。 [`676b985`](https://github.com/winzipsdo/sidearc/commit/676b985)
- **点了底部的按钮后鼠标不动,提示不再和菜单叠在一起。** 菜单开着时底部这一排都不出提示。 [`676b985`](https://github.com/winzipsdo/sidearc/commit/676b985)
- **键盘选中框贴着右边时不再被裁掉一截。** [`ac00621`](https://github.com/winzipsdo/sidearc/commit/ac00621)
- **列表长到要滚动时,内容不再被滚动条挤窄、跳一下。** Windows 上滚动条要占一条宽度,以前它一出现,标题、收藏、落叶都跟着挪;打开侧边栏 0.7 秒后滚动条显示出来时也会跳一下。现在滚动条的位置一直留着,有没有滚动条,内容离两边都是 12px;Mac 上不受影响。 [`0876199`](https://github.com/winzipsdo/sidearc/commit/0876199)
- **落叶不再几片叠成一堆。** 每片新叶子会落到离已有叶子最远的空当里,在行的后半段铺得更匀;同一个标签页的叶子每次都落在同样的位置。 [`e21ca90`](https://github.com/winzipsdo/sidearc/commit/e21ca90)
- **连点文件夹时,箭头和里面的行偶尔对不上。** 动画刚播完、还没收尾时又点一下,现在会等收尾后再正常开合。 [`8129107`](https://github.com/winzipsdo/sidearc/commit/8129107)
- **重画后,鼠标停着的那一行的悬停底色会闪一下。** 现在重画后直接是悬停的样子,鼠标一动再交还给正常的悬停效果。 [`3a885c0`](https://github.com/winzipsdo/sidearc/commit/3a885c0)
- **Windows 上打开侧边栏时,滚动条会闪一下又消失。** 打开后淡入的那 0.7 秒里列表先不画滚动条(仍然能滚),之后再按实际情况显示。 [`8711ee5`](https://github.com/winzipsdo/sidearc/commit/8711ee5)

### 变更

- **键盘选中框的动效收敛了。** 移到新的项上只轻轻落定,不再回弹;往走不过去的方向按,只轻推一下,不再来回晃;呼吸的颜色收在同一种青蓝里,外圈的光也小了。 [`ac00621`](https://github.com/winzipsdo/sidearc/commit/ac00621)
- **右上角三个点的菜单固定弹在按钮下方。** 右对齐,不再跟着鼠标点的位置;菜单开着时按钮保持按下的样子。 [`676b985`](https://github.com/winzipsdo/sidearc/commit/676b985)
- **搜索时的历史记录可以展开更多。** 还是先列 8 条;匹配的更多时,末尾一行「再显示 N 条」,点一下(或选中后按回车)展开,最多 50 条。换了搜索词就收回 8 条。 [`fcc1590`](https://github.com/winzipsdo/sidearc/commit/fcc1590)
- **文件夹展开、收起有了抽屉动效。** 里面的几行从文件夹那一行下面滑出来、同时淡入,收起时滑回去、淡出,下面的行跟着平滑让开;文件夹图标换成跟着转动的箭头;动画没播完又点一下,会从当前位置原路倒回,不再跳变。 [`3a885c0`](https://github.com/winzipsdo/sidearc/commit/3a885c0)

### 文档

- **README 的权限说明写清 history 的用途。** 搜索时会列出最近 30 天里匹配的网页、可以删掉某一条,原来只写了「不记录历史」的空间和文件夹。 [`d950015`](https://github.com/winzipsdo/sidearc/commit/d950015)

## 2026-11-06

### 新增

- **打开侧边栏时内容淡入。** 背景先从接近 Chrome 侧边栏的中性底色淡入空间主题色,不再一下子跳变;顶部、标签页列表、底部依次错开一点淡入并轻轻升上来。系统开了「减少动态效果」时直接显示。 [`faf094d`](https://github.com/winzipsdo/sidearc/commit/faf094d) [`058793f`](https://github.com/winzipsdo/sidearc/commit/058793f)
- **当前标签页滚出视野时,可以一键回去。** 它在上面看不见,列表顶端就浮出一个带它图标和 ↑ 的小胶囊;在下面看不见,就浮在底部(有提示条时让到提示条上方)。点一下平滑滚回去,让它停在中间并亮一下。露出一点就收起,搜索时不出现。 [`597e139`](https://github.com/winzipsdo/sidearc/commit/597e139)
- **多选了几个标签页时,按 Delete 一起关掉。** 和右键菜单里的「关闭」一样,提示条里可以撤销;键盘选中框停在别的项上时还是只关那一项。 [`dc309d1`](https://github.com/winzipsdo/sidearc/commit/dc309d1)

### 变更

- **重画更快、次数更少。** 落叶的画布改成一起挂上、一起量尺寸,不再每一行都让整页重新排一遍;图标只解析一次,之后复制。200 个标签页时重画一次的时间约减半。别的窗口里标签页加载、改标题不再让这个窗口的侧边栏重画,后台接连几次写入存储也合成一次重画。 [`8089ddd`](https://github.com/winzipsdo/sidearc/commit/8089ddd) [`c9e7313`](https://github.com/winzipsdo/sidearc/commit/c9e7313)
- **合并相同地址的标签页后,侧边栏滚到已有的那个。** 新开的标签页和已有的地址相同、被关掉并切到已有的那个时,列表滚到它那里、停在中间并亮一下;已经整个看得见就只亮一下,是收藏就让收藏图标亮一下。搜索时不滚。 [`3c4810b`](https://github.com/winzipsdo/sidearc/commit/3c4810b)
- **列表末尾的加号平时藏起来,鼠标靠近才出现。** 免得和底部新建空间的加号撞在一起;鼠标移到最后一个标签页下面那一行(或用键盘选中)时浮出来,只有点到圆上才开新标签页。 [`0386c03`](https://github.com/winzipsdo/sidearc/commit/0386c03)
- **鼠标停在列表的行上不再弹出浏览器自带的提示框。** 标签页、固定标签、文件夹和搜索时的历史记录都去掉了(原来显示网址、休眠开始的时间等);收藏夹的图标、行上的按钮照旧有提示。固定标签开在别的窗口时,那个小窗口图标自己带提示。 [`8058f08`](https://github.com/winzipsdo/sidearc/commit/8058f08)
- **「新标签页」改成标签页列表末尾居中的圆形加号。** 原来在列表上方带文字的一行,和真的新标签页长得一样;现在跟在最后一个标签页下面,鼠标移到圆上才变成主题色。新标签页就开在列表末尾、刚才点加号的地方,列表能滚动时自动滚到能看见它;点完加号先隐去 1 秒再出现。搜索时不显示。 [`78d48fd`](https://github.com/winzipsdo/sidearc/commit/78d48fd)

## 2026-11-05

### 新增

- **搜索框有内容时右边出现 × 清空。** 点了只清掉搜索词,光标还在框里,可以接着输新的。 [`5616205`](https://github.com/winzipsdo/sidearc/commit/5616205)

### 变更

- **点开搜索结果后退出搜索。** 点历史记录、标签页、收藏或固定标签(包括选中后按回车),搜索词清空、搜索框收起,回到平常的列表;点行上的关闭、休眠、删除等按钮不退出,方便连着处理几条。 [`5616205`](https://github.com/winzipsdo/sidearc/commit/5616205)
- **空间菜单里去掉「新建空间」,几条过长的英文菜单项改短。** 新建空间用最下面一排的加号。英文菜单里 New folder with this tab… 改成 Move to new folder…,Put all tabs in space/folder to sleep 改成 Sleep all tabs in space/folder。 [`6f7824b`](https://github.com/winzipsdo/sidearc/commit/6f7824b)

### 文档

- **README 的功能介绍精简了。** 只留一句话一个功能,分成「整理」「找回来」「不添乱」三组,加了徽章;原来每个功能的完整说明挪到 `docs/features.md`(英文 `docs/features.en.md`)。 [`6b4635f`](https://github.com/winzipsdo/sidearc/commit/6b4635f)
- **README 开头换成动图。** 静态截图下面换成三张动图:双向同步、空间就是顶部的分组、扫掉落叶;动图从在线试用里录制,放在主页上,`main` 不放大文件。顶部加了在线试用的链接。 [`21c01c3`](https://github.com/winzipsdo/sidearc/commit/21c01c3)

## 2026-11-03

### 修复

- **关掉固定标签时,下面的列表不再闪出一行带落叶的标签页。** 以前关的那一刻,它会先作为普通标签页在下面出现一下(积着的落叶也跟着冒出来),再被关掉;现在直接消失。关文件夹里所有标签页时也一样。 [`915601c`](https://github.com/winzipsdo/sidearc/commit/915601c)

## 2026-10-30

### 新增

- **搜索时也列出历史记录。** 输入两个字以上,标签页下面多一段「历史记录」:最近 30 天里匹配的网页,最多 8 条,已经开着的不重复,行尾显示多久以前访问过;点一下在新标签页打开,点叉号(或选中后按 Delete)从浏览器的历史记录里删掉。 [`158ea8a`](https://github.com/winzipsdo/sidearc/commit/158ea8a)

### 变更

- **落叶改成离开一天后才开始落,最多 12 片。** 离开超过 24 小时后,每再过 6、8 或 12 小时落一片(默认 12 小时),上限从 8 片改成 12 片。设置菜单里足迹和落叶两行的选项对齐了,英文下也不再被截掉。 [`00836b3`](https://github.com/winzipsdo/sidearc/commit/00836b3)

## 2026-10-29

### 新增

- **很久没进去过的标签页会落上叶子。** 从上次离开算起每 12 小时落一片,最多 8 片,只铺在行尾,不挡图标和标题开头;鼠标左右来回扫几下就扫干净并重新计时,点进去叶子被吹走,关掉时跟着飘走。多久落一片在右下角的设置里选,也可以关掉。 [`0550d1b`](https://github.com/winzipsdo/sidearc/commit/0550d1b)

### 文档

- **加了「旧标签」交互的预览页。** `previews/stale-tabs.html` 里能对比褪色、落灰、落叶几种方案。 [`d42e508`](https://github.com/winzipsdo/sidearc/commit/d42e508)

### 变更

- **右键菜单的「复制」改叫「创建副本」。** 标签页、收藏和固定标签的菜单都一样,免得和「复制链接地址」混在一起。 [`c148d67`](https://github.com/winzipsdo/sidearc/commit/c148d67)

## 2026-10-28

### 新增

- **收藏和固定标签也能「复制」。** 副本放在它正下方,在文件夹里就还在这个文件夹里;开着的副本也开着(带前进后退记录),没开的也先不开;已经点进别的页面的,副本以当前页面为地址,不带返回状态和别名。 [`8c51352`](https://github.com/winzipsdo/sidearc/commit/8c51352)

## 2026-10-26

### 新增

- **点空间名可以把固定标签整个折叠起来。** 每个空间各记各的;折叠时只留正在看的那个,空间名后面标着开着几个;拖标签页到空间名上会临时展开。 [`b286af7`](https://github.com/winzipsdo/sidearc/commit/b286af7)
- **标出开在另一个窗口里的收藏和固定标签。** 显示一个带箭头的小窗口图标,悬停提示「已在另一个窗口中打开」;点了会有一个往外「跳出去」的动效,再切到那个窗口。 [`10a407c`](https://github.com/winzipsdo/sidearc/commit/10a407c)
- **文件夹里的固定标签可以一键移出。** 鼠标移上去时,关闭按钮左边多了一个「移出文件夹」按钮,和子标签的「移出」一样。 [`1ed9634`](https://github.com/winzipsdo/sidearc/commit/1ed9634)
- **右键文件夹可以「关闭文件夹内所有标签」。** 关掉里面开着的标签页,固定标签都留着;可以撤销,撤销时恢复原来的页面并绑回固定标签。 [`6f512bc`](https://github.com/winzipsdo/sidearc/commit/6f512bc)

### 变更

- **列表底部也渐隐。** 下面还有内容时,最下面一小段淡进底部那一行;滚到底就不淡了。 [`f959464`](https://github.com/winzipsdo/sidearc/commit/f959464)

### 修复

- **拖到带足迹的收藏或标签上时,插入线顶上的小圆圈会被拉扁、跑到图标中间。** 当落点的那一刻不再画足迹。 [`bb9c46f`](https://github.com/winzipsdo/sidearc/commit/bb9c46f)
- **休眠文件夹后,固定标签看不出休眠了、也没有动效,正在看的那个没被休眠。** 休眠的固定标签和收藏现在也会变淡;休眠文件夹时正在看的那个也一起休眠,先切回刚才所在的标签页(单个休眠也一样)。 [`6f512bc`](https://github.com/winzipsdo/sidearc/commit/6f512bc)

## 2026-10-25

### 新增

- **在侧边栏关掉当前标签页后,回到刚才所在的标签页。** 比如在 A 里点开了 B,关掉 B 就回到 A,而不是跳到 B 后面的标签页;连着关就沿着足迹往回走。在顶部标签栏里或按 `Ctrl/⌘+W` 关的仍按 Chrome 自己的规则。 [`e2770f0`](https://github.com/winzipsdo/sidearc/commit/e2770f0)

### 变更

- **足迹记最近 10 个,显示几个可以自己选。** 右下角设置里「足迹」那一行是一排竖条,点第几根就显示几个,点最左边的 ⊘ 就不显示;默认 3 个。 [`72f7058`](https://github.com/winzipsdo/sidearc/commit/72f7058)

### 修复

- **书签栏上的同名分组越积越多。** 只有新标签页时不再建分组,打开了真正的网页才建;启动时打开新标签页、临时开空窗口都不会再留下分组。 [`fb27cdb`](https://github.com/winzipsdo/sidearc/commit/fb27cdb)
- **恢复上次的标签页后,顶部出现两个一样的分组。** 同一个空间多出来的分组会并进第一个。 [`fb27cdb`](https://github.com/winzipsdo/sidearc/commit/fb27cdb)

## 2026-10-24

### 新增

- **赞助入口。** 开通了 GitHub Sponsors:仓库页有「Sponsor」按钮,侧边栏右下角设置菜单里有「支持 Sidearc」,README 和主页底部也有链接。 [`749325a`](https://github.com/winzipsdo/sidearc/commit/749325a)
- **恢复上次没回来的标签页。** Chrome 的「启动时」没选「继续浏览上次打开的网页」时,启动后侧边栏顶部会提示「上次有 N 个标签页没有恢复」,点「恢复」就按原来的空间、层级、别名和固定绑定打开回来,先不加载;提示关掉后在「最近关闭」里也能恢复。 [`4141e6f`](https://github.com/winzipsdo/sidearc/commit/4141e6f)
- **右键菜单加了「硬性重新加载」。** 不走缓存、整页重新从服务器取,和 `Ctrl/⌘+Shift+R` 一样;标签页、开着的收藏和固定标签、多选都有。 [`0d3a049`](https://github.com/winzipsdo/sidearc/commit/0d3a049)

### 变更

- **收藏也先回家再关闭。** 收藏点进了别的页面时,鼠标移上去右上角的关闭按钮变成 ↩,先回到收藏的地址,回去之后才是关闭,和固定标签一样。 [`14f368b`](https://github.com/winzipsdo/sidearc/commit/14f368b)
- **删除文件夹时连同里面的固定标签一起删。** 开着的标签页不关,留在下面的列表里;撤销会把文件夹和固定标签放回去,还开着的标签页重新绑上。 [`472f3a1`](https://github.com/winzipsdo/sidearc/commit/472f3a1)
- **文案去掉括号说明。** 编辑框的标签只写「别名」「名称」,说明改成输入框里的灰色提示字(名称的提示字就是网页原标题);休眠提示改成「从 14:03 开始休眠,已经 2 小时 · 点开时重新加载」。 [`472f3a1`](https://github.com/winzipsdo/sidearc/commit/472f3a1)
- **标题末尾的渐隐窄一点,和鼠标移上去出现的按钮也靠近一点。** 渐隐从 22px 缩到 14px,标题和按钮之间从 10px 缩到 6px。 [`e9703a0`](https://github.com/winzipsdo/sidearc/commit/e9703a0)

### 修复

- **只有一个空间的标签页时,顶部标签栏不分组。** 恢复上次的标签页后分组也就一直没有;现在空间的标签页总是放进空间的分组。分组同步连续几次没排好、暂停一会儿后,也会自己再排一次。 [`c3355dc`](https://github.com/winzipsdo/sidearc/commit/c3355dc)
- **键盘上下选择时,列表可以被横向滑动。** 选中框弹出时会短暂超出列表宽度,现在列表只能竖着滚。 [`2f95bb0`](https://github.com/winzipsdo/sidearc/commit/2f95bb0)

## 2026-10-23

### 新增

- **休眠动效。** 点休眠后,整行从当时的样子慢慢淡到休眠的样子,图标缩一下再变淡,旁边飘起一个「z」,不再一闪。 [`08b227a`](https://github.com/winzipsdo/sidearc/commit/08b227a)
- **正在看的标签页也能休眠。** 会先切到它下面最近的、醒着的标签页,和关闭时一样;休眠整个文件夹或空间时仍然跳过它。 [`05394b6`](https://github.com/winzipsdo/sidearc/commit/05394b6)

### 变更

- **搜索框平时收起来。** 鼠标移到顶部时,空间名右边会出现放大镜,点它或按 `/`、`Ctrl/⌘+F` 展开搜索;按 Esc、打开结果或空着点别处时收起。 [`ccd37ad`](https://github.com/winzipsdo/sidearc/commit/ccd37ad)
- **收藏夹和空间名固定在顶部,只有下面的列表滚动。** 参考 Arc;列表滚上去的内容在空间名下面淡淡地消失。 [`d5e48dd`](https://github.com/winzipsdo/sidearc/commit/d5e48dd)

### 修复

- **休眠标签页时整行会闪一下。** 休眠会换编号,侧边栏在重新读取标签页前的几次重画里漏掉了这一行;它的足迹也会重新长一遍。 [`05394b6`](https://github.com/winzipsdo/sidearc/commit/05394b6)

## 2026-10-22

### 修复

- **页面还没加载完就拖进来收藏或固定,名称会一直停在临时标题上(比如「Docs」)。** 现在开着并停在固定的地址上时,名称会跟着网页标题更新;在「编辑」里手动改过名称的不受影响。 [`c3a30f7`](https://github.com/winzipsdo/sidearc/commit/c3a30f7)

## 2026-10-21

### 新增

- **足迹。** 最近离开的 3 个标签页左边有一道主题色竖条(收藏在图标下面),每道各自倒计时 10 分钟,从两头往中间缩短、变淡,最后缩成圆点再消失;出现和消失都有动效。右下角设置里可以关掉,默认打开。 [`7fc500e`](https://github.com/winzipsdo/sidearc/commit/7fc500e) [`d172305`](https://github.com/winzipsdo/sidearc/commit/d172305)

### 变更

- **拖动收藏排序时,落点更清楚。** 两个图标之间出现一根带圆点的竖线,两边的图标让开一点;放到最后时竖线画在最后一个右边。 [`f2b9517`](https://github.com/winzipsdo/sidearc/commit/f2b9517)
- **空间和文件夹菜单里,「休眠」排到「不记录历史」后面。** [`e29c77b`](https://github.com/winzipsdo/sidearc/commit/e29c77b)

### 修复

- **点了一个标签页后马上点另一个,有时没反应。** 切换标签页引起的重画会吞掉紧接着的点击,现在按着鼠标时不重画。 [`7fc500e`](https://github.com/winzipsdo/sidearc/commit/7fc500e)

## 2026-10-20

### 新增

- **键盘操作。** 点一下侧边栏后用方向键从当前页面开始移动选中框,回车打开、Delete 关闭、Shift+F10 打开右键菜单;选中框参考 Switch 的样式和动效。 [`ae0cfd4`](https://github.com/winzipsdo/sidearc/commit/ae0cfd4)
- **Shift+点击连选标签页。** 选中上一次点过的标签页到这一个之间的所有标签页,和顶部标签栏一样;只在下面的标签页列表里生效。 [`1c07ed8`](https://github.com/winzipsdo/sidearc/commit/1c07ed8)

### 变更

- **键盘选中框更稳了。** 回车打开页面或侧边栏失去焦点后,选中框会收起;按住方向键时不再一直抽动,到边上只晃一次。 [`9b1e42e`](https://github.com/winzipsdo/sidearc/commit/9b1e42e)
- **移到别的空间后跟着切过去。** 右键「移到空间」或拖到底部空间圆点上,移完会切到那个空间,并选中刚移过去的标签页。 [`8991d97`](https://github.com/winzipsdo/sidearc/commit/8991d97)

## 2026-10-19

### 新增

- **多选后右键可以一起操作。** 右键选中的任意一个,可以把这一批一起关闭(可撤销)、休眠或移到别的空间。 [`f0a5bc8`](https://github.com/winzipsdo/sidearc/commit/f0a5bc8)
- **多选标签页。** `Ctrl/⌘+点击`选中多个标签页(和顶部标签栏的多选同步),拖动其中一个就一起移动;点空白处或按 Esc 取消。 [`3e548d4`](https://github.com/winzipsdo/sidearc/commit/3e548d4)
- **英文界面。** 默认跟随 Chrome 的界面语言(简体中文显示中文,其他显示英文);鼠标移到底部时右下角会出现设置按钮,可以手动选语言。 [`fd901b4`](https://github.com/winzipsdo/sidearc/commit/fd901b4) [`9e7e0a6`](https://github.com/winzipsdo/sidearc/commit/9e7e0a6)

### 变更

- **右键菜单的文案和 Chrome 自己的标签页菜单对齐。** 「关闭」「复制」「固定」「关闭下方标签页」(英文是 Close、Duplicate、Pin);行上关闭按钮的提示也叫「关闭」。 [`f0a5bc8`](https://github.com/winzipsdo/sidearc/commit/f0a5bc8)

### 修复

- **列表滚到最下面时,最后几行会被底部的提示条挡住。** 现在底部多留了一截空白。 [`7eb3a53`](https://github.com/winzipsdo/sidearc/commit/7eb3a53)
- **书签栏上同名的标签页分组越积越多。** 窗口里只有一个空间的标签页时不再建分组,临时开的窗口关掉后就不会留下分组。 [`7e9ce8f`](https://github.com/winzipsdo/sidearc/commit/7e9ce8f)
- **把标签页拖到地址栏上松手后,那一行一直是半透明的,列表也不再更新。** 现在鼠标回到侧边栏就恢复。 [`8a25235`](https://github.com/winzipsdo/sidearc/commit/8a25235)
- **Sidearc 会拆掉别人建的标签页分组。** 你自己或别的扩展(比如 Claude)建的分组现在原样保留,整组排在空间分组后面。 [`9a2d129`](https://github.com/winzipsdo/sidearc/commit/9a2d129)

### 文档

- **发版自动化。** 改版本号推送后,GitHub 自动跑测试、打包,发布带说明和 zip 的 Release;说明从更新日志里自动挑出。 [`29e711c`](https://github.com/winzipsdo/sidearc/commit/29e711c)
- **打包命令和发版、主页维护说明。** 新增 `npm run pack` 生成上架用的 zip;README 补充了发布新版本和维护 GitHub Pages 主页的步骤。 [`032bda4`](https://github.com/winzipsdo/sidearc/commit/032bda4)

## 2026-10-18

### 新增

- **鼠标移到子标签上,多了一个「移出」按钮。** 点它就变成顶级标签页;行尾按钮顺序是移出、休眠、关闭。 [`2341dd9`](https://github.com/winzipsdo/sidearc/commit/2341dd9)
- **休眠的标签页显示休眠了多久。** [`b7726d8`](https://github.com/winzipsdo/sidearc/commit/b7726d8)
  - 列表里变淡的行尾标着「12 分钟」「2 小时」「3 天」,鼠标停在上面能看到开始休眠的时间;收藏和固定标签不显示。
  - 手动休眠和 Chrome「节省内存」自动回收的都算。时间会跟着标签页一起保存,浏览器重启后也还在;关浏览器前还醒着、重启后没加载的,从上次关浏览器前最后一次使用时算起。
- **鼠标移到开着的收藏上,右上角有一个小关闭按钮。** 只关掉页面,收藏还在。 [`b7726d8`](https://github.com/winzipsdo/sidearc/commit/b7726d8)
- **固定标签可以从右键菜单移到别的空间。** 开着的页面跟着一起过去,可以撤销。 [`b7726d8`](https://github.com/winzipsdo/sidearc/commit/b7726d8)

### 变更

- **从收藏或固定标签里打开的页面,不再做任何标签页的子标签。** [`286fa26`](https://github.com/winzipsdo/sidearc/commit/286fa26)
  - 比如在 B 站的收藏里点开「稍后再看」,它现在是普通的顶级标签页;再从稍后再看打开的视频会挂在它下面。以前稍后再看会被挂到看不见的收藏下面,视频也跟着被挤成了它的同级。
- **右键菜单整理。** [`b7726d8`](https://github.com/winzipsdo/sidearc/commit/b7726d8)
  - 所有「移动」类操作放在同一个分区:移到收藏夹 / 固定标签、移出为顶级标签页、移到空间、新建文件夹并移入(放在最后)。
  - 「休眠」不能用时置灰并说明原因(正在看的、已经在休眠的),不再直接消失。
  - 文案统一:关闭一律叫「关闭标签页」;「固定到当前空间」改叫「固定标签页」;批量休眠改叫「休眠空间内所有标签」「休眠文件夹内所有标签」。
  - 去掉了固定标签菜单里的「移到「某个文件夹」」,改用拖拽放进文件夹。

### 修复

- **在顶部标签栏把子标签拖到最左边时报错,而且它仍挂在原来的父标签下。** [`2275722`](https://github.com/winzipsdo/sidearc/commit/2275722)

## 2026-10-17

### 新增

- **正在播放声音的标签页,喇叭图标会动起来。** [`70b93ce`](https://github.com/winzipsdo/sidearc/commit/70b93ce)
  - 喇叭变成空间的主题色,两道声波一前一后闪动,一眼就能看出是哪个标签页在响。标签页列表、固定标签和收藏都有;静音后停止,系统开了「减少动态效果」时只变色不闪动。
- **鼠标移到标签页上,关闭按钮左边多了一个「休眠」按钮。** [`84dd9bb`](https://github.com/winzipsdo/sidearc/commit/84dd9bb)
  - 月亮图标,点一下让这个标签页休眠,标签还在,点回去会重新加载。开着的固定标签也有;当前标签页和已经休眠的不显示。

### 变更

- **「释放内存」改叫「休眠」,「Keep Alive」改叫「保持唤醒」。** [`84dd9bb`](https://github.com/winzipsdo/sidearc/commit/84dd9bb)
  - 菜单、按钮提示、底部提示都换成了新叫法,文件夹和空间的菜单是「休眠文件夹里的标签页」「休眠这个空间的标签页」。
- **关掉收藏或固定标签时,从它里面打开的页面不再跟着关掉。** [`7e127c2`](https://github.com/winzipsdo/sidearc/commit/7e127c2)
  - 这些页面在列表里本来就单独显示,看不出和收藏、固定标签是一起的;现在它们会留下,变成普通标签页。
  - 不管是在 Chrome 里关,还是点侧边栏的「−」都一样。普通标签页之间的父子关系不变,关父标签仍会连带关闭子标签。

## 2026-10-16

### 新增

- **开了 Keep Alive 的标签页显示一把小锁。** 收藏在图标右下角,固定标签和列表里的标签页在标题右边。 [`fcb9a3d`](https://github.com/winzipsdo/sidearc/commit/fcb9a3d)
- **右键可以「释放内存」和「Keep Alive」。** [`8dff772`](https://github.com/winzipsdo/sidearc/commit/8dff772)
  - 释放内存:让 Chrome 把标签页从内存里卸掉,点回去会重新加载;右键文件夹或空间可以一次释放里面所有后台标签页。
  - Keep Alive:Chrome 的「节省内存」不会回收这个标签页,适合音乐、聊天;浏览器重启后恢复。
- **左下角可以查看最近关闭的标签页。** [`02e26cf`](https://github.com/winzipsdo/sidearc/commit/02e26cf)
  - 列出最近关闭的 10 个,点一下恢复,保留前进后退记录;列表底部可以打开 Chrome 的完整历史记录。
  - 只包括本次启动 Chrome 以来关闭的,不分空间。
- **收藏和固定标签也显示播放状态。** 收藏在图标右上角显示小喇叭,固定标签在行右侧显示喇叭按钮,点了都能静音。 [`fc1c587`](https://github.com/winzipsdo/sidearc/commit/fc1c587)
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

- **标签页右键菜单更精简。** 「静音」只在标签页有声音或已静音时出现;去掉了「重新加载」。 [`2e488ba`](https://github.com/winzipsdo/sidearc/commit/2e488ba)
- **带别名的标签页,标题不再变灰。** 标题深浅只表示开没开:开着的都是正常颜色,没打开的固定标签才变淡。 [`ae886b8`](https://github.com/winzipsdo/sidearc/commit/ae886b8)
- **子标签整行缩进。** 悬停和选中的底色也从缩进处开始,和文件夹里的项一致。 [`91703ac`](https://github.com/winzipsdo/sidearc/commit/91703ac)
- **文件夹里的项整行缩进。** 选中和悬停的底色也从缩进处开始,图标前不再空出一块。 [`cc44681`](https://github.com/winzipsdo/sidearc/commit/cc44681)
- **拖拽的插入线更好认。** 线从要落到的那一级开始画,前面带一个小圆点;拖到列表末尾也显示插入线,不再高亮整块区域。 [`4d2775d`](https://github.com/winzipsdo/sidearc/commit/4d2775d)
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

- **释放内存后,子标签丢了父子关系。** Chrome 释放内存时会给标签页换编号,现在父子关系、空间、别名和固定绑定都会跟过去。 [`af08dd8`](https://github.com/winzipsdo/sidearc/commit/af08dd8)
- **释放内存时列表会跳一下。** 比如释放第一个子标签,第二个会先顶上来再换回去;现在顺序保持不变。 [`142a116`](https://github.com/winzipsdo/sidearc/commit/142a116)
- **浏览器重启后还没加载的标签页没有变淡。** 现在和被回收的标签页一样显示为变淡。 [`8dff772`](https://github.com/winzipsdo/sidearc/commit/8dff772)
- **右键菜单有时超出侧边栏,被裁掉一截。** 侧边栏太矮时菜单改为内部滚动。 [`e4ecb5f`](https://github.com/winzipsdo/sidearc/commit/e4ecb5f)
- **固定标签的文件夹拖不准。** [`4d2775d`](https://github.com/winzipsdo/sidearc/commit/4d2775d)
  - 拖到文件夹最后一项的下半部分,会放进文件夹末尾;以前只能掉到文件夹外面。
  - 文件夹排在最后时,把里面的项拖到下面的分隔线上,就能移到文件夹外面。
  - 拖着某一项在原地松手不会再移动它。
- **扩展错误列表里不再出现「ResizeObserver loop completed with undelivered notifications」。** 收藏夹宽度变化时重排列数会引发这条警告,不影响使用。 [`7b6431d`](https://github.com/winzipsdo/sidearc/commit/7b6431d)

### 文档

- **应用商店截图和小宣传图有了英文版。** 放在 `store/en/`,和中文版一起由 `npm run screenshots` 生成;英文 README 也改用英文截图。 [`de892ce`](https://github.com/winzipsdo/sidearc/commit/de892ce)
- **新增英文版 README,采用 MIT 开源许可证。** [`3e59d3c`](https://github.com/winzipsdo/sidearc/commit/3e59d3c)
- **功能介绍写明和顶部标签栏同步。** README、应用商店说明和第 3 张截图都写上「顶部标签栏的顺序和侧边栏一致」;商店说明也补上了文件夹、少开重复标签页等新功能。 [`9d6eb8a`](https://github.com/winzipsdo/sidearc/commit/9d6eb8a)
- **应用商店截图更新。** 加入固定标签文件夹,收藏夹换成常见网站的图标。 [`39842ac`](https://github.com/winzipsdo/sidearc/commit/39842ac)

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
