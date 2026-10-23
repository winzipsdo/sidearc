// 界面语言:简体中文和英文。默认跟随 Chrome 的界面语言(简体中文显示中文,其他语言显示英文,和 _locales/ 一致),
// 也可以在空间菜单里手动选,选择记在 chrome.storage.local 的 lang 里('auto' | 'zh' | 'en')。
// 扩展的名字、简介、快捷键说明由 Chrome 显示,只能跟随浏览器语言,见 _locales/。
//
// 用法:t('key') 或 t('key', { name: '…', n: 3 });文案里的 {name} 会被替换。
// 值也可以是函数(需要按数量变化的英文),参数同上。

const MESSAGES = {
  zh: {
    // 常驻界面
    searchPlaceholder: '搜索标签页或输入网址',
    searchTip: '搜索(/)',
    noHistoryBadge: '不记录历史',
    noHistoryBadgeTip: '此空间不记录浏览历史',
    spaceSettings: '空间设置',
    clear: '清理',
    clearTip: '关闭此空间中除当前标签页外的所有未固定标签页',
    newTab: '新标签页',
    favsHint: '把标签页拖到这里加入收藏夹',
    pinsHint: '把标签页拖到这里固定到此空间',
    folderEmpty: '空文件夹,把固定标签拖进来',
    newSpace: '新建空间',
    recentlyClosed: '最近关闭',
    defaultSpace: '个人',

    // 行上的按钮和提示
    // 和 Chrome 自己的标签页菜单一致;右键菜单和行上按钮的鼠标提示都用它
    close: '关闭',
    unpin: '取消固定',
    mute: '静音',
    unmute: '取消静音',
    sleep: '休眠',
    unnest: '移出为顶级标签页',
    backToPinned: '回到固定地址',
    awayTip: '当前:{current}\n固定地址:{pinned}',
    keepAwakeTip: '保持唤醒:不会被自动休眠',
    notLoadedTip: '还没加载,点开时加载',
    sleptTip: '休眠了 {duration}({at} 开始),点开时重新加载',
    folderNoHistoryTip: '此文件夹里的页面不记录浏览历史',
    noHistoryIconTip: '不记录浏览历史',

    // 时间
    justNow: '刚刚',
    minutes: '{n} 分钟',
    hours: '{n} 小时',
    days: '{n} 天',
    ago: '{duration}前',

    // 右键菜单:标签页
    setAlias: '设置别名…',
    editAlias: '修改别名…',
    pinTab: '固定',
    pinTabTip: '固定到当前空间,只在这个空间里显示',
    addToFavs: '添加到收藏夹',
    copyLink: '复制链接地址',
    duplicateTab: '复制',
    alreadyAsleepTip: '已经在休眠了',
    keepAwake: '保持唤醒',
    stopKeepAwake: '取消保持唤醒',
    releaseChildren: '解除所有子标签',
    moveToSpace: '移到空间「{name}」',
    closeBelow: '关闭下方标签页',

    // 右键菜单:收藏 / 固定标签
    editItemAlias: '编辑别名…',
    backToFav: '回到收藏地址',
    backToPin: '回到固定地址',
    currentPage: '当前页面',
    saveToFavs: '加入收藏夹',
    replaceFavUrl: '替换原来的收藏地址',
    replacePinUrl: '替换原来的固定地址',
    moveToPins: '移到固定标签',
    moveToPinsTip: '移到当前空间的固定标签',
    moveToFavs: '移到收藏夹',
    moveOutOfFolder: '移出文件夹',
    newFolderWithItem: '新建文件夹并移入…',
    removeFromFavs: '从收藏夹移除',

    // 右键菜单:文件夹、空间、最近关闭
    rename: '重命名…',
    sleepFolder: '休眠文件夹内所有标签',
    sleepSpace: '休眠空间内所有标签',
    nothingToSleep: '没有可以休眠的标签页',
    turnOnNoHistory: '开启「不记录历史」',
    turnOffNoHistory: '关闭「不记录历史」',
    deleteFolder: '删除文件夹(保留里面的固定标签)',
    editSpace: '编辑空间…',
    newSpaceMenu: '新建空间…',
    newFolderMenu: '新建文件夹…',
    deleteSpace: '删除空间',
    noRecentlyClosed: '没有最近关闭的标签页',
    openHistory: '打开完整历史记录',
    settings: '设置',
    language: '语言 / Language',
    langAuto: '跟随浏览器',
    footprints: '足迹',
    footprintsTip: '最近离开的 3 个标签页旁边显示一道竖条,10 分钟内慢慢缩短、变淡直到消失',

    // 对话框
    save: '保存',
    cancel: '取消',
    delete: '删除',
    name: '名称',
    url: '网址',
    editItemTitle: '编辑',
    aliasOptional: '别名(可留空)',
    titleOptional: '名称(留空则还原为网页标题)',
    setAliasTitle: '设置别名',
    aliasClear: '别名(留空则清除)',
    newSpaceTitle: '新建空间',
    editSpaceTitle: '编辑空间',
    newFolderTitle: '新建文件夹',
    renameFolderTitle: '重命名文件夹',
    deleteSpaceConfirm: '删除空间「{name}」?其中的固定标签也会被移除,已打开的标签页会并入当前空间。',

    // 提示条
    undo: '撤销',
    undone: '已撤销',
    nothingToUndo: '没有可撤销的操作',
    restored: '已恢复「{title}」',
    copied: '已复制链接地址',
    closedTab: '已关闭「{title}」',
    closedTabWithKids: '已关闭「{title}」及 {n} 个子标签',
    closedTabs: '已关闭 {n} 个标签页',
    nTabs: '{n} 个标签页',
    cleared: '已清理 {n} 个标签页',
    slept: '已让 {n} 个标签页休眠',
    keepAwakeOn: '已开启保持唤醒,这个标签页不会被自动休眠',
    keepAwakeOff: '已取消保持唤醒,这个标签页恢复自动休眠',
    switchedToExisting: '已切到现有标签页',
    alreadyOpen: '标签页已存在',
    unpinned: '已取消固定「{title}」',
    removedFromFavs: '已从收藏夹移除「{title}」',
    whereFavs: '收藏夹',
    wherePins: '当前空间的固定标签',
    alreadySaved: '这个页面已经在{where}里了',
    saved: '已把「{title}」加入{where}',
    movedToSpace: '已把「{title}」移到空间「{name}」',
    folderDeleted: '已删除文件夹「{name}」,里面的固定标签已移出',
    spaceNoHistoryOn: '「{name}」不再记录浏览历史',
    spaceNoHistoryOff: '「{name}」恢复记录浏览历史',
    folderNoHistoryOn: '「{name}」里的页面不再记录浏览历史',
    folderNoHistoryOff: '「{name}」恢复记录浏览历史',
  },

  en: {
    searchPlaceholder: 'Search tabs or enter a URL',
    searchTip: 'Search (/)',
    noHistoryBadge: 'No history',
    noHistoryBadgeTip: "This space doesn't keep browsing history",
    spaceSettings: 'Space settings',
    clear: 'Clear',
    clearTip: 'Close all unpinned tabs in this space except the current one',
    newTab: 'New tab',
    favsHint: 'Drag tabs here to add favorites',
    pinsHint: 'Drag tabs here to pin them to this space',
    folderEmpty: 'Empty folder — drag pinned tabs here',
    newSpace: 'New space',
    recentlyClosed: 'Recently closed',
    defaultSpace: 'Personal',

    close: 'Close',
    unpin: 'Unpin',
    mute: 'Mute',
    unmute: 'Unmute',
    sleep: 'Sleep',
    unnest: 'Move out to top level',
    backToPinned: 'Back to pinned page',
    awayTip: 'Now: {current}\nPinned: {pinned}',
    keepAwakeTip: "Keep awake: won't be put to sleep automatically",
    notLoadedTip: 'Not loaded yet — loads when opened',
    sleptTip: 'Asleep for {duration} (since {at}) — reloads when opened',
    folderNoHistoryTip: "Pages in this folder don't keep browsing history",
    noHistoryIconTip: "Doesn't keep browsing history",

    justNow: 'just now',
    minutes: ({ n }) => `${n} min`,
    hours: ({ n }) => `${n} hr`,
    days: ({ n }) => (n === 1 ? '1 day' : `${n} days`),
    ago: ({ duration }) => (duration === 'just now' ? duration : `${duration} ago`),

    setAlias: 'Set alias…',
    editAlias: 'Edit alias…',
    pinTab: 'Pin',
    pinTabTip: 'Pin to the current space; shown only in this space',
    addToFavs: 'Add to favorites',
    copyLink: 'Copy link address',
    duplicateTab: 'Duplicate',
    alreadyAsleepTip: 'Already asleep',
    keepAwake: 'Keep awake',
    stopKeepAwake: 'Stop keeping awake',
    releaseChildren: 'Move all child tabs out',
    moveToSpace: 'Move to “{name}”',
    closeBelow: 'Close tabs below',

    editItemAlias: 'Edit alias…',
    backToFav: 'Back to favorite page',
    backToPin: 'Back to pinned page',
    currentPage: 'Current page',
    saveToFavs: 'Add to favorites',
    replaceFavUrl: 'Replace the favorite page',
    replacePinUrl: 'Replace the pinned page',
    moveToPins: 'Move to pinned tabs',
    moveToPinsTip: "Move to the current space's pinned tabs",
    moveToFavs: 'Move to favorites',
    moveOutOfFolder: 'Move out of folder',
    newFolderWithItem: 'New folder with this tab…',
    removeFromFavs: 'Remove from favorites',

    rename: 'Rename…',
    sleepFolder: 'Put all tabs in folder to sleep',
    sleepSpace: 'Put all tabs in space to sleep',
    nothingToSleep: 'No tabs can be put to sleep',
    turnOnNoHistory: "Don't keep history",
    turnOffNoHistory: 'Keep history again',
    deleteFolder: 'Delete folder (keep its pinned tabs)',
    editSpace: 'Edit space…',
    newSpaceMenu: 'New space…',
    newFolderMenu: 'New folder…',
    deleteSpace: 'Delete space',
    noRecentlyClosed: 'No recently closed tabs',
    openHistory: 'Open full history',
    settings: 'Settings',
    language: '语言 / Language',
    langAuto: 'Same as browser',
    footprints: 'Footprints',
    footprintsTip: 'Mark the last 3 tabs you left with a bar that shrinks and fades away over 10 minutes',

    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    name: 'Name',
    url: 'URL',
    editItemTitle: 'Edit',
    aliasOptional: 'Alias (optional)',
    titleOptional: 'Name (leave empty to use the page title)',
    setAliasTitle: 'Set alias',
    aliasClear: 'Alias (leave empty to remove)',
    newSpaceTitle: 'New space',
    editSpaceTitle: 'Edit space',
    newFolderTitle: 'New folder',
    renameFolderTitle: 'Rename folder',
    deleteSpaceConfirm: 'Delete space “{name}”? Its pinned tabs will be removed; its open tabs will move to the current space.',

    undo: 'Undo',
    undone: 'Undone',
    nothingToUndo: 'Nothing to undo',
    restored: 'Restored “{title}”',
    copied: 'Link address copied',
    closedTab: 'Closed “{title}”',
    closedTabWithKids: ({ title, n }) => `Closed “${title}” and ${n} child ${n === 1 ? 'tab' : 'tabs'}`,
    closedTabs: ({ n }) => `Closed ${n} ${n === 1 ? 'tab' : 'tabs'}`,
    nTabs: ({ n }) => `${n} ${n === 1 ? 'tab' : 'tabs'}`,
    cleared: ({ n }) => `Cleared ${n} ${n === 1 ? 'tab' : 'tabs'}`,
    slept: ({ n }) => `Put ${n} ${n === 1 ? 'tab' : 'tabs'} to sleep`,
    keepAwakeOn: "Keep awake on — this tab won't be put to sleep automatically",
    keepAwakeOff: 'Keep awake off — this tab can be put to sleep automatically again',
    switchedToExisting: 'Switched to the tab that was already open',
    alreadyOpen: 'That page is already open',
    unpinned: 'Unpinned “{title}”',
    removedFromFavs: 'Removed “{title}” from favorites',
    whereFavs: 'favorites',
    wherePins: "this space's pinned tabs",
    alreadySaved: 'This page is already in {where}',
    saved: 'Added “{title}” to {where}',
    movedToSpace: 'Moved “{title}” to “{name}”',
    folderDeleted: 'Deleted folder “{name}”; its pinned tabs were moved out',
    spaceNoHistoryOn: '“{name}” no longer keeps browsing history',
    spaceNoHistoryOff: '“{name}” keeps browsing history again',
    folderNoHistoryOn: "Pages in “{name}” no longer keep browsing history",
    folderNoHistoryOff: 'Pages in “{name}” keep browsing history again',
  },
};

export const LANGS = { zh: '中文', en: 'English' };

// 'auto' 时按 Chrome 的界面语言判断
export function resolveLang(pref) {
  if (pref === 'zh' || pref === 'en') return pref;
  const ui = (globalThis.chrome?.i18n?.getUILanguage?.() || globalThis.navigator?.language || 'en').toLowerCase();
  // 繁体(zh-TW、zh-HK)没有单独的翻译,和 manifest 一样用英文
  return ui === 'zh' || /^zh-(cn|sg|hans)/.test(ui) ? 'zh' : 'en';
}

let pref = 'auto';
let lang = resolveLang(pref);
export const langPref = () => pref;
export const currentLang = () => lang;
export function setLangPref(next) {
  pref = next === 'zh' || next === 'en' ? next : 'auto';
  lang = resolveLang(pref);
  if (globalThis.document) document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
}

export function t(key, vars = {}) {
  const msg = MESSAGES[lang][key] ?? MESSAGES.zh[key] ?? key;
  if (typeof msg === 'function') return msg(vars);
  return msg.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
}

// 时长:logic.js 的 durationParts 算出 { unit, n },这里按语言写成文字
export const formatDuration = ({ unit, n }) => (unit === 'now' ? t('justNow') : t(unit, { n }));

// 页面里写死的文字:带 data-i18n(文字)、data-i18n-title(悬停提示)、data-i18n-placeholder(输入框提示)的元素
export function applyStaticText(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  for (const el of root.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
}

// 测试用:两种语言的键必须一致
export const MESSAGE_KEYS = { zh: Object.keys(MESSAGES.zh), en: Object.keys(MESSAGES.en) };
