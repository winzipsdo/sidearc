import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addressOf, ANY_SPACE, isAway, isFolder, pinnedItems, pinnedLists, privateItemIds, buildLayout, buildTree, dropBefore, dropInto, canDiscard, favColumns, groupColor, isUnloaded, itemsAt, matchesQuery, tabSpaces, toUrl, sleptFor, nextTrail, trailLeft, TRAIL_TTL, leafCount, LEAF_MAX } from '../src/logic.js';

test('isAway:固定地址和当前地址不同才算离开,锚点不算', () => {
  assert.equal(isAway('https://a.com/x', 'https://a.com/x'), false);
  assert.equal(isAway('https://a.com/x', 'https://a.com/x#part'), false);
  assert.equal(isAway('https://a.com/x', 'https://a.com/y'), true);
  assert.equal(isAway('https://a.com/#/home', 'https://a.com/#/settings'), true);
  assert.equal(isAway('https://a.com/x', ''), false);
  assert.equal(isAway('chrome://settings', 'chrome://history'), true);
});

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

test('文件夹:展开后的固定项、放项的数组、不记录历史的项', () => {
  const f1 = { id: 'f1', folder: true, name: 'A', open: true, items: [{ id: 'b', url: 'https://b.com/' }, { id: 'c', url: 'https://c.com/' }] };
  const f2 = { id: 'f2', folder: true, name: 'B', open: false, noHistory: true, items: [{ id: 'd', url: 'https://d.com/' }] };
  const space = { id: 's', pinned: [{ id: 'a', url: 'https://a.com/' }, f1, { id: 'e', url: 'https://e.com/' }, f2] };
  assert.equal(isFolder(f1), true);
  assert.equal(isFolder(space.pinned[0]), false);
  assert.deepEqual(pinnedItems(space).map((i) => i.id), ['a', 'b', 'c', 'e', 'd']);
  assert.deepEqual(pinnedLists(space), [space.pinned, f1.items, f2.items]);
  assert.deepEqual([...privateItemIds({ spaces: [space] })], ['d']);
  assert.deepEqual(pinnedItems(undefined), []);
});

test('文件夹里的固定项照样参与查重和空间归属', () => {
  const space = { id: 's', pinned: [{ id: 'f', folder: true, name: 'A', items: [{ id: 'x', url: 'https://x.com/' }] }] };
  const state = { favorites: [], spaces: [space] };
  assert.deepEqual(itemsAt(state, 'https://x.com/', 's').map(({ item }) => item.id), ['x']);
  assert.equal(tabSpaces(state, { 'b:x': 7 }).get(7), 's');
});

test('isUnloaded:被回收的,和重启后还没加载的,都算不在内存里', () => {
  assert.equal(isUnloaded({ discarded: true, status: 'unloaded' }), true);
  assert.equal(isUnloaded({ discarded: false, status: 'unloaded' }), true);
  assert.equal(isUnloaded({ discarded: false, status: 'complete' }), false);
  assert.equal(isUnloaded(undefined), false);
});

test('canDiscard:当前标签页和已经不在内存里的不能休眠', () => {
  assert.equal(canDiscard({ active: false, status: 'complete' }), true);
  assert.equal(canDiscard({ active: true, status: 'complete' }), false);
  assert.equal(canDiscard({ active: false, discarded: true }), false);
  assert.equal(canDiscard({ active: false, status: 'unloaded' }), false);
  assert.equal(canDiscard(null), false);
});

test('sleptFor:休眠了多久,取最大的单位', () => {
  const now = 1_000_000_000_000;
  assert.deepEqual(sleptFor(now - 20_000, now), { unit: 'now', n: 0 });
  assert.deepEqual(sleptFor(now - 60_000, now), { unit: 'minutes', n: 1 });
  assert.deepEqual(sleptFor(now - 59 * 60_000, now), { unit: 'minutes', n: 59 });
  assert.deepEqual(sleptFor(now - 60 * 60_000, now), { unit: 'hours', n: 1 });
  assert.deepEqual(sleptFor(now - 23 * 3600_000 - 59 * 60_000, now), { unit: 'hours', n: 23 });
  assert.deepEqual(sleptFor(now - 24 * 3600_000, now), { unit: 'days', n: 1 });
  assert.deepEqual(sleptFor(now - 10 * 86400_000, now), { unit: 'days', n: 10 });
});

test('nextTrail:离开的标签页记在最前,最多 10 个,回到的标签页不再算足迹', () => {
  let rec = nextTrail(undefined, 1, 0);
  assert.deepEqual(rec, { active: 1, trail: [] });
  rec = nextTrail(rec, 2, 1000);
  assert.deepEqual(rec.trail, [{ id: 1, at: 1000 }]);
  for (let id = 3; id <= 13; id++) rec = nextTrail(rec, id, id * 1000);
  assert.deepEqual(rec.trail.map((x) => x.id), [12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
  rec = nextTrail(rec, 5, 20000);
  assert.deepEqual(rec.trail.map((x) => x.id), [13, 12, 11, 10, 9, 8, 7, 6, 4, 3]);
  // 原来的当前标签页已经关掉:不留足迹
  assert.deepEqual(nextTrail({ active: 9, trail: [] }, 1, 0, false).trail, []);
  // 切回同一个标签页(比如重复的 onActivated):不变
  assert.deepEqual(nextTrail({ active: 1, trail: [{ id: 2, at: 0 }] }, 1, 10).trail, [{ id: 2, at: 0 }]);
});

test('nextTrail:超过 10 分钟的也照样记着(只是不再显示),关掉当前标签页时还能往回走', () => {
  const rec = nextTrail({ active: 2, trail: [{ id: 1, at: 0 }] }, 3, TRAIL_TTL + 1);
  assert.deepEqual(rec.trail, [{ id: 2, at: TRAIL_TTL + 1 }, { id: 1, at: 0 }]);
});

test('trailLeft:随离开的时间从 1 线性降到 0,10 分钟后为 0', () => {
  assert.equal(trailLeft(0, 0), 1);
  assert.equal(trailLeft(0, TRAIL_TTL / 2), 0.5);
  assert.equal(trailLeft(0, TRAIL_TTL), 0);
  assert.equal(trailLeft(0, TRAIL_TTL * 2), 0);
  assert.equal(TRAIL_TTL, 10 * 60000);
});

test('leafCount:离开后先空 24 小时,之后每满 N 小时一片,最多 LEAF_MAX 片;不落或没有时间就没有', () => {
  const H = 3600000;
  assert.equal(leafCount(0, 100 * H, 12), 0);
  assert.equal(leafCount(1000, 1000 + 35.9 * H, 12), 0);
  assert.equal(leafCount(1000, 1000 + 36 * H, 12), 1);
  assert.equal(leafCount(1000, 1000 + 61 * H, 12), 3);
  assert.equal(leafCount(1000, 1000 + 61 * H, 6), 6);
  assert.equal(leafCount(1000, 1000 + 32 * H, 8), 1);
  assert.equal(leafCount(1000, 1000 + 1000 * H, 12), LEAF_MAX);
  assert.equal(leafCount(1000, 1000 + 1000 * H, 0), 0);
  assert.equal(leafCount(5000, 1000, 12), 0);
});
