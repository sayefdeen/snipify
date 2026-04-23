# Changelog

## [0.0.1] — Initial Release

### Added
- Save snippets from any code selection via right-click or the `+` sidebar button
- Sidebar with persistent search (filters by title, language, or tag)
- Snippet grouping: Pinned → Most Used → Today → This Week → This Month → Earlier
- Hover preview card — 12-line code preview on mouse-over (500 ms delay)
- Insert snippet at cursor with tab-stop support (`$1`, `${1:placeholder}`)
- Quick pick search via `Ctrl+Shift+S` / `Cmd+Shift+S`
- Pin/unpin, edit, and delete snippets inline from the sidebar
- Copy Gist URL to clipboard
- Export snippets to `.code-snippets` or JSON
- Import snippets from `.code-snippets` or a Snipify JSON export
- Offline read cache — last-synced snippets available when GitHub is unreachable
- Error banners for rate-limit, token-expiry, scope, and network errors
- First-run onboarding card (dismissible, self-removes after first save)
- Provider migration warning when switching `snipify.provider` in Settings
