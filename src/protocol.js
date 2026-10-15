// 侧边栏和后台(background.js)之间的约定。两边都从这里取,不要各写各的字符串。

// 会话存储(chrome.storage.session)里的键,格式是 <前缀>:<id>
export const PREFIX = {
  space: 't', // t:<tabId> -> 所属空间的 id
  alias: 'a', // a:<tabId> -> 别名
  parent: 'c', // c:<tabId> -> 父标签页的 tabId
  bind: 'b', // b:<itemId> -> 收藏/固定项绑定的 tabId
  fresh: 'n', // n:<tabId> -> 新开的标签页还在查重:1 = 还没载入过网页,其他 = 第一次载入网页的时间
  group: 'g', // g:<groupId> -> 这个标签页分组对应的空间 id
};
export const KEY = Object.fromEntries(Object.entries(PREFIX).map(([name, prefix]) => [name, (id) => `${prefix}:${id}`]));
export const hasPrefix = (key, prefix) => key.startsWith(prefix + ':');

// runtime 消息。每条消息是只有一个字段的对象,字段名如下,值见注释
export const MSG = {
  keepTab: 'keepTab', // 侧边栏 → 后台:tabId。这个标签页是扩展自己开的(固定项、撤销、导入),不查重
  openDup: 'openDup', // 侧边栏 → 后台:{ url, windowId, active }。用户撤销了查重,照原样再开一份
  deduped: 'deduped', // 后台 → 侧边栏:{ url, windowId, active }。刚关掉了一个地址重复的新标签页
  adopted: 'adopted', // 后台 → 侧边栏:{ windowId, tabId, itemId }。新标签页的地址和某个收藏/固定项相同,已绑定到它
};
