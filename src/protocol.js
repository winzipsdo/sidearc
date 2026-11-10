// 侧边栏和后台(background.js)之间的约定。两边都从这里取,不要各写各的字符串。

// 会话存储(chrome.storage.session)里的键,格式是 <前缀>:<id>
export const PREFIX = {
  space: 't', // t:<tabId> -> 所属空间的 id
  alias: 'a', // a:<tabId> -> 别名
  parent: 'c', // c:<tabId> -> 父标签页的 tabId
  bind: 'b', // b:<itemId> -> 收藏/固定项绑定的 tabId
  fresh: 'n', // n:<tabId> -> 新开的标签页还在查重:1 = 还没载入过网页,其他 = 第一次载入网页的时间
  group: 'g', // g:<groupId> -> 这个标签页分组对应的空间 id
  slept: 'z', // z:<tabId> -> 这个标签页开始休眠的时间(毫秒);醒来后删掉
  seen: 'v', // v:<tabId> -> 上次离开这个标签页(或在侧边栏里把它的落叶扫干净)的时间(毫秒),落叶从这时算起
  scattered: 'l', // l:<tabId> -> 右键「撒落叶」撒到了几片;显示时和按时间该落的片数取多的那个;点进这个标签页(当前标签页上撒的,是离开后再点回来)或扫干净时删掉
  trail: 'f', // f:<windowId> -> 足迹:{ active: 当前标签页, trail: [{ id, at }] 最近离开的几个,新的在前,at 是离开的时间(毫秒) }
};
export const KEY = Object.fromEntries(Object.entries(PREFIX).map(([name, prefix]) => [name, (id) => `${prefix}:${id}`]));
export const hasPrefix = (key, prefix) => key.startsWith(prefix + ':');
// 按 tabId 存、只属于这个标签页自己的键:标签页换了编号(比如休眠后)要挪到新编号上,关掉时要删掉。
// 新加这类键只往这里加,后台的 onReplaced、onRemoved 都从这里取。bind、group、trail 的 id 不是 tabId,不在这里
export const TAB_KEYS = [KEY.space, KEY.alias, KEY.parent, KEY.fresh, KEY.slept, KEY.seen, KEY.scattered];

// 会话存储:侧边栏已经在恢复上次没回来的标签页了,后台别再提示(见 background.js 的 keepLastSession)
export const LAST_TAKEN = '_lastTaken';

// runtime 消息。每条消息是只有一个字段的对象,字段名如下,值见注释
export const MSG = {
  keepTab: 'keepTab', // 侧边栏 → 后台:tabId。这个标签页是扩展自己开的(固定项、撤销、导入),不查重
  openDup: 'openDup', // 侧边栏 → 后台:{ url, windowId, active }。用户撤销了查重,照原样再开一份
  deduped: 'deduped', // 后台 → 侧边栏:{ url, windowId, active }。刚关掉了一个地址重复的新标签页
  adopted: 'adopted', // 后台 → 侧边栏:{ windowId, tabId, itemId }。新标签页的地址和某个收藏/固定项相同,已绑定到它
};
