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
  └── SidebarViewProvider  (WebView sidebar — search, grouped list, usage counts)
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

### globalState keys

| Key | Type | Purpose |
|---|---|---|
| `snipify.pinnedIds` | `string[]` | IDs of pinned snippets |
| `snipify.usageCounts` | `Record<string, number>` | Per-snippet insert counters |

### Stub providers

`GitLabAuthProvider`, `BitbucketAuthProvider`, `GitLabSnippetStorage`, and `BitbucketStorage` exist as stubs that throw `"coming soon"`. They must remain — the factories reference them and adding a real implementation later requires zero changes elsewhere.

## Key rules

- Commands must stay thin — no GitHub API calls, no token handling in `src/commands/`
- Always use `AuthProviderFactory` / `StorageFactory` to obtain providers
- Auth tokens only via `SecretStorage` (never `globalState` or workspace config)
- TypeScript strict mode is on — no `any`, no implicit returns
- `IAuthProvider` and `ISnippetStorage` interfaces must never change — new providers implement them as-is
- Snippet inserts go through `editor.insertSnippet(new vscode.SnippetString(...))` so tab stops work
