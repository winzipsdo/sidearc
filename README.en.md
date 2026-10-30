# Sidearc

[简体中文](README.md) | English | [Website](https://winzipsdo.github.io/sidearc/)

An Arc-style vertical tabs sidebar for Chrome: child tabs, spaces, pinned tabs and favorites, kept in sync with Chrome's own tab strip.

Built on Manifest V3 and `chrome.sidePanel` with plain JS/CSS — no build step, no dependencies, no network requests. All data stays on your machine.

![Vertical tabs, favorites and pinned tabs](store/en/screenshot-1-tabs.jpg)

| Child tabs and aliases | Spaces and dark mode |
| --- | --- |
| ![Child tabs and aliases](store/en/screenshot-2-child-tabs.jpg) | ![Spaces and dark mode](store/en/screenshot-3-spaces-dark.jpg) |

## Features

See [Shortcuts](#shortcuts) for keyboard shortcuts.

### Tabs

- **Vertical tabs**: click to switch, middle-click or ✕ to close, drag to reorder. Tabs playing sound show a speaker you can click to mute — favorites and pinned tabs too.
- **Multi-select**: `Ctrl/⌘+click` selects several tabs and `Shift+click` a range, shared with the tab strip's selection. Drag any of them to move them all, or right-click one to close, sleep or move them to another space together. Click empty space or press Esc to clear it.
- **Synced with Chrome's tab strip**: the order of Chrome's native tab strip always matches the sidebar — open favorites on the far left, then one tab group per space; inside each group, pinned tabs first, then the list, with child tabs right after their parent.
  - Drag in the sidebar and the tab strip follows; drag in the tab strip and the sidebar follows.
  - Dragging a tab into another space's group in the tab strip moves it to that space; dragging a child tab away from its parent un-nests it.
- **Child tabs**: links you open from a page are indented under the page they came from.
  - Nest manually by dragging a tab onto another tab; drag it elsewhere, hover a child tab and click the button left of close, or right-click, to un-nest.
  - Two levels at most; closing a parent closes its children. Tabs opened from a favorite or pinned tab are not nested under anything; pages opened from them nest under them as usual.
  - Links opened from other apps and brand-new tabs are not nested.
- **Aliases**: give a tab or pinned item your own short name, shown before the title and matched by search.
- **No duplicate tabs**: opening an address that is already open in the current space switches to the existing tab instead. Opening the address of a favorite or pinned tab that isn't open yet opens it as that favorite or pinned tab. Tabs you deliberately open in a new tab (`Ctrl/⌘+click`, middle-click) are left alone.
- **Footprints**: the last few tabs you left (3 by default) get a theme-colored bar on the left (a short line under the icon for favorites) that shrinks toward its middle and fades over 10 minutes, so you can find your way back. Choose how many (off, 1, 3, 5 or 10) in Settings at the bottom right.
- **Fallen leaves**: tabs you haven’t visited in a while slowly gather leaves at the end of the row — one every 12 hours since you left, up to 8 — so you can spot what’s safe to close. Sweep the mouse back and forth to clear them (restarting the clock without opening the tab); open the tab and the wind blows them away. Choose how often (off, 6 hours, 12 hours, 1 day, 3 days) in Settings at the bottom right.
- **Keyboard**: click the sidebar, then use the arrow keys to move a cursor (styled after the Switch) starting from the current page; Enter opens, Delete closes. See [Shortcuts](#shortcuts).
- **Search**: tucked away as a magnifier next to the space name that appears when you hover the top — click it or press `/` or `Ctrl/⌘+F` to open; type to filter; Enter jumps to the first match, or opens the URL / searches with your default engine. Type two or more characters and matching pages from the last 30 days of history show up below (up to 8, skipping ones already open) — click to open, or the × to remove it from history.
- **Close in bulk**: "Clear" closes every unpinned tab in the current space except the active one; right-click a tab to close all tabs below it.

### Favorites, pinned tabs and spaces

- **Favorites**: an icon grid at the top, shared by all spaces, that stays put while the list below scrolls (so does the space name). Drag a tab in to add it.
- **Pinned tabs**: one set per space. Closing the tab keeps the pinned item; click it to reopen. Hover to close the tab but keep the pin (−), or to unpin a closed one. Names follow the page title unless you renamed them in Edit. When a favorite's or pinned tab's tab is open in another window, it's marked with a small window-with-arrow icon; clicking it jumps to that window.
  - When an open pinned tab navigates elsewhere, the row shows the current page; ↩ takes it back to the pinned address. Favorites do the same: the tile shows the current page's icon, and its hover close button becomes ↩ until it is back home.
  - **Collapse**: click the space name to fold away its pinned tabs (remembered per space), keeping only the one you're viewing; the number of open ones shows next to the name. Dragging a tab over the space name opens them up so you can drop it in.
  - **Folders**: group pinned tabs into folders; drag items in and out, collapse and expand, rename. Right-click a folder to close (or put to sleep) all its open tabs at once; the pins stay, and closing can be undone.
- **Spaces**: switch with the dots at the bottom. Each space has its own color, pinned tabs and tabs. In Chrome's tab strip each space is a tab group — the current one expanded, the others collapsed; expand one to switch to it. A window holding tabs from only one space is grouped too.
- **No-history spaces and folders**: pages visited from them are removed from browser history right away. This is not incognito mode: cookies, logins and cache are kept.

### Also

- **Undo**: closing tabs, Clear, unpinning and more can be undone from the toast or with `Ctrl/⌘+Z`, step by step. Tabs closed from Chrome's own tab strip can be restored the same way.
- **Back to where you were**: closing the tab you're viewing from the sidebar (its close button, the context menu, or Delete) returns to the tab you were on before it rather than the next one — open B from A, close B, and you're back on A; keep closing to walk further back. Closing from Chrome's tab strip or with `Ctrl/⌘+W` follows Chrome's own rule.
- **Recently closed**: the clock button at the bottom left lists the last 10 closed tabs; click one to restore it (with its back/forward history) into the current space. The bottom of the list opens Chrome's full history. It uses Chrome's own list, so it covers this browser session only and isn't split by space.
- **Sleep**: hover a tab or an open pinned tab and click the moon button left of the close button, or right-click a tab, favorite or pinned tab and choose "Sleep", to unload it from memory (the tab stays; it reloads when you return). Sleeping the tab you're viewing first switches back to the tab you were on before (or the one below it), as closing does. A folder can put all its tabs to sleep at once, including the one you're viewing; a space, all its background tabs. Sleeping tabs (including ones not yet loaded after a restart) appear dimmed, favorites and pinned tabs included; rows in the tab list also show how long they have been asleep (e.g. "2 hr"), with the start time on hover.
- **Keep awake**: right-click and choose "Keep awake" to stop Chrome's Memory Saver from unloading a tab — handy for music or chat. Resets after a browser restart.
- **Context menus** on tabs, favorites, pinned items and space dots.
- **Light and dark mode**, following the system.
- **English / 中文**: follows Chrome's UI language by default (Simplified Chinese shows Chinese, anything else English); pick one manually from the Settings button at the bottom right (it appears when you hover the bottom bar).

## Install

1. Download the latest `sidearc-<version>.zip` from [Releases](https://github.com/winzipsdo/sidearc/releases/latest) and unzip it — or clone this repository to follow the latest code.
2. Open `chrome://extensions`, turn on Developer mode (top right), click "Load unpacked" and choose the unzipped folder (or the repository folder).
3. Click the toolbar icon, or press `Alt+S` (`⌥ Option+S` on Mac), to toggle the sidebar.

Requires Chrome 116 or later.

**Sidebar on the left**: Chrome shows side panels on the right by default. To put it on the left like Arc, open `chrome://settings/appearance` and set the side panel position to left.

## Shortcuts

| Action | Windows / Linux | Mac |
| --- | --- | --- |
| Toggle the sidebar | `Alt+S` | `⌥ Option+S` |
| Undo (sidebar focused) | `Ctrl+Z` | `⌘+Z` |
| Open search | `/` or `Ctrl+F` | `/` or `⌘+F` |
| Search box: skip matches, open the URL or search | `Ctrl+Enter` | `⌘+Enter` |
| Search box: clear and close | `Esc` | `Esc` |
| Keyboard cursor: move (starts from the current page; ↓ in the search box starts from the top) | `↑` `↓` `←` `→` | `↑` `↓` `←` `→` |
| Keyboard cursor: open / close / context menu | `Enter` / `Delete` / `Shift+F10` | `Enter` / `Delete` / `Shift+F10` |
| Keyboard cursor: expand / collapse a folder | `→` / `←` | `→` / `←` |
| Close a tab | Middle-click or ✕ | Middle-click or ✕ |
| Reopen the last closed tab (Chrome's own) | `Ctrl+Shift+T` | `⌘+Shift+T` |

After Enter opens a tab, Chrome moves keyboard focus into that page; press `F6` (maybe a few times) to bring focus back to the sidebar.

The sidebar shortcut can be changed at `chrome://extensions/shortcuts`.

## Permissions and privacy

Sidearc collects and uploads nothing; the code makes no network requests. Spaces, favorites, pinned tabs and aliases are stored locally and removed when you uninstall. See the [privacy policy](PRIVACY.md).

| Permission | Used for |
| --- | --- |
| `sidePanel` | The whole interface lives in the side panel. |
| `tabs` | Listing tabs (title, URL, icon) and switching, moving, closing and opening them. |
| `storage` | Saving spaces, favorites, pinned tabs, aliases and tab state for restoring after a restart. |
| `favicon` | Showing site icons for favorites and pinned tabs. |
| `search` | Searching with your default engine from the search box. |
| `clipboardWrite` | "Copy link address". The clipboard is never read. |
| `sessions` | Restoring closed tabs on undo. |
| `history` | Only for no-history spaces and folders: deleting the pages just visited from them. |
| `webNavigation` | Telling whether a new tab was opened from a link on a page (child tabs) and whether its address is already open (no duplicate tabs). |
| `tabGroups` | Showing each space as a tab group in Chrome's tab strip and collapsing the other spaces. |

## Known limitations

- Sidearc manages the order of its space groups in Chrome's tab strip. Tab groups created by you or by other extensions (such as Claude) are left alone — they're kept intact and placed after the space groups. Chrome's natively pinned tabs stay on the far left. Tab groups support only 9 colors, so each space uses the closest one.
- Spaces, child tabs, aliases and pins are matched back to tabs by URL and position after a restart, which relies on Chrome restoring your previous tabs on startup ("Continue where you left off"). With another startup setting, the sidebar offers to restore last time's tabs at the top (and under Recently closed until the next restart), back in their spaces with child tabs and aliases, unloaded until opened.
- "No duplicate tabs" can only decide once the new tab's address is known, so a duplicate may flash briefly before closing.
- Newer Chrome versions may save tab groups automatically and sync them to your other devices, so space groups can show up there too.
- No-history removes pages by URL: history left by the same URL from other spaces disappears too, while recently closed tabs still list it.

## Development

No build step: the code is plain ES modules — edit, then reload the extension at `chrome://extensions`.

```bash
npm test
```

Tests use Node's built-in test runner (Node 20+), no dependencies. `npm run screenshots` regenerates the store screenshots and promo tiles in Chinese and English (needs Chrome installed).

See [CHANGELOG.md](CHANGELOG.md) for changes.

## Releasing

Releases are automated: when `version` in `manifest.json` changes on `main`, a GitHub Actions workflow runs the tests, builds the zip, tags `v<version>` and publishes a GitHub Release with notes picked from `CHANGELOG.md`. Sidearc isn't on the Chrome Web Store yet while it's still being polished; listing materials are ready in `store/listing.md`. Preview the notes locally with `npm run release-notes`.

## Website

<https://winzipsdo.github.io/sidearc/> is published from the `gh-pages` branch, which also keeps the site and intro-video sources under `source/` (see its `source/README.md`).

## Support

Sidearc is free and open source. If it's useful to you, consider [sponsoring on GitHub](https://github.com/sponsors/winzipsdo) — also reachable from "Support Sidearc" in the sidebar's settings menu.

## License

[MIT](LICENSE)
