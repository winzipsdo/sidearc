# Sidearc features in detail

[简体中文](features.md) | English | [Back to README](../README.en.md)

The full behavior of every feature. Keyboard shortcuts are in the README's [Shortcuts](../README.en.md#shortcuts).

## Tabs

- **Vertical tabs**: click to switch, middle-click or ✕ to close, drag to reorder. Tabs playing sound show a speaker you can click to mute — favorites and pinned tabs too.
- **Multi-select**: `Ctrl/⌘+click` selects several tabs and `Shift+click` a range, shared with the tab strip's selection. Drag any of them to move them all, right-click one to close, sleep or move them to another space together, or press Delete to close them all. Click empty space or press Esc to clear it.
- **Back to the current tab**: when you've scrolled the current tab out of view, a small pill with its icon and an arrow appears on that side of the list (top or bottom); click it to scroll back, centering the tab with a brief glow. It hides as soon as any part of the tab is visible, and doesn't appear while searching.
- **Synced with Chrome's tab strip**: the order of Chrome's native tab strip always matches the sidebar — open favorites on the far left, then one tab group per space; inside each group, pinned tabs first, then the list, with child tabs right after their parent.
  - Drag in the sidebar and the tab strip follows; drag in the tab strip and the sidebar follows.
  - Dragging a tab into another space's group in the tab strip moves it to that space; dragging a child tab away from its parent un-nests it.
- **Split view**: when two tabs are side by side in Chrome's Split View, the sidebar keeps them together on one shaded block, with the one you're viewing as the usual white card. Dragging, moving to another space or nesting under another tab moves both and never breaks the split; dropping a tab between them puts it before the pair. The other half of the split you're viewing doesn't count as a multi-selection. Requires Chrome 140 or later. On Chrome 155 or later you can also split from the sidebar: select two tabs, right-click and choose "Open in split view" (they're moved next to each other first, then shown), or right-click a tab and choose "New split view with current tab" to pair it with the one you're viewing; right-click either half and choose "Reverse views" to flip them, or "Separate views" to split them apart in place. The menu items use the same names as Chrome's own.
- **Child tabs**: links you open from a page are indented under the page they came from.
  - Nest manually by dragging a tab onto another tab; drag it elsewhere, or hover a child tab and click the button left of close, to un-nest; right-click a parent and choose "Move all child tabs out" to un-nest them all at once.
  - Two levels at most; closing a parent closes its children. Tabs opened from a favorite or pinned tab are not nested under anything; pages opened from them nest under them as usual.
  - Links opened from other apps and brand-new tabs are not nested.
- **Aliases**: give a tab or pinned item your own short name, shown before the title and matched by search.
- **No duplicate tabs**: opening an address that is already open in the current space switches to the existing tab instead, and the sidebar scrolls to it and briefly highlights it. Opening the address of a favorite or pinned tab that isn't open yet opens it as that favorite or pinned tab. Tabs you deliberately open in a new tab (`Ctrl/⌘+click`, middle-click) are left alone.
- **Footprints**: the last few tabs you left (3 by default) get a theme-colored bar on the left (a short line under the icon for favorites) that shrinks toward its middle and fades over 10 minutes, so you can find your way back. Choose how many (off, 1, 3, 5 or 10) in Settings at the bottom right.
- **Fallen leaves**: tabs you haven’t visited in a while slowly gather leaves at the end of the row — the first after a day away, then one more every 12 hours, up to 12 — so you can spot what’s safe to close. Sweep the mouse back and forth to clear them (restarting the clock without opening the tab); open the tab and the wind blows them away. You can also right-click a tab and pick "Scatter leaves" to drop 1–6 more at random (still up to 12; more only fall once the schedule catches up with what you scattered). It works on the tab you’re on too: they stay until you leave and come back. With several tabs selected, each gets its own handful. Choose how often (off, 6, 8 or 12 hours) in Settings at the bottom right.
- **Keyboard**: click the sidebar, then use the arrow keys to move a cursor (styled after the Switch) starting from the current page; Enter opens, Delete closes. See [Shortcuts](../README.en.md#shortcuts).
- **Search**: tucked away as a magnifier next to the space name that appears when you hover the top — click it or press `/` or `Ctrl/⌘+F` to open; type to filter; Enter jumps to the first match, or opens the URL / searches with your default engine. Type two or more characters and matching pages from the last 30 days of history show up below (8 at first, with a "Show N more" row to expand up to 50; skipping ones already open) — click to open, or the × to remove it from history.
- **Close in bulk**: "Clear" closes every unpinned tab in the current space except the active one; right-click a tab to close all tabs below it.

## Favorites, pinned tabs and spaces

- **Favorites**: an icon grid at the top, shared by all spaces, that stays put while the list below scrolls (so does the space name). Drag a tab in to add it.
- **Pinned tabs**: one set per space. Closing the tab keeps the pinned item; click it to reopen. Hover to close the tab but keep the pin (−), or to unpin a closed one. Names follow the page title unless you renamed them in Edit. When a favorite's or pinned tab's tab is open in another window, it's marked with a small window-with-arrow icon; clicking it jumps to that window.
  - When an open pinned tab navigates elsewhere, the row shows the current page; ↩ takes it back to the pinned address. Favorites do the same: the tile shows the current page's icon, and its hover close button becomes ↩ until it is back home.
  - **Collapse**: click the space name to fold away its pinned tabs (remembered per space), keeping only the one you're viewing; the number of open ones shows next to the name. Dragging a tab over the space name opens them up so you can drop it in.
  - **Folders**: group pinned tabs into folders; drag items in and out, collapse and expand, rename. Right-click a folder to close (or put to sleep) all its open tabs at once; the pins stay, and closing can be undone.
- **Spaces**: switch with the dots at the bottom. Each space has its own color, pinned tabs and tabs. In Chrome's tab strip each space is a tab group — the current one expanded, the others collapsed; expand one to switch to it. A window holding tabs from only one space is grouped too.
- **No-history spaces and folders**: pages visited from them are removed from browser history right away. This is not incognito mode: cookies, logins and cache are kept.

## Also

- **Undo**: closing tabs, Clear, unpinning and more can be undone from the toast or with `Ctrl/⌘+Z`, step by step. Tabs closed from Chrome's own tab strip can be restored the same way.
- **Back to where you were**: closing the tab you're viewing from the sidebar (its close button, the context menu, or Delete) returns to the tab you were on before it rather than the next one — open B from A, close B, and you're back on A; keep closing to walk further back. Closing from Chrome's tab strip or with `Ctrl/⌘+W` follows Chrome's own rule.
- **Recently closed**: the clock button at the bottom left lists the last 10 closed tabs; click one to restore it (with its back/forward history) into the current space. The bottom of the list opens Chrome's full history. It uses Chrome's own list, so it covers this browser session only and isn't split by space.
- **Sleep**: hover a tab or an open pinned tab and click the moon button left of the close button, or right-click a tab, favorite or pinned tab and choose "Sleep", to unload it from memory (the tab stays; it reloads when you return). Sleeping the tab you're viewing first switches back to the tab you were on before (or the one below it), as closing does. A folder can put all its tabs to sleep at once, including the one you're viewing; a space, all its background tabs. Sleeping tabs (including ones not yet loaded after a restart) appear dimmed, favorites and pinned tabs included; rows in the tab list also show how long they have been asleep (e.g. "2 hr").
- **Keep awake**: right-click and choose "Keep awake" to stop Chrome's Memory Saver from unloading a tab — handy for music or chat. Putting a tab to sleep by hand turns keep awake off. Resets after a browser restart.
- **Context menus** on tabs, favorites, pinned items and space dots.
- **Copy as Markdown**: right-click a space dot (or use the ⋯ menu at the top right) to copy every tab in the space as a "- [title](link)" list, headed by the space name; pinned folders and child tabs are indented, new tab pages are skipped, favorites are left out. Right-click a multi-selection to copy just those tabs. Page titles are used as-is, ready to paste into any AI chat.
- **Light and dark mode**, following the system.
- **English / 中文**: follows Chrome's UI language by default (Simplified Chinese shows Chinese, anything else English); pick one manually from the Settings button at the bottom right (it appears when you hover the bottom bar).
