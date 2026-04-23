# Snipify — VS Code Extension

## Project Overview

**Snipify** is a VS Code extension that allows developers to save, manage, and reuse code snippets directly inside their IDE. Snippets are stored in the cloud using the user's own GitHub account (GitHub Gists in V1), so they are always synced and never lost.

The core user flow is:
1. User installs Snipify and logs in with GitHub
2. User selects a code snippet in the editor
3. User saves it with a title and optional tags via a command or right-click menu
4. User browses their saved snippets in the Snipify sidebar
5. User clicks a snippet → it is inserted at the current cursor position in the editor

---

## Tech Stack

- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js (VS Code Extension Host)
- **Framework**: VS Code Extension API (`vscode` package)
- **Auth**: VS Code built-in GitHub OAuth (`vscode.authentication`)
- **Storage V1**: GitHub Gists API (REST)
- **Package Manager**: npm
- **Bundler**: esbuild

---

## Architecture

Everything platform-specific (auth and storage) sits behind an **interface**. Commands and UI never call GitHub/GitLab/Bitbucket APIs directly — only through the interface. This makes adding new providers require zero changes to existing code.

### Dependency flow

```
extension.ts
  └── AuthProviderFactory  →  IAuthProvider  ←  GitHubAuthProvider
  └── StorageFactory       →  ISnippetStorage ←  GitHubGistStorage
  └── SidebarViewProvider  (WebView sidebar — search + grouped snippet list)
  └── SnippetForm          (WebView panel — save/new snippet form)
  └── SnippetQuickPick     (command palette fuzzy search)
```

---

## Project Structure

```
snipify/
├── package.json
├── tsconfig.json
├── esbuild.js
├── README.md
├── PLAN.md
├── assets/
│   ├── icon.svg                        # Activity bar icon (monochrome)
│   └── icons/                          # Language icons (SVG, path-based)
│       ├── typescript.svg
│       ├── javascript.svg
│       ├── typescriptreact.svg
│       ├── javascriptreact.svg
│       ├── python.svg, go.svg, rust.svg
│       ├── html.svg, css.svg, scss.svg
│       ├── json.svg, yaml.svg, sql.svg
│       ├── markdown.svg, shellscript.svg
│       └── plaintext.svg
│
└── src/
    ├── extension.ts                    # Entry point — wires everything together
    ├── models/
    │   ├── Snippet.ts
    │   └── User.ts
    ├── auth/
    │   ├── IAuthProvider.ts
    │   ├── GitHubAuthProvider.ts
    │   ├── GitLabAuthProvider.ts       # Stub
    │   ├── BitbucketAuthProvider.ts    # Stub
    │   └── AuthProviderFactory.ts
    ├── storage/
    │   ├── ISnippetStorage.ts
    │   ├── GitHubGistStorage.ts
    │   ├── GitLabSnippetStorage.ts     # Stub
    │   ├── BitbucketStorage.ts         # Stub
    │   └── StorageFactory.ts
    ├── ui/
    │   ├── SidebarViewProvider.ts      # Full WebView sidebar (search + list)
    │   ├── SnippetForm.ts              # WebView panel (save / new snippet)
    │   ├── SnippetQuickPick.ts         # Command palette search
    │   ├── SnippetTreeProvider.ts      # Legacy tree provider (kept, unused)
    │   └── SearchViewProvider.ts       # Legacy search provider (kept, unused)
    ├── commands/
    │   ├── saveSnippet.ts
    │   ├── insertSnippet.ts
    │   ├── deleteSnippet.ts
    │   ├── editSnippet.ts
    │   └── login.ts
    └── utils/
        ├── languageDetector.ts
        └── tokenStorage.ts
```

---

## Key Rules

- Commands must stay thin — no GitHub API calls, no token handling in `src/commands/`
- Always use `AuthProviderFactory` / `StorageFactory` to obtain providers
- Auth tokens only via `SecretStorage` (never `globalState` or workspace config)
- TypeScript strict mode — no `any`, no implicit returns
- Stub providers (GitLab, Bitbucket) must remain — factories reference them

---

## Development Phases

### Phase 1 — Foundation ✅
- [x] Initialize extension manually
- [x] Set up TypeScript, ESLint, esbuild
- [x] Create all interface files (`IAuthProvider`, `ISnippetStorage`)
- [x] Create model files (`Snippet`, `User`)
- [x] Create all stub provider files
- [x] Register extension entry point in `extension.ts`

### Phase 2 — GitHub Auth ✅
- [x] Implement `GitHubAuthProvider` using `vscode.authentication`
- [x] Implement `tokenStorage.ts` using VS Code `SecretStorage`
- [x] Implement `login` and `logout` commands
- [x] Show logged-in username in the status bar
- [x] Status bar click opens the sidebar after login

### Phase 3 — GitHub Gists Storage ✅
- [x] Implement `GitHubGistStorage` with all `ISnippetStorage` methods
- [x] Implement `mapGistToSnippet()` — readable description format (`Language: x, Tags: y`)
- [x] Support reading foreign (pre-existing) Gists with `inferLanguage()` fallback
- [x] Removed `createdAt` from Gist metadata to keep descriptions clean

### Phase 4 — Save Snippet Command ✅
- [x] Implement `SnippetForm` WebView panel (title, tags, language, code preview)
- [x] Implement `saveSnippet` command end to end
- [x] Wire up right-click context menu ("Save as Snippet")
- [x] Auto-detect language from active editor

### Phase 5 — Sidebar UI ✅ (fully redesigned)
- [x] Initial `SnippetTreeProvider` with grouped sections
- [x] Replaced with full **WebView sidebar** (`SidebarViewProvider`)
  - Persistent search bar (filters by title, language, tags)
  - Grouped view: Pinned → Recent (top 5) → All Snippets (collapsible)
  - Inline action buttons on hover: pin/unpin, edit, delete
  - Auth states handled inside WebView (signed-out, loading, empty, ready)
  - Language icons loaded via `webview.asWebviewUri`
- [x] Add refresh button in toolbar
- [x] Add **New Snippet** (`+`) button in toolbar — opens form without requiring a selection

### Phase 6 — Insert Snippet ✅
- [x] Implement `insertSnippet` command
- [x] Click snippet row in sidebar → insert at cursor
- [x] `SnippetQuickPick` for keyboard-shortcut search + insert

### Phase 7 — Delete & Edit ✅
- [x] Implement `deleteSnippet` command with confirmation dialog
- [x] Implement `editSnippet` command (title and tags)
- [x] Inline edit/delete buttons on each snippet row (hover to reveal)

### Phase 8 — Polish ✅
- [x] Loading indicators in WebView (spinner state)
- [x] Error handling with user-facing messages
- [x] Empty state in sidebar
- [x] **Pinned snippets** — stored in `globalState`, persist across sessions
- [x] **Language icons** — path-based SVGs for 16 languages (no `<text>` elements)
- [x] **Extension icon** — monochrome `< >` code icon for activity bar
- [x] **README** — features, getting started, commands table
- [x] **New Snippet form** — textarea for code input when no selection exists

### Phase 9 — UX Hardening ✅
- [x] **Snippet templates** — insert via `vscode.SnippetString` so `$1` / `${1:placeholder}` placeholders are tab-stoppable
- [x] **Default keybinding** — `Ctrl+Shift+S` / `Cmd+Shift+S` for QuickPick insert, remappable in VS Code

### Phase 10 — Shareability & Portability ✅
- [x] **Share as link** — "Copy Gist URL" link button on each snippet row (copies `html_url` to clipboard)
- [x] **Export snippets** — `Snipify: Export Snippets` command exports to `.code-snippets` (VS Code native) or JSON
- [x] **Import snippets** — `Snipify: Import Snippets` command imports from `.code-snippets` or Snipify JSON with a progress notification

### Phase 11 — Usage Intelligence ✅
- [x] **Usage tracking** — local counter per snippet ID stored in `globalState`, incremented on every insert
- [x] **Usage-based grouping** — "Most Used" group (top 5 by count) appears between Pinned and Recent; hidden until at least one snippet has been inserted
- [x] **Time-based grouping** — replaced flat "Recent + All Snippets" with Today / This Week / This Month / Earlier buckets; Earlier is collapsed by default
- [x] **Hover preview card** — fixed-position overlay card on snippet hover (500ms delay); shows language icon, tags, 12-line code preview, and relative timestamp; isolated from list DOM to avoid render interference

### Phase 12 — Pre-publish Hardening ✅
- [x] **Error banners** — compact amber/red strip above the list for all 4 failure cases (unreachable, rate-limited with countdown, token-expired, missing scope); list always stays visible; each banner has a primary action and a dismiss ✕
- [x] **First-run onboarding** — inline walkthrough card (3-step checklist: select, save, name); dismissible; self-removes after first snippet saved; persisted in `globalState`
- [x] **Offline read cache** — after every successful fetch, snippets are written to `<globalStorageUri>/snippets-cache.json`; on failure the cache is loaded and the amber offline chip is shown; survives VS Code restarts
- [x] **Provider migration warning** — modal fires when `snipify.provider` changes in Settings; offers Export first / Switch anyway / Cancel; reverting settings if cancelled
- [x] **Welcome states redesign** — logged-out (GitHub icon + two buttons), loading (skeleton rows with decreasing opacity + "Syncing…" footer), empty (sparkle icon + instructional body + save button); all match design spec
- [x] **Status bar logout bug** — `getUser()` now checks `SecretStorage` before calling `getSession()`; status bar correctly resets to logged-out state on logout

### Phase 13 — Future (V2+)
- [ ] GitLab Snippets storage implementation
- [ ] Snippet sharing (public Gist toggle)
- [ ] Import existing Gists by URL
- [ ] Snippet categories → better tag UX (multi-select filter, tag autocomplete) instead of folder tree
- [ ] GitHub Repo as storage backend (unlocks org permissions, PR-based review, branch-based snippet sets)
