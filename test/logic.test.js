import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addressOf, ANY_SPACE, buildLayout, buildTree, dropBefore, dropInto, favColumns, groupColor, itemsAt, matchesQuery, parseArc, tabSpaces, toUrl } from '../src/logic.js';

test('toUrl:网址补全,其余当作搜索词', () => {
  assert.equal(toUrl('https://a.com/x'), 'https://a.com/x');
  assert.equal(toUrl('chrome://extensions'), 'chrome://extensions');
  assert.equal(toUrl('about:blank'), 'about:blank');
  assert.equal(toUrl('github.com'), 'https://github.com');
  assert.equal(toUrl('localhost:3000/a?b=1'), 'https://localhost:3000/a?b=1');
  assert.equal(toUrl('hello'), null);
  assert.equal(toUrl('hello world.com'), null);
});

test('addressOf:忽略锚点,保留单页应用的路由,非网页返回 null', () => {
  assert.equal(addressOf('https://a.com/x#top'), 'https://a.com/x');
  assert.equal(addressOf('https://a.com/x?q=1'), 'https://a.com/x?q=1');
  assert.equal(addressOf('https://a.com/#/inbox'), 'https://a.com/#/inbox');
  assert.equal(addressOf('https://a.com/#!/inbox'), 'https://a.com/#!/inbox');
  assert.equal(addressOf('chrome://newtab/'), null);
  assert.equal(addressOf(''), null);
});

test('matchesQuery:不分大小写,空搜索词全部匹配', () => {
  assert.equal(matchesQuery('', ['x']), true);
  assert.equal(matchesQuery('  ', []), true);
  assert.equal(matchesQuery('Git', [undefined, 'my github']), true);
  assert.equal(matchesQuery('git', ['docs', null]), false);
});

test('favColumns:按数量均分每一行', () => {
  // 宽 276 时一行最多放 4 个
  assert.equal(favColumns(0, 276), 1);
  assert.equal(favColumns(1, 276), 1);
  assert.equal(favColumns(4, 276), 4);
  assert.equal(favColumns(5, 276), 3); // 3 + 2
  assert.equal(favColumns(8, 276), 4);
  assert.equal(favColumns(9, 276), 3); // 3 + 3 + 3
  assert.equal(favColumns(3, 10), 1); // 窄到放不下一个时也至少一列
});

test('buildTree:子标签跟在父标签后面,最多两级', () => {
  const tabs = [1, 2, 3, 4].map((id) => ({ id }));
  const tree = buildTree(tabs, new Map([[3, 1], [4, 1]]));
  assert.deepEqual(tree.map((x) => [x.tab.id, x.depth]), [[1, 0], [3, 1], [4, 1], [2, 0]]);
});

test('buildTree:父标签不在列表里、指向自己、成环时按顶级显示', () => {
  const ids = (tree) => tree.map((x) => [x.tab.id, x.depth]);
  assert.deepEqual(ids(buildTree([{ id: 1 }], new Map([[1, 99]]))), [[1, 0]]);
  assert.deepEqual(ids(buildTree([{ id: 1 }], new Map([[1, 1]]))), [[1, 0]]);
  // 1 和 2 互为父子:都不是根,靠兜底显示出来,一个也不丢
  const loop = buildTree([{ id: 1 }, { id: 2 }], new Map([[1, 2], [2, 1]]));
  assert.deepEqual(loop.map((x) => x.tab.id).sort(), [1, 2]);
});

const rect = (left, top, width, height) => ({ left, top, width, height, bottom: top + height });

test('dropBefore:列表按上下半区', () => {
  const rows = [rect(0, 0, 100, 30), rect(0, 30, 100, 30)];
  assert.equal(dropBefore(rows, 50, 10, false), 0);
  assert.equal(dropBefore(rows, 50, 20, false), 1);
  assert.equal(dropBefore(rows, 50, 50, false), -1);
});

test('dropBefore:网格按行和左右半区', () => {
  const tiles = [rect(0, 0, 50, 40), rect(60, 0, 50, 40), rect(0, 50, 50, 40)];
  assert.equal(dropBefore(tiles, 10, 20, true), 0);
  assert.equal(dropBefore(tiles, 40, 20, true), 1);
  assert.equal(dropBefore(tiles, 100, 20, true), 2); // 第一行末尾 = 第二行第一个之前
  assert.equal(dropBefore(tiles, 40, 70, true), -1);
});

test('dropInto:只有落在行的中间部分才算嵌套', () => {
  const rows = [rect(0, 0, 100, 100), rect(0, 100, 100, 100)];
  assert.equal(dropInto(rows, 10), -1);
  assert.equal(dropInto(rows, 50), 0);
  assert.equal(dropInto(rows, 95), -1);
  assert.equal(dropInto(rows, 150), 1);
});

const arcFile = (container) => ({ sidebar: { containers: [{ global: {} }, container] } });
const arcTab = (id, url, savedTitle, title) => ({ id, title, data: { tab: { savedURL: url, savedTitle } } });

test('parseArc:收藏夹、固定标签、普通标签页,文件夹展开,改过的名字当别名', () => {
  const arc = parseArc(
    arcFile({
      topAppsContainerIDs: [{ default: true }, 'top'],
      spaces: ['s1', { id: 's1', title: 'Work', containerIDs: ['pinned', 'pin', 'unpinned', 'unpin'] }],
      items: [
        'top', { id: 'top', childrenIds: ['f1'] },
        arcTab('f1', 'https://fav.com', 'Fav'),
        { id: 'pin', childrenIds: ['folder', 'p2'] },
        { id: 'folder', title: 'Folder', childrenIds: ['p1'] },
        arcTab('p1', 'https://p1.com', 'P1', 'My P1'),
        arcTab('p2', 'https://p2.com', ''),
        { id: 'unpin', childrenIds: ['t1', 'empty'] },
        arcTab('t1', 'https://t1.com', 'T1', 'T1'),
        { id: 'empty', data: { tab: {} } },
      ],
    })
  );
  assert.deepEqual(arc.favorites, [{ title: 'Fav', url: 'https://fav.com' }]);
  assert.deepEqual(arc.spaces, [
    {
      name: 'Work',
      pinned: [
        { title: 'P1', url: 'https://p1.com', alias: 'My P1' },
        { title: 'https://p2.com', url: 'https://p2.com' },
      ],
      tabs: [{ title: 'T1', url: 'https://t1.com' }],
    },
  ]);
});

test('parseArc:标记后面的不能用时取内容最多的窗口;不是 Arc 文件则报错', () => {
  const small = { items: [], spaces: [] };
  const big = { items: [arcTab('a', 'https://a.com', 'A')], spaces: [{ id: 's', containerIDs: ['pinned', 'a'] }] };
  const arc = parseArc({ sidebar: { containers: [{ global: {} }, {}, small, big] } });
  assert.deepEqual(arc.spaces, [{ name: 'Arc', pinned: [{ title: 'A', url: 'https://a.com' }], tabs: [] }]);
  assert.throws(() => parseArc({}));
  assert.throws(() => parseArc(null));
});

test('itemsAt:收藏夹加上指定空间的固定项,不看其他空间', () => {
  const state = {
    favorites: [{ id: 'f', url: 'https://x.com/#top' }, { id: 'g', url: 'https://y.com/' }],
    spaces: [
      { id: 'a', pinned: [{ id: 'pa', url: 'https://x.com/' }] },
      { id: 'b', pinned: [{ id: 'pb', url: 'https://x.com/' }] },
    ],
  };
  assert.deepEqual(itemsAt(state, 'https://x.com/', 'b').map((x) => [x.item.id, x.spaceId]), [['f', undefined], ['pb', 'b']]);
  assert.deepEqual(itemsAt(state, 'https://x.com/', 'zz').map((x) => x.item.id), ['f']);
  assert.deepEqual(itemsAt(state, 'https://z.com/', 'a'), []);
  assert.deepEqual(itemsAt(undefined, 'https://x.com/', 'a'), []);
});

test('tabSpaces:绑定到收藏的属于所有空间,绑定到固定项的跟着固定项', () => {
  const state = { favorites: [{ id: 'f' }], spaces: [{ id: 'a', pinned: [{ id: 'p' }] }] };
  const session = { 't:1': 'b', 't:2': 'b', 'b:f': 2, 'b:p': 3, 'b:gone': 4, 'c:1': 9 };
  assert.deepEqual([...tabSpaces(state, session)].sort(), [[1, 'b'], [2, ANY_SPACE], [3, 'a']]);
});

test('groupColor:现有的空间颜色各自对应不同的分组颜色', () => {
  const colors = ['#6b7cff', '#e5687a', '#f0913f', '#d9a927', '#4fae6e', '#3aa7b8', '#a06be0', '#8a8f98'].map(groupColor);
  assert.deepEqual(colors, ['blue', 'red', 'orange', 'yellow', 'green', 'cyan', 'purple', 'grey']);
  assert.equal(groupColor('#f080c0'), 'pink');
  assert.equal(groupColor(undefined), 'grey');
  assert.equal(groupColor('red'), 'grey');
});

test('buildLayout:收藏在最左,然后每个空间先固定标签、再按树形排列', () => {
  const state = {
    activeSpaceId: 'a',
    favorites: [{ id: 'f' }, { id: 'fClosed' }],
    spaces: [
      { id: 'a', pinned: [{ id: 'pa' }] },
      { id: 'b', pinned: [] },
    ],
  };
  // 1 是收藏,2 是 a 的固定标签,3/4/5 在 a(5 是 3 的子标签),6 在 b,7 没有空间,8 的空间已删除
  const session = { 'b:f': 1, 'b:pa': 2, 't:3': 'a', 't:4': 'a', 't:5': 'a', 'c:5': 3, 't:6': 'b', 't:8': 'gone' };
  const tabs = [6, 5, 4, 3, 2, 1, 7, 8].map((id) => ({ id }));
  assert.deepEqual(buildLayout(state, session, tabs), [
    { spaceId: null, ids: [1] },
    { spaceId: 'a', ids: [2, 4, 3, 5, 7, 8] },
    { spaceId: 'b', ids: [6] },
  ]);
});

test('buildLayout:空的空间不出现;没有状态时什么都不排', () => {
  const state = { activeSpaceId: 'a', favorites: [], spaces: [{ id: 'a', pinned: [] }, { id: 'b', pinned: [] }] };
  assert.deepEqual(buildLayout(state, { 't:1': 'a' }, [{ id: 1 }]), [{ spaceId: 'a', ids: [1] }]);
  assert.deepEqual(buildLayout(undefined, {}, [{ id: 1 }]), []);
});
