# Snipify — VS Code Extension Agent Prompt

## Project Overview

You are building **Snipify**, a VS Code extension that allows developers to save, manage, and reuse code snippets directly inside their IDE. Snippets are stored in the cloud using the user's own platform account (GitHub Gists in V1), so they are always synced and never lost.

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
- **Bundler**: esbuild (fast, lightweight for extensions)
- **Testing**: Jest + @vscode/test-electron
- **Linting**: ESLint + Prettier

---

## Architecture — Core Design Principle

Everything platform-specific (auth and storage) sits behind an **interface**. The rest of the app (UI, commands, models) NEVER talks to GitHub/GitLab/Bitbucket directly — it only talks to the interface. This makes adding new providers in the future require zero changes to existing code.

---

## Project Structure

```
snipify/
├── .gitignore
├── .eslintrc.json
├── .prettierrc
├── package.json
├── tsconfig.json
├── esbuild.js
├── README.md
│
└── src/
    ├── extension.ts                        # Entry point — registers all commands and providers
    │
    ├── models/
    │   ├── Snippet.ts                      # Core Snippet data model
    │   └── User.ts                         # Core User data model
    │
    ├── auth/
    │   ├── IAuthProvider.ts                # Auth interface — all providers must implement this
    │   ├── GitHubAuthProvider.ts           # GitHub OAuth implementation (V1)
    │   ├── GitLabAuthProvider.ts           # GitLab OAuth implementation (V2 — stub only in V1)
    │   ├── BitbucketAuthProvider.ts        # Bitbucket OAuth implementation (V3 — stub only in V1)
    │   └── AuthProviderFactory.ts          # Factory — returns correct provider based on user setting
    │
    ├── storage/
    │   ├── ISnippetStorage.ts              # Storage interface — all providers must implement this
    │   ├── GitHubGistStorage.ts            # GitHub Gists API implementation (V1)
    │   ├── GitLabSnippetStorage.ts         # GitLab Snippets API implementation (V2 — stub only in V1)
    │   ├── BitbucketStorage.ts             # Bitbucket implementation (V3 — stub only in V1)
    │   └── StorageFactory.ts               # Factory — returns correct storage based on user setting
    │
    ├── ui/
    │   ├── SnippetTreeProvider.ts          # Sidebar tree view — lists all saved snippets
    │   ├── SnippetForm.ts                  # Webview panel — form to save a snippet with title and tags
    │   └── SnippetQuickPick.ts             # Optional: command palette fuzzy search for snippets
    │
    ├── commands/
    │   ├── saveSnippet.ts                  # Command: save selected code as a snippet
    │   ├── insertSnippet.ts                # Command: insert snippet at cursor
    │   ├── deleteSnippet.ts                # Command: delete a snippet
    │   ├── editSnippet.ts                  # Command: edit snippet title or tags
    │   └── login.ts                        # Command: trigger auth login flow
    │
    └── utils/
        ├── languageDetector.ts             # Detects language from active editor file type
        └── tokenStorage.ts                 # Stores/retrieves auth token using VS Code SecretStorage
```

---

## Models

### Snippet.ts
```typescript
export interface Snippet {
  id: string;            // Unique ID from the platform (Gist ID, GitLab Snippet ID, etc.)
  title: string;         // User-defined title
  code: string;          // The actual code content
  language: string;      // Auto-detected from file type (e.g. 'typescript', 'python')
  tags: string[];        // Optional tags for filtering
  createdAt: Date;
  updatedAt: Date;
  provider: ProviderType; // Which platform this snippet belongs to
}
```

### User.ts
```typescript
export type ProviderType = 'github' | 'gitlab' | 'bitbucket';

export interface User {
  id: string;
  username: string;
  avatarUrl?: string;
  provider: ProviderType;
}
```

---

## Auth Layer

### IAuthProvider.ts (Interface — never change this)
```typescript
export interface IAuthProvider {
  login(): Promise<User>;
  logout(): Promise<void>;
  getToken(): Promise<string | null>;
  isLoggedIn(): Promise<boolean>;
  getUser(): Promise<User | null>;
}
```

### GitHubAuthProvider.ts (V1 Implementation)
- Use `vscode.authentication.getSession('github', ['gist'], { createIfNone: true })`
- This uses VS Code's built-in GitHub OAuth — no custom OAuth server needed
- Store the token securely using VS Code's `SecretStorage` API via `tokenStorage.ts`
- Implement all methods from `IAuthProvider`

### GitLabAuthProvider.ts (V2 — Stub in V1)
```typescript
export class GitLabAuthProvider implements IAuthProvider {
  async login(): Promise<User> {
    throw new Error('GitLab support coming soon');
  }
  // ... other stubs
}
```

### BitbucketAuthProvider.ts (V3 — Stub in V1)
Same pattern as GitLab stub.

### AuthProviderFactory.ts
```typescript
export class AuthProviderFactory {
  static create(provider: ProviderType): IAuthProvider {
    switch (provider) {
      case 'github':    return new GitHubAuthProvider();
      case 'gitlab':    return new GitLabAuthProvider();
      case 'bitbucket': return new BitbucketAuthProvider();
      default:          throw new Error(`Unknown provider: ${provider}`);
    }
  }
}
```

---

## Storage Layer

### ISnippetStorage.ts (Interface — never change this)
```typescript
export interface ISnippetStorage {
  getAll(): Promise<Snippet[]>;
  save(snippet: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>): Promise<Snippet>;
  update(id: string, updates: Partial<Snippet>): Promise<Snippet>;
  delete(id: string): Promise<void>;
  getById(id: string): Promise<Snippet | null>;
}
```

### GitHubGistStorage.ts (V1 Implementation)
- Use GitHub Gists REST API (`https://api.github.com/gists`)
- Each snippet = one private Gist
- Gist filename = snippet title
- Gist description = JSON metadata string `{ language, tags, createdAt }`
- Use `node-fetch` or the native `fetch` (Node 18+) for HTTP calls
- Auth header: `Authorization: Bearer <token>`
- Map Gist API response → `Snippet` model in a private `mapGistToSnippet()` method

### StorageFactory.ts
```typescript
export class StorageFactory {
  static create(provider: ProviderType, token: string): ISnippetStorage {
    switch (provider) {
      case 'github':    return new GitHubGistStorage(token);
      case 'gitlab':    return new GitLabSnippetStorage(token);
      case 'bitbucket': return new BitbucketStorage(token);
      default:          throw new Error(`Unknown provider: ${provider}`);
    }
  }
}
```

---

## UI Layer

### SnippetTreeProvider.ts
- Implements `vscode.TreeDataProvider<SnippetTreeItem>`
- Shows all snippets in the sidebar as a tree list
- Each item shows: snippet title + language badge
- Supports refresh (called after save/delete)
- Register with: `vscode.window.createTreeView('snipify.snippetsView', { treeDataProvider })`

### SnippetForm.ts
- A `vscode.WebviewPanel` that opens when saving a snippet
- Contains: title input, tags input (comma-separated), language (auto-filled, editable), preview of selected code
- On submit: calls `saveSnippet` command with form data
- Communicates with extension via `webview.postMessage` / `onDidReceiveMessage`

### SnippetQuickPick.ts (Optional but recommended)
- Uses `vscode.window.showQuickPick` to fuzzy search snippets by title or tag
- Useful as a keyboard-shortcut alternative to the sidebar

---

## Commands

All commands are registered in `extension.ts` using `vscode.commands.registerCommand`.

| Command ID | Title | Description |
|---|---|---|
| `snipify.saveSnippet` | Save Snippet | Opens form to save selected code |
| `snipify.insertSnippet` | Insert Snippet | Inserts snippet at cursor |
| `snipify.deleteSnippet` | Delete Snippet | Deletes a snippet |
| `snipify.editSnippet` | Edit Snippet | Edit title or tags |
| `snipify.login` | Login with GitHub | Triggers auth flow |
| `snipify.logout` | Logout | Clears stored token |
| `snipify.refresh` | Refresh Snippets | Re-fetches all snippets |

### saveSnippet.ts logic
1. Check if user is logged in — if not, trigger login first
2. Get selected text from `vscode.window.activeTextEditor.selection`
3. Get language from `activeTextEditor.document.languageId`
4. Open `SnippetForm` webview with pre-filled code and language
5. On form submit → call `storage.save(snippet)`
6. Refresh the tree view

### insertSnippet.ts logic
1. Receive `Snippet` object (from tree item click or QuickPick)
2. Get active editor and current cursor position
3. Call `editor.edit(editBuilder => editBuilder.insert(position, snippet.code))`

---

## package.json Contributions

```json
{
  "contributes": {
    "viewsContainers": {
      "activitybar": [{
        "id": "snipify",
        "title": "Snipify",
        "icon": "assets/icon.svg"
      }]
    },
    "views": {
      "snipify": [{
        "id": "snipify.snippetsView",
        "name": "My Snippets"
      }]
    },
    "commands": [
      { "command": "snipify.saveSnippet", "title": "Snipify: Save Snippet" },
      { "command": "snipify.login", "title": "Snipify: Login with GitHub" }
    ],
    "menus": {
      "editor/context": [{
        "command": "snipify.saveSnippet",
        "when": "editorHasSelection",
        "group": "snipify"
      }]
    },
    "configuration": {
      "title": "Snipify",
      "properties": {
        "snipify.provider": {
          "type": "string",
          "default": "github",
          "enum": ["github", "gitlab", "bitbucket"],
          "description": "The platform to use for storing snippets"
        }
      }
    }
  }
}
```

---

## Build & Tooling

### tsconfig.json
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "lib": ["ES2020"],
    "outDir": "out",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "sourceMap": true
  },
  "exclude": ["node_modules", ".vscode-test"]
}
```

### Dependencies
```json
{
  "devDependencies": {
    "@types/vscode": "^1.85.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0",
    "esbuild": "^0.20.0",
    "eslint": "^8.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0"
  }
}
```

---

## Development Phases

### Phase 1 — Foundation ✅
- [x] Initialize extension with `yo code` or manually
- [x] Set up TypeScript, ESLint, esbuild
- [x] Create all interface files (`IAuthProvider`, `ISnippetStorage`)
- [x] Create model files (`Snippet`, `User`)
- [x] Create all stub provider files
- [x] Register extension entry point in `extension.ts`
- [x] Confirm extension loads in VS Code without errors

### Phase 2 — GitHub Auth
- [ ] Implement `GitHubAuthProvider` using `vscode.authentication`
- [ ] Implement `tokenStorage.ts` using VS Code `SecretStorage`
- [ ] Implement `login` and `logout` commands
- [ ] Show logged-in username in the sidebar or status bar
- [ ] Test: login flow works end to end

### Phase 3 — GitHub Gists Storage
- [ ] Implement `GitHubGistStorage` with all `ISnippetStorage` methods
- [ ] Implement `mapGistToSnippet()` mapping function
- [ ] Test: save a snippet → appears as a Gist on github.com
- [ ] Test: fetch all snippets → returns correct list

### Phase 4 — Save Snippet Command
- [ ] Implement `SnippetForm` webview (title, tags, code preview)
- [ ] Implement `saveSnippet` command end to end
- [ ] Wire up right-click context menu ("Save as Snippet")
- [ ] Auto-detect language from active editor
- [ ] Test: select code → right-click → save → appears in Gists

### Phase 5 — Sidebar UI
- [ ] Implement `SnippetTreeProvider`
- [ ] Register the sidebar view in `package.json`
- [ ] Show all snippets with title and language
- [ ] Add refresh button
- [ ] Test: snippets appear in sidebar after login

### Phase 6 — Insert Snippet
- [ ] Implement `insertSnippet` command
- [ ] Wire up sidebar item click → insert at cursor
- [ ] Handle edge cases: no active editor, multiple cursors
- [ ] Test: click snippet in sidebar → code inserted at cursor

### Phase 7 — Delete & Edit
- [ ] Implement `deleteSnippet` command with confirmation dialog
- [ ] Implement `editSnippet` command (title and tags only)
- [ ] Add context menu on sidebar items (right-click → delete/edit)
- [ ] Test: delete removes from Gists, edit updates Gist description

### Phase 8 — Polish
- [ ] Add `SnippetQuickPick` for keyboard-shortcut search
- [ ] Add loading indicators (when fetching snippets)
- [ ] Add error handling and user-facing error messages
- [ ] Add empty state in sidebar when no snippets exist
- [ ] Add extension icon and README
- [ ] Test full user flow end to end

---

## Key Rules to Follow

1. **Never bypass the interface** — commands and UI must always use `IAuthProvider` and `ISnippetStorage`, never call GitHub API directly
2. **Use factories everywhere** — get providers from `AuthProviderFactory` and `StorageFactory`, never instantiate directly in commands
3. **SecretStorage for tokens** — never store auth tokens in `globalState` or plain config
4. **Stub future providers** — GitLab and Bitbucket files must exist as stubs from Phase 1, even if they just throw "coming soon"
5. **Keep commands thin** — business logic lives in storage/auth providers, not in command files
6. **TypeScript strict mode** — no `any` types, no implicit returns

---

## Suggested Claude Agent to Use

Use **Claude claude-sonnet-4-20250514** (the latest Sonnet model) for this project via **Claude Code** (the CLI agent). Here is why:

- Claude Code operates directly in your terminal with full access to your file system and can read, write, and run files without copy-pasting
- It can run `npm install`, `tsc`, and open the VS Code extension host to test changes
- Sonnet 4 is the best balance of speed and capability for a coding project of this size
- Use it with the prompt below as your starting system instruction

**How to use Claude Code for this project:**
```bash
# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Navigate to your project
cd snipify

# Start Claude Code
claude
```

Work through phases one at a time, testing each phase before moving to the next.