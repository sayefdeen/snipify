# Snipify

Save, manage, and reuse code snippets — synced to your GitHub Gists.

## Features

- **Save snippets** from any selection: right-click → *Save Snippet*, or use the `+` button in the sidebar
- **Search** snippets by title, language, or tag directly in the sidebar
- **Insert** a snippet at the cursor with a single click — supports VS Code tab stops (`$1`, `${1:placeholder}`)
- **Pin** frequently used snippets to the top of the list
- **Grouped view**: Pinned → Most Used → Recent → All Snippets
- **Usage counter** — insert count shown beside each snippet title; "Most Used" group surfaces your top 5
- **Language icons** for TypeScript, JavaScript, Python, Go, Rust, CSS, and more
- **Copy Gist URL** — share any snippet as a GitHub Gist link in one click
- **Export snippets** to `.code-snippets` (VS Code native) or JSON
- **Import snippets** from `.code-snippets` or a Snipify JSON export
- Synced privately to **GitHub Gists** — accessible from any machine

## Getting Started

1. Open the Snipify panel in the Activity Bar
2. Click **Sign in with GitHub** and authorize the app
3. Select code in the editor, right-click, and choose **Save Snippet**
4. Click any snippet in the sidebar to insert it at the cursor

## Commands

| Command | Description |
|---|---|
| `Snipify: Save Snippet` | Save selected code as a snippet |
| `Snipify: Search Snippets` | Fuzzy-search and insert via quick pick |
| `Snipify: New Snippet` | Open the snippet form without a selection |
| `Snipify: Refresh Snippets` | Reload snippets from GitHub Gists |
| `Snipify: Export Snippets` | Export to `.code-snippets` or JSON |
| `Snipify: Import Snippets` | Import from `.code-snippets` or JSON |
| `Snipify: Login with GitHub` | Authenticate with GitHub |
| `Snipify: Logout` | Sign out |

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+S` / `Cmd+Shift+S` | Search snippets (quick pick) |

All shortcuts are remappable via **File → Preferences → Keyboard Shortcuts** (`Ctrl+K Ctrl+S` / `Cmd+K Cmd+S`).

## Sidebar toolbar

| Button | Action |
|---|---|
| `+` | New snippet |
| `⟳` | Refresh |
| `⋯` | Export / Import |

## Requirements

- A GitHub account
- VS Code 1.85+
