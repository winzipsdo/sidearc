// 浏览器重启、扩展重新加载后恢复:标签页编号和会话存储都会清空,要靠快照(background.js)把
// 空间、父子关系、别名、固定项绑定、休眠时间、撒的落叶接回到恢复出来的标签页上

import { e2e } from './harness.js';

e2e(async (t) => {
  let p = await t.start();
  const ids = await p.open(['A1', 'A2', 'A3', 'A4', 'A5']);
  const work = await p.addSpace('工作');
  const home = await p.ev(`return (await import('./src/store.js')).state.spaces[0].id`);
  await p.ev(`
    const s = await import('./src/store.js');
    await s.setTabParent(${ids.A2}, ${ids.A1});
    await s.setTabAlias(${ids.A3}, '我的别名');
    await s.setTabScattered(${ids.A1}, 4);
    await (await import('./src/items.js')).addItemFromTab(await chrome.tabs.get(${ids.A4}), 'pin');
    await (await import('./src/tabs.js')).moveTabToSpace(${ids.A5}, ${JSON.stringify(work)});
  `);
  // A3 休眠(会换编号)
  await p.ev(`await chrome.tabs.discard(${ids.A3})`);
  await p.settle();
  await t.sleep(1500);

  // 读出每个标签页现在的样子:{ 标题: { space, parent(父标签的标题), alias, slept, scattered, pin } }
  const look = () =>
    p.ev(`
      const all = await chrome.storage.session.get(null);
      const tabs = (await chrome.tabs.query({})).filter((t) => /^A\\d$/.test(t.title) || /\\/A\\d$/.test(t.url || t.pendingUrl));
      const name = (t) => (/^A\\d$/.test(t.title) ? t.title : (t.url || t.pendingUrl).split('/').pop());
      const byId = new Map(tabs.map((t) => [t.id, name(t)]));
      const { state } = await chrome.storage.local.get('state');
      const pinId = state.spaces[0].pinned[0]?.id;
      return Object.fromEntries(tabs.map((t) => [name(t), {
        space: all['t:' + t.id] ?? null, parent: byId.get(all['c:' + t.id]) ?? null, alias: all['a:' + t.id] ?? null,
        asleep: t.discarded || t.status === 'unloaded', slept: all['z:' + t.id] ?? null, scattered: all['l:' + t.id] ?? null, pin: all['b:' + pinId] === t.id,
      }]));
    `);
  const before = await look();
  console.log('  重启前:', JSON.stringify(before));
  t.check('布置好了', before.A2?.parent === 'A1' && before.A3?.alias === '我的别名' && before.A3?.slept && before.A4?.pin && before.A5?.space === work, before);
  const snap = await p.ev(`return (await chrome.storage.local.get('snapshot')).snapshot?.tabs.length ?? 0`);
  t.check('快照已经存下', snap >= 6, snap);

  const verify = async (label) => {
    const now = await look();
    console.log(`  ${label}:`, JSON.stringify(now));
    t.check(`${label}:五个标签页都在`, ['A1', 'A2', 'A3', 'A4', 'A5'].every((n) => now[n]), Object.keys(now));
    t.check(`${label}:A1–A3 在原来的空间,A5 在「工作」`, ['A1', 'A2', 'A3'].every((n) => now[n]?.space === home) && now.A5?.space === work, now);
    t.check(`${label}:A2 还是 A1 的子标签`, now.A2?.parent === 'A1', now.A2);
    t.check(`${label}:A3 的别名还在`, now.A3?.alias === '我的别名', now.A3);
    // 重启后浏览器会自己加载一部分标签页(收起的分组里的不加载):还没加载的要有休眠时间(侧边栏里变淡、显示休眠了多久),
    // 加载了的没有;关浏览器前就在休眠、重启后还没加载的,接着用原来的时间
    const off = ['A1', 'A2', 'A3', 'A5'].filter((n) => now[n] && now[n].asleep !== (now[n].slept != null));
    t.check(`${label}:还没加载的都有休眠时间,加载了的没有`, off.length === 0, off.map((n) => [n, now[n]]));
    t.check(`${label}:收起的「工作」里的 A5 还没加载、有休眠时间`, now.A5?.asleep && now.A5.slept != null, now.A5);
    if (now.A3?.asleep) t.check(`${label}:A3 的休眠时间接着用原来的`, now.A3.slept === before.A3.slept, [now.A3.slept, before.A3.slept]);
    t.check(`${label}:A1 撒的落叶还在`, now.A1?.scattered === 4, now.A1);
    t.check(`${label}:固定的 A4 还绑着它的标签页`, now.A4?.pin, now.A4);
    const rows = (await p.rows()).map((r) => r.title);
    t.check(`${label}:A4 不在下面的列表里重复出现`, !rows.includes('A4') && rows.includes('A1'), rows);
    await p.settle();
    const groups = await p.ev(`return (await chrome.tabGroups.query({})).map((g) => g.title)`);
    t.check(`${label}:每个空间只有一个分组`, groups.length === new Set(groups).size && groups.length === 2, groups);
    const last = await p.ev(`return (await chrome.storage.local.get('lastSession')).lastSession ?? null`);
    t.check(`${label}:标签页都回来了,不提示恢复上次的标签页`, last === null, last);
  };

  console.log('关掉浏览器,用同一个用户目录重新启动(恢复上次的标签页)');
  await t.quit();
  p = await t.start({ extra: ['--restore-last-session'], wait: 4000 });
  await t.sleep(2500);
  await verify('重启后');

  console.log('重新加载扩展(会话存储同样会清空)');
  await p.b.send('Extensions.loadUnpacked', { path: (await import('./harness.js')).EXT });
  await t.sleep(3000);
  p = await t.openPanel();
  await t.sleep(1000);
  await verify('重新加载后');
  t.check('整个过程没有报错', t.errors.length === 0, t.errors);
});
