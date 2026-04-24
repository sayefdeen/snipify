# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build       # Bundle with esbuild → out/extension.js
npm run watch       # Bundle in watch mode
npm run compile     # Type-check only (no emit)
npm run lint        # ESLint over src/
```

To launch the extension in the VS Code Extension Development Host, press `F5` in VS Code (requires the project open as a workspace).

## Architecture

Snipify is a VS Code extension. All platform-specific concerns (auth and storage) sit behind interfaces — commands and UI **never** call GitHub/GitLab/Bitbucket APIs directly.

### Dependency flow

```
extension.ts
  └── AuthProviderFactory  →  IAuthProvider   ←  GitHubAuthProvider (V1)
  └── StorageFactory       →  ISnippetStorage ←  GitHubGistStorage  (V1)
  └── SidebarViewProvider  (WebView sidebar — search, grouped list, hover preview, error banners)
  └── SnippetForm          (WebView panel — save / new snippet)
  └── SnippetQuickPick     (command palette fuzzy search, Ctrl+Shift+S)
  └── commands/*           (thin wrappers — business logic lives in providers)
```

`extension.ts` is the sole wiring point: it reads `snipify.provider` from VS Code config, constructs the correct provider pair via the factories, and passes them into every command. Commands never instantiate providers directly.

### Interface contract

- `IAuthProvider` (`src/auth/`) — `login`, `logout`, `getToken`, `isLoggedIn`, `getUser`
- `ISnippetStorage` (`src/storage/`) — `getAll`, `save`, `update`, `delete`, `getById`

These interfaces must never be changed. New providers implement them; existing code needs no edits.

### Auth token lifecycle

Tokens flow through `src/utils/tokenStorage.ts` which wraps VS Code `SecretStorage`. `GitHubAuthProvider` is the only code that writes tokens; everything else calls `auth.getToken()`.

### GitHub Gists storage mapping

Each snippet = one private Gist. The Gist filename = snippet title; the Gist description = readable string `Language: x, Tags: y`. The `mapGistToSnippet()` method in `GitHubGistStorage` owns this mapping. `html_url` from the Gist API is stored as `Snippet.url` and exposed as a "Copy Gist URL" action in the sidebar.

### Offline cache

On each successful load, snippets are written to `globalStorageUri/snippets-cache.json` via `vscode.workspace.fs`. On failure, the cached file is read back and the sidebar shows an offline chip with the cache timestamp. Cache writes are non-fatal — failures are silently swallowed.

### Error classification

`classifyError()` in `extension.ts` maps HTTP status codes / message strings to `ErrorKind`:
- `token-expired` — 401
- `scope` — 403 with permission/scope mention
- `rate-limit` — 403/429; `GitHubGistStorage.getAll()` attaches `resetAt` (ms) from the `X-RateLimit-Reset` header
- `unreachable` — anything else

### globalState keys

| Key | Type | Purpose |
|---|---|---|
| `snipify.pinnedIds` | `string[]` | IDs of pinned snippets |
| `snipify.usageCounts` | `Record<string, number>` | Per-snippet insert counters |
| `snipify.onboardingDone` | `boolean` | Hides the onboarding card after first save |

### Sidebar state machine

`SidebarViewProvider` tracks `_auth` (`signed-out` | `loading` | `ready`), `_error`, `_offlineCachedAt`, and `_showOnboarding`. Every setter calls `_push()` which posts an `update` message to the webview. The webview's `render()` function is the single place that decides what to display.

### Snippet grouping

The sidebar groups snippets as: **Pinned → Most Used (top 5, ≥2 uses) → Today → This Week → This Month → Earlier**. Filtered (search) results skip grouping and show a flat list.

### Bitbucket storage

Each snippet = one JSON file in a private repo named `snipify-snippets` in the user's workspace. The Bitbucket Snippets API was deprecated (CHANGE-2770) — repo-based storage is the replacement.

- Filename = title slug: `"My Hook"` → `my-hook.json` (also used as the snippet `id`)
- `url` = `https://bitbucket.org/{workspace}/snipify-snippets/src/main/{id}.json`
- `save()` checks for duplicate title (GET the file first — 200 = already exists → error)
- `update()` with title change: writes new file then deletes old (two separate commits)
- `ensureRepo()` checks the repo exists; throws a helpful error with a creation link if not
- Auth token requires: `read:user:bitbucket`, `read/write/delete/admin:repository:bitbucket`
- Login flow asks for email, token, and workspace slug; verifies the repo exists before storing

### Stub providers

`GitLabAuthProvider` and `GitLabSnippetStorage` exist as stubs that throw `"coming soon"`. They must remain — the factories reference them and adding a real implementation later requires zero changes elsewhere.

## Key rules

- Commands must stay thin — no GitHub API calls, no token handling in `src/commands/`
- Always use `AuthProviderFactory` / `StorageFactory` to obtain providers
- Auth tokens only via `SecretStorage` (never `globalState` or workspace config)
- TypeScript strict mode is on — no `any`, no implicit returns
- `IAuthProvider` and `ISnippetStorage` interfaces must never change — new providers implement them as-is
- Snippet inserts go through `editor.insertSnippet(new vscode.SnippetString(...))` so tab stops work
- Both `SidebarViewProvider` and `SnippetForm` webviews must include a `Content-Security-Policy` meta tag
- `GitHubGistStorage` error objects must include `status` and (where available) `resetAt` properties so `classifyError()` can use them
