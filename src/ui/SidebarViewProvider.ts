import * as vscode from 'vscode';
import { Snippet } from '../models/Snippet';

export type AuthState = 'signed-out' | 'loading' | 'ready';
export type ErrorKind = 'unreachable' | 'rate-limit' | 'token-expired' | 'scope';

export type SidebarMessage =
  | { type: 'insert'; id: string }
  | { type: 'edit'; id: string }
  | { type: 'delete'; id: string }
  | { type: 'pin'; id: string }
  | { type: 'unpin'; id: string }
  | { type: 'copyLink'; id: string }
  | { type: 'refresh' }
  | { type: 'login' }
  | { type: 'use-local' }
  | { type: 'saveSnippet' }
  | { type: 'dismiss-onboarding' }
  | { type: 'dismiss-banner' };

interface SnippetData {
  id: string;
  title: string;
  language: string;
  tags: string[];
  updatedAt: number;
  pinned: boolean;
  url?: string;
  usageCount: number;
  codePreview: string;
}

const LANGS = [
  'typescript', 'javascript', 'typescriptreact', 'javascriptreact',
  'python', 'html', 'css', 'scss', 'go', 'rust',
  'json', 'markdown', 'shellscript', 'sql', 'yaml', 'plaintext',
];

export class SidebarViewProvider implements vscode.WebviewViewProvider {
  static readonly viewId = 'snipify.mainView';

  private _view?: vscode.WebviewView;
  private _auth: AuthState = 'loading';
  private _snippets: Snippet[] = [];
  private _pinnedIds: Set<string> = new Set();
  private _usageCounts: Record<string, number> = {};
  private _error: { kind: ErrorKind; resetAt?: number } | null = null;
  private _offlineCachedAt: number | null = null;
  private _showOnboarding: boolean = false;

  private readonly _onMessage = new vscode.EventEmitter<SidebarMessage>();
  readonly onMessage = this._onMessage.event;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this._view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'assets')],
    };
    view.webview.html = this._buildHtml(view.webview);
    view.webview.onDidReceiveMessage((msg: SidebarMessage) => {
      this._onMessage.fire(msg);
    });
    this._push();
  }

  setAuth(auth: AuthState): void {
    this._auth = auth;
    this._push();
  }

  setSnippets(snippets: Snippet[], pinnedIds: Set<string>, usageCounts: Record<string, number> = {}): void {
    this._auth = 'ready';
    this._snippets = snippets;
    this._pinnedIds = pinnedIds;
    this._usageCounts = usageCounts;
    this._push();
  }

  setError(kind: ErrorKind, resetAt?: number): void {
    this._error = { kind, resetAt };
    this._push();
  }

  clearError(): void {
    this._error = null;
    this._offlineCachedAt = null;
    this._push();
  }

  setOffline(cachedAt: number): void {
    this._offlineCachedAt = cachedAt;
    this._push();
  }

  clearOffline(): void {
    this._offlineCachedAt = null;
    this._push();
  }

  setOnboarding(show: boolean): void {
    this._showOnboarding = show;
    this._push();
  }

  private _push(): void {
    if (!this._view) return;
    const data: SnippetData[] = this._snippets.map((s) => ({
      id: s.id,
      title: s.title,
      language: s.language,
      tags: s.tags,
      updatedAt: s.updatedAt.getTime(),
      pinned: this._pinnedIds.has(s.id),
      url: s.url,
      usageCount: this._usageCounts[s.id] ?? 0,
      codePreview: s.code.split('\n').slice(0, 12).join('\n'),
    }));
    this._view.webview.postMessage({
      type: 'update',
      auth: this._auth,
      snippets: data,
      error: this._error,
      offline: this._offlineCachedAt !== null ? { cachedAt: this._offlineCachedAt } : null,
      showOnboarding: this._showOnboarding,
    });
  }

  private _buildHtml(webview: vscode.Webview): string {
    const csp = [
      `default-src 'none'`,
      `img-src ${webview.cspSource}`,
      `style-src 'unsafe-inline'`,
      `script-src 'unsafe-inline'`,
    ].join('; ');

    const iconMap: Record<string, string> = {};
    for (const lang of LANGS) {
      iconMap[lang] = webview
        .asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'assets', 'icons', `${lang}.svg`))
        .toString();
    }

    const iconsJson = JSON.stringify(iconMap);

    return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Security-Policy" content="${csp}"/>
<style>
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0;font-family:var(--vscode-font-family);font-size:var(--vscode-font-size,13px);color:var(--vscode-foreground);background:transparent}

#search-wrap{padding:6px 8px 4px;position:sticky;top:0;background:var(--vscode-sideBar-background,var(--vscode-editor-background));z-index:10}
.search-box{display:flex;align-items:center;background:var(--vscode-input-background);border:1px solid var(--vscode-input-border,transparent);border-radius:2px;padding:0 6px;gap:4px;height:26px}
.search-box:focus-within{border-color:var(--vscode-focusBorder)}
.search-icon{flex-shrink:0;color:var(--vscode-input-placeholderForeground);display:flex;align-items:center}
#search-input{flex:1;background:transparent;border:none;outline:none;color:var(--vscode-input-foreground);font-family:var(--vscode-font-family);font-size:13px;min-width:0}
#search-input::placeholder{color:var(--vscode-input-placeholderForeground)}
#clear-btn{background:none;border:none;cursor:pointer;padding:0;color:var(--vscode-input-placeholderForeground);display:flex;align-items:center}
#clear-btn:hover{color:var(--vscode-input-foreground)}
#clear-btn.hidden{display:none}

#banner-wrap{padding:0}

.banner{margin:4px 6px 6px;padding:7px 8px 8px 10px;border-radius:3px;font-size:12px;line-height:1.45;position:relative}
.banner.warn{background:#352C1A;border:1px solid #6B4F1D;border-left:2px solid #D19A66}
.banner.error{background:#3A1E1E;border:1px solid #6F2A2A;border-left:2px solid #F48771}
.banner.info{background:#1A2A3A;border:1px solid #1E4A6B;border-left:2px solid #4FC1FF}
.banner-inner{display:flex;align-items:flex-start;gap:7px}
.banner-icon{flex-shrink:0;margin-top:1px;display:flex}
.banner.warn .banner-icon{color:#D19A66}
.banner.error .banner-icon{color:#F48771}
.banner.info .banner-icon{color:#4FC1FF}
.banner-body{flex:1;min-width:0}
.banner-title{font-weight:600;font-size:12px;color:var(--vscode-foreground)}
.banner-sub{color:var(--vscode-descriptionForeground);font-size:11.5px;margin-top:2px}
.banner-sub code{font-family:var(--vscode-editor-font-family,monospace);color:var(--vscode-foreground)}
.banner-actions{display:flex;gap:12px;margin-top:6px;flex-wrap:wrap;align-items:center}
.banner-primary{color:#4DAAFC;font-size:11.5px;font-weight:600;cursor:pointer;background:none;border:none;padding:0;font-family:inherit}
.banner-primary:hover{text-decoration:underline}
.banner-secondary{color:var(--vscode-descriptionForeground);font-size:11.5px;cursor:pointer;background:none;border:none;padding:0;font-family:inherit;text-decoration:underline;text-underline-offset:2px}
.banner-close{flex-shrink:0;margin-top:1px;cursor:pointer;background:none;border:none;padding:2px;color:var(--vscode-descriptionForeground);opacity:.55;display:flex;align-items:center;border-radius:2px}
.banner-close:hover{opacity:1;background:var(--vscode-toolbar-hoverBackground)}

.offline-chip{height:20px;display:flex;align-items:center;gap:6px;padding:0 8px 0 10px;margin:2px 6px 4px;background:rgba(210,154,102,.10);border:1px solid rgba(210,154,102,.25);border-radius:10px;font-size:11px;color:#D19A66;min-width:0}
.offline-dot{width:6px;height:6px;border-radius:3px;background:#D19A66;flex-shrink:0}
.offline-label{font-weight:600;letter-spacing:.2px;white-space:nowrap}
.offline-since{color:var(--vscode-descriptionForeground);font-weight:400;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.offline-retry{color:#4DAAFC;cursor:pointer;background:none;border:none;padding:0;font-size:11px;font-family:inherit;flex-shrink:0}
.offline-retry:hover{text-decoration:underline}

#content{padding-bottom:8px}

.group-header{display:flex;align-items:center;gap:4px;padding:6px 8px 2px;cursor:pointer;user-select:none;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--vscode-sideBarSectionHeader-foreground,var(--vscode-foreground));opacity:.8}
.group-header:hover{opacity:1}
.chevron{transition:transform .1s;flex-shrink:0}
.group.collapsed .chevron{transform:rotate(-90deg)}
.group.collapsed .group-items{display:none}
.group-count{font-weight:400;opacity:.6;margin-left:2px}

.snippet-row{display:flex;align-items:center;padding:0 8px 0 20px;height:22px;cursor:pointer;gap:6px;position:relative}
.snippet-row:hover{background:var(--vscode-list-hoverBackground)}
.snippet-row:active{background:var(--vscode-list-activeSelectionBackground);color:var(--vscode-list-activeSelectionForeground)}
.lang-icon{width:16px;height:16px;flex-shrink:0;object-fit:contain}
.snippet-title{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
.snippet-desc{font-size:11px;color:var(--vscode-descriptionForeground);white-space:nowrap;flex-shrink:0;max-width:90px;overflow:hidden;text-overflow:ellipsis}
.snippet-actions{display:none;align-items:center;gap:1px;flex-shrink:0}
.snippet-row:hover .snippet-actions{display:flex}
.snippet-row:hover .snippet-desc{display:none}
.snippet-row:hover .usage-count{display:none}
.usage-count{font-size:10px;color:var(--vscode-descriptionForeground);opacity:.55;flex-shrink:0;line-height:1}
.action-btn{background:none;border:none;cursor:pointer;padding:2px;color:var(--vscode-icon-foreground);display:flex;align-items:center;border-radius:3px;opacity:.75}
.action-btn:hover{opacity:1;background:var(--vscode-toolbar-hoverBackground)}

.welcome-view{padding:16px 20px;display:flex;flex-direction:column;gap:10px}
.welcome-icon{color:var(--vscode-descriptionForeground);margin-bottom:-2px}
.welcome-heading{color:var(--vscode-foreground);font-weight:600;font-size:13px}
.welcome-body{color:var(--vscode-foreground);opacity:.9;font-size:13px;line-height:1.55}
.welcome-body a{color:var(--vscode-textLink-foreground,#4DAAFC);cursor:pointer;text-decoration:none}
.welcome-body a:hover{text-decoration:underline}
.welcome-btn{appearance:none;border:none;padding:5px 10px;font-size:13px;border-radius:2px;cursor:pointer;font-family:var(--vscode-font-family);width:100%;text-align:center}
.welcome-btn.primary{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
.welcome-btn.primary:hover{background:var(--vscode-button-hoverBackground)}
.welcome-btn.secondary{background:transparent;color:var(--vscode-foreground);border:1px solid var(--vscode-widget-border,#454545)}
.welcome-btn.secondary:hover{background:var(--vscode-list-hoverBackground)}

.skeleton-wrap{padding:0 0 6px}
.skeleton-row{height:22px;display:flex;align-items:center;gap:8px;padding:0 8px}
.skeleton-icon{width:14px;height:14px;border-radius:3px;background:var(--vscode-list-hoverBackground,#2a2a2a);flex-shrink:0}
.skeleton-bar{height:10px;border-radius:2px;background:var(--vscode-list-hoverBackground,#2a2a2a)}
.skeleton-footer{padding:12px 20px;color:var(--vscode-descriptionForeground);font-size:12px;display:flex;align-items:center;gap:6px;opacity:.7}

.onb-card{margin:8px 8px 4px;border:1px solid #2E4A6B;background:linear-gradient(180deg,rgba(30,74,107,.18) 0%,rgba(30,74,107,.06) 100%);border-radius:4px;padding:12px 12px 10px}
.onb-header{display:flex;align-items:center;gap:6px;margin-bottom:8px}
.onb-badge{font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:#4FC1FF;flex:1}
.onb-close{background:none;border:none;cursor:pointer;padding:2px;color:var(--vscode-descriptionForeground);opacity:.55;display:flex;align-items:center;border-radius:2px}
.onb-close:hover{opacity:1;background:var(--vscode-toolbar-hoverBackground)}
.onb-step{display:flex;align-items:flex-start;gap:8px;padding:4px 0}
.onb-circle{width:16px;height:16px;border-radius:8px;flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700}
.onb-circle.done{border:1px solid #6BBF6B;background:#2A3E2A;color:#6BBF6B}
.onb-circle.active{border:1px solid #4FC1FF;background:rgba(79,193,255,.12);color:#4FC1FF}
.onb-circle.todo{border:1px solid #444;background:transparent;color:var(--vscode-descriptionForeground)}
.onb-step-title{font-size:12.5px;color:var(--vscode-foreground)}
.onb-step-title.done{color:var(--vscode-descriptionForeground);text-decoration:line-through}
.onb-step-title.active{font-weight:600}
.onb-step-hint{font-size:11.5px;color:var(--vscode-descriptionForeground);margin-top:1px}
.ghost-label{padding:6px 8px 2px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--vscode-descriptionForeground);opacity:.6}
.ghost-row{display:flex;align-items:center;gap:8px;padding:0 8px 0 20px;height:22px;opacity:.3}
.ghost-icon{width:14px;height:14px;border-radius:3px;background:var(--vscode-list-hoverBackground,#2a2d2e);flex-shrink:0}
.ghost-bar{height:8px;border-radius:2px;background:var(--vscode-list-hoverBackground,#2a2d2e)}

#hover-card{display:none;position:fixed;left:8px;right:8px;z-index:200;background:var(--vscode-editorHoverWidget-background,var(--vscode-editor-background));border:1px solid var(--vscode-editorHoverWidget-border,var(--vscode-widget-border,#454545));border-radius:3px;padding:8px 10px;box-shadow:0 2px 8px rgba(0,0,0,.35);pointer-events:none}
#hc-header{display:flex;align-items:center;gap:6px;margin-bottom:4px}
#hc-icon{width:14px;height:14px;flex-shrink:0;object-fit:contain}
#hc-title{font-weight:600;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--vscode-editorHoverWidget-foreground,var(--vscode-foreground))}
#hc-tags{font-size:11px;color:var(--vscode-descriptionForeground);margin-bottom:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#hc-code{margin:0;padding:5px 7px;background:var(--vscode-textCodeBlock-background,var(--vscode-editor-background));border-radius:2px;font-family:var(--vscode-editor-font-family,monospace);font-size:11px;line-height:1.5;overflow:hidden;white-space:pre;max-height:150px;color:var(--vscode-editor-foreground,var(--vscode-foreground))}
#hc-meta{font-size:10px;color:var(--vscode-descriptionForeground);margin-top:5px;opacity:.7}
</style>
</head>
<body>

<div id="search-wrap">
  <div class="search-box">
    <span class="search-icon">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398l3.85 3.85a1 1 0 0 0 1.415-1.415l-3.85-3.85a1.007 1.007 0 0 0-.018-.017zm-5.242 1.156a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z"/>
      </svg>
    </span>
    <input id="search-input" type="text" placeholder="Search snippets…" autocomplete="off" spellcheck="false"/>
    <button id="clear-btn" class="hidden" title="Clear">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
      </svg>
    </button>
  </div>
</div>

<div id="banner-wrap"></div>

<div id="content"></div>

<div id="hover-card">
  <div id="hc-header">
    <img id="hc-icon" src="" alt=""/>
    <span id="hc-title"></span>
  </div>
  <div id="hc-tags"></div>
  <pre id="hc-code"></pre>
  <div id="hc-meta"></div>
</div>

<script>
(function() {
  var vscode = acquireVsCodeApi();
  var ICONS = ${iconsJson};
  var FALLBACK = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="%236E6E6E"/></svg>';

  var auth = 'loading';
  var snippets = [];
  var filter = '';
  var collapsed = { all: true };
  var errorState = null;
  var offlineState = null;
  var showOnboarding = false;
  var countdownInterval = null;

  // ── SVG icon strings ────────────────────────────────────────────────
  var SVG = {
    cloudOff: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><line x1="2" y1="2" x2="22" y2="22"/></svg>',
    watch:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    key:      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>',
    shield:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    sparkle:  '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z"/></svg>',
    check:    '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    close:    '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    swap:     '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
    retry:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
  };

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function iconSrc(lang) {
    return ICONS[(lang || '').toLowerCase()] || FALLBACK;
  }

  function filtered(list) {
    if (!filter) return list;
    var q = filter.toLowerCase();
    return list.filter(function(s) {
      return s.title.toLowerCase().indexOf(q) !== -1
        || s.language.toLowerCase().indexOf(q) !== -1
        || s.tags.some(function(t) { return t.toLowerCase().indexOf(q) !== -1; });
    });
  }

  function relTimeMs(ms) {
    var d = (Date.now() - ms) / 1000;
    if (d < 60) return 'just now';
    if (d < 3600) return Math.floor(d/60)+'m ago';
    if (d < 86400) return Math.floor(d/3600)+'h ago';
    if (d < 604800) return Math.floor(d/86400)+'d ago';
    return new Date(ms).toLocaleDateString();
  }

  // ── Banner ───────────────────────────────────────────────────────────
  var ERROR_META = {
    'unreachable':   { tone: 'warn',  icon: 'cloudOff', title: "Can't reach GitHub",       sub: 'Showing last cached snippets. New saves will sync when you&rsquo;re back online.', primary: 'Retry now',       secondary: null,                   primaryMsg: 'refresh' },
    'rate-limit':    { tone: 'warn',  icon: 'watch',    title: 'GitHub rate limit reached', sub: null,                                                                               primary: 'Sign in to raise limit to 5,000/hr', secondary: null,             primaryMsg: 'login' },
    'token-expired': { tone: 'error', icon: 'key',      title: 'GitHub session expired',    sub: 'Your snippets are safe. Sign in again to resume syncing.',                         primary: 'Sign in again',   secondary: 'Keep working offline',  primaryMsg: 'login' },
    'scope':         { tone: 'error', icon: 'shield',   title: 'Missing gist permission',   sub: 'Your token can read gists but not write them. Re-authorize to grant gist scope.',  primary: 'Re-authorize',    secondary: null,                   primaryMsg: 'login' },
  };

  function startCountdown(resetAt) {
    clearInterval(countdownInterval);
    if (!resetAt) return;
    function tick() {
      var span = document.getElementById('rate-countdown');
      if (!span) { clearInterval(countdownInterval); return; }
      var remaining = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));
      var m = Math.floor(remaining / 60), s = remaining % 60;
      span.textContent = m + ':' + (s < 10 ? '0' : '') + s;
      if (remaining === 0) clearInterval(countdownInterval);
    }
    tick();
    countdownInterval = setInterval(tick, 1000);
  }

  function renderBanner() {
    var el = document.getElementById('banner-wrap');

    if (offlineState) {
      var since = offlineState.cachedAt ? '· cached ' + relTimeMs(offlineState.cachedAt) : '';
      el.innerHTML = '<div class="offline-chip">'
        + '<span class="offline-dot"></span>'
        + '<span class="offline-label">Offline</span>'
        + '<span class="offline-since">&nbsp;' + esc(since) + '</span>'
        + '<button class="offline-retry" data-action="refresh">Retry</button>'
        + '</div>';
      return;
    }

    if (errorState) {
      var m = ERROR_META[errorState.kind];
      if (!m) { el.innerHTML = ''; return; }
      var sub = m.sub;
      if (errorState.kind === 'rate-limit') {
        sub = 'Retrying automatically'
          + (errorState.resetAt ? ' in <code><span id="rate-countdown">…</span></code>' : '')
          + '. Sign in to raise limit to 5,000/hr.';
      }
      var actHtml = '<div class="banner-actions">'
        + '<button class="banner-primary" data-action="' + m.primaryMsg + '">&rsaquo; ' + esc(m.primary) + '</button>'
        + (m.secondary ? '<button class="banner-secondary" data-action="dismiss-banner">' + esc(m.secondary) + '</button>' : '')
        + '</div>';
      el.innerHTML = '<div class="banner ' + m.tone + '">'
        + '<div class="banner-inner">'
        + '<span class="banner-icon">' + SVG[m.icon] + '</span>'
        + '<div class="banner-body">'
        + '<div class="banner-title">' + esc(m.title) + '</div>'
        + (sub ? '<div class="banner-sub">' + sub + '</div>' : '')
        + actHtml
        + '</div>'
        + '<button class="banner-close" data-action="dismiss-banner">' + SVG.close + '</button>'
        + '</div></div>';
      if (errorState.kind === 'rate-limit') startCountdown(errorState.resetAt);
      return;
    }

    el.innerHTML = '';
  }

  // ── Snippet rows ─────────────────────────────────────────────────────
  var PIN_SVG  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17 4v8l2 2v2h-6v6l-1 1-1-1v-6H5v-2l2-2V4H6V2h12v2h-1z"/></svg>';
  var EDIT_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
  var DEL_SVG  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
  var LINK_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>';
  var CHEVRON  = '<svg class="chevron" width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M4 6l4 4 4-4H4z"/></svg>';

  function rowHtml(s) {
    var desc = s.tags.length ? s.tags.slice(0,3).map(function(t){return '#'+t;}).join(' ') : s.language;
    var pinBtn = s.pinned
      ? '<button class="action-btn" title="Unpin" data-action="unpin" data-id="'+esc(s.id)+'">'+PIN_SVG+'</button>'
      : '<button class="action-btn" title="Pin"   data-action="pin"   data-id="'+esc(s.id)+'" style="opacity:.4">'+PIN_SVG+'</button>';
    var countBadge = s.usageCount > 0 ? '<span class="usage-count">'+s.usageCount+'</span>' : '';
    return '<div class="snippet-row" data-id="'+esc(s.id)+'">'
      +'<img class="lang-icon" src="'+iconSrc(s.language)+'" alt=""/>'
      +'<span class="snippet-title" title="'+esc(s.title)+'">'+esc(s.title)+'</span>'
      +countBadge
      +'<span class="snippet-desc">'+esc(desc)+'</span>'
      +'<div class="snippet-actions">'+pinBtn
      +(s.url ? '<button class="action-btn" title="Copy Gist URL" data-action="copyLink" data-id="'+esc(s.id)+'">'+LINK_SVG+'</button>' : '')
      +'<button class="action-btn" title="Edit"   data-action="edit"   data-id="'+esc(s.id)+'">'+EDIT_SVG+'</button>'
      +'<button class="action-btn" title="Delete" data-action="delete" data-id="'+esc(s.id)+'">'+DEL_SVG+'</button>'
      +'</div></div>';
  }

  function groupHtml(id, label, items, defaultCollapsed) {
    var isCollapsed = collapsed[id] !== undefined ? collapsed[id] : defaultCollapsed;
    return '<div class="group'+(isCollapsed?' collapsed':'')+'" id="grp-'+id+'">'
      +'<div class="group-header" data-group="'+id+'">'
      +CHEVRON+esc(label)+'<span class="group-count">'+items.length+'</span>'
      +'</div>'
      +'<div class="group-items">'+items.map(rowHtml).join('')+'</div>'
      +'</div>';
  }

  // ── Onboarding card ──────────────────────────────────────────────────
  function onbStep(n, title, hint, state) {
    return '<div class="onb-step">'
      +'<div class="onb-circle '+state+'">'+(state==='done'?SVG.check:n)+'</div>'
      +'<div><div class="onb-step-title '+state+'">'+esc(title)+'</div>'
      +(hint && state!=='done' ? '<div class="onb-step-hint">'+esc(hint)+'</div>' : '')
      +'</div></div>';
  }

  function onboardingHtml() {
    var ghostWidths = [140, 110, 160];
    var ghosts = ghostWidths.map(function(w) {
      return '<div class="ghost-row"><div class="ghost-icon"></div><div class="ghost-bar" style="width:'+w+'px"></div></div>';
    }).join('');
    return '<div class="onb-card">'
      +'<div class="onb-header">'
      +'<span style="color:#4FC1FF;display:flex">'+SVG.sparkle+'</span>'
      +'<span class="onb-badge">Getting started</span>'
      +'<button class="onb-close" data-action="dismiss-onboarding">'+SVG.close+'</button>'
      +'</div>'
      +onbStep(1,'Select code','Highlight any lines in the editor.','done')
      +onbStep(2,'Right-click → Save Snippet','Or run Snipify: Save from the command palette.','active')
      +onbStep(3,'Give it a name & tags','Snippets sync privately via GitHub Gists.','todo')
      +'</div>'
      +'<div class="ghost-label">Your snippets will appear here</div>'
      +ghosts;
  }

  // ── SVG icons for welcome states ─────────────────────────────────────
  var GITHUB_SVG = '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>';
  var SPARKLE_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z"/></svg>';
  var SPIN_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>';

  function welcomeHtml(iconSvg, heading, body, buttons) {
    return '<div class="welcome-view">'
      +'<div class="welcome-icon">'+iconSvg+'</div>'
      +(heading ? '<div class="welcome-heading">'+esc(heading)+'</div>' : '')
      +'<div class="welcome-body">'+body+'</div>'
      +buttons.map(function(b) {
        return '<button class="welcome-btn '+b.cls+'" data-action="'+b.action+'">'+esc(b.label)+'</button>';
      }).join('')
      +'</div>';
  }

  var SKELETON_WIDTHS = [180, 140, 160, 120, 170, 130, 150];
  function loadingHtml() {
    var rows = SKELETON_WIDTHS.map(function(w, i) {
      return '<div class="skeleton-row" style="opacity:'+(0.9 - i*0.1)+'">'
        +'<div class="skeleton-icon"></div>'
        +'<div class="skeleton-bar" style="width:'+w+'px"></div>'
        +'</div>';
    }).join('');
    return '<div class="skeleton-wrap">'+rows
      +'<div class="skeleton-footer">'+SPIN_SVG+'<span>Syncing from GitHub…</span></div>'
      +'</div>';
  }

  // ── Main render ──────────────────────────────────────────────────────
  function render() {
    var el = document.getElementById('content');

    if (auth === 'signed-out') {
      el.innerHTML = welcomeHtml(
        GITHUB_SVG,
        null,
        'Sign in with GitHub to sync your snippets across every window — backed by private Gists.',
        [
          { label: 'Sign in with GitHub', cls: 'primary',   action: 'login' },
          { label: 'Use locally without syncing', cls: 'secondary', action: 'use-local' },
        ]
      );
      return;
    }
    if (auth === 'loading') {
      el.innerHTML = loadingHtml();
      return;
    }

    var all = filtered(snippets);

    if (!all.length && !filter) {
      el.innerHTML = showOnboarding ? onboardingHtml() : welcomeHtml(
        SPARKLE_SVG,
        'No snippets yet',
        'Select code anywhere in the editor, then run <a data-action=”saveSnippet”>Snipify: Save selection</a> to save it. Your snippets sync to a private Gist.',
        [{ label: 'Save selection as snippet', cls: 'primary', action: 'saveSnippet' }]
      );
      return;
    }
    if (!all.length) {
      el.innerHTML = '<div class=”welcome-view”><div class=”welcome-body”>No results for “'+esc(filter)+'”</div></div>';
      return;
    }
    if (filter) { el.innerHTML = all.map(rowHtml).join(''); return; }

    var pinned   = all.filter(function(s){ return s.pinned; });
    var unpinned = all.filter(function(s){ return !s.pinned; })
                      .slice().sort(function(a,b){ return b.updatedAt - a.updatedAt; });
    var mostUsed = all.filter(function(s){ return s.usageCount > 0; })
                      .sort(function(a,b){ return b.usageCount - a.usageCount; }).slice(0,5);

    var now = Date.now(), DAY = 86400000, WEEK = 7*DAY, MONTH = 30*DAY;
    var buckets = { today: [], week: [], month: [], earlier: [] };
    unpinned.forEach(function(s) {
      var age = now - s.updatedAt;
      if      (age < DAY)   buckets.today.push(s);
      else if (age < WEEK)  buckets.week.push(s);
      else if (age < MONTH) buckets.month.push(s);
      else                  buckets.earlier.push(s);
    });

    var html = '';
    if (pinned.length)          html += groupHtml('pinned',   'Pinned',     pinned,          false);
    if (mostUsed.length)        html += groupHtml('mostUsed', 'Most Used',  mostUsed,        false);
    if (buckets.today.length)   html += groupHtml('today',    'Today',      buckets.today,   false);
    if (buckets.week.length)    html += groupHtml('week',     'This Week',  buckets.week,    false);
    if (buckets.month.length)   html += groupHtml('month',    'This Month', buckets.month,   false);
    if (buckets.earlier.length) html += groupHtml('earlier',  'Earlier',    buckets.earlier, true);
    el.innerHTML = html;
  }

  // ── Hover card ───────────────────────────────────────────────────────
  var hoverCard      = document.getElementById('hover-card');
  var hcIcon         = document.getElementById('hc-icon');
  var hcTitle        = document.getElementById('hc-title');
  var hcTags         = document.getElementById('hc-tags');
  var hcCode         = document.getElementById('hc-code');
  var hcMeta         = document.getElementById('hc-meta');
  var hoverTimer     = null;
  var currentHoverId = null;

  function showHoverCard(s, row) {
    hcIcon.src  = iconSrc(s.language);
    hcTitle.textContent = s.title || 'Untitled';
    hcTags.textContent  = s.tags.length ? s.tags.map(function(t){return '#'+t;}).join(' ') : s.language;
    hcCode.textContent  = s.codePreview || '';
    hcMeta.textContent  = 'Updated ' + relTimeMs(s.updatedAt) + ' \xb7 ' + s.language;

    var rect = row.getBoundingClientRect();
    var spaceBelow = window.innerHeight - rect.bottom;
    hoverCard.style.display = 'block';
    var cardH = hoverCard.offsetHeight;
    hoverCard.style.display = 'none';

    if (spaceBelow >= cardH + 6 || spaceBelow >= rect.top) {
      hoverCard.style.top    = (rect.bottom + 4) + 'px';
      hoverCard.style.bottom = 'auto';
    } else {
      hoverCard.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
      hoverCard.style.top    = 'auto';
    }
    hoverCard.style.display = 'block';
  }

  var contentEl = document.getElementById('content');

  contentEl.addEventListener('mouseover', function(e) {
    var row = e.target.closest && e.target.closest('.snippet-row');
    if (!row) {
      clearTimeout(hoverTimer); currentHoverId = null;
      hoverCard.style.display = 'none'; return;
    }
    var id = row.dataset.id;
    if (id === currentHoverId) return;
    currentHoverId = id;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(function() {
      if (currentHoverId !== id) return;
      var s = snippets.find(function(x){ return x.id === id; });
      if (s) showHoverCard(s, row);
    }, 500);
  });

  contentEl.addEventListener('mouseleave', function() {
    clearTimeout(hoverTimer); currentHoverId = null;
    hoverCard.style.display = 'none';
  });

  // ── Click delegation (content + banner) ─────────────────────────────
  document.body.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-action]');
    if (btn) {
      var action = btn.dataset.action;
      if (action === 'dismiss-banner') {
        vscode.postMessage({ type: 'dismiss-banner' });
        return;
      }
      if (action === 'dismiss-onboarding') {
        vscode.postMessage({ type: 'dismiss-onboarding' });
        return;
      }
      vscode.postMessage(btn.dataset.id
        ? { type: action, id: btn.dataset.id }
        : { type: action });
      return;
    }
    var hdr = e.target.closest('[data-group]');
    if (hdr) {
      var gid = hdr.dataset.group;
      var grp = document.getElementById('grp-'+gid);
      if (grp) collapsed[gid] = grp.classList.toggle('collapsed');
      return;
    }
    var row = e.target.closest('.snippet-row');
    if (row) vscode.postMessage({ type: 'insert', id: row.dataset.id });
  });

  // ── Search ───────────────────────────────────────────────────────────
  var searchInput = document.getElementById('search-input');
  var clearBtn    = document.getElementById('clear-btn');

  searchInput.addEventListener('input', function() {
    filter = searchInput.value;
    clearBtn.classList.toggle('hidden', !filter);
    render();
  });

  clearBtn.addEventListener('click', function() {
    filter = ''; searchInput.value = '';
    clearBtn.classList.add('hidden');
    searchInput.focus(); render();
  });

  // ── Messages ─────────────────────────────────────────────────────────
  window.addEventListener('message', function(e) {
    var msg = e.data;
    if (msg.type === 'update') {
      auth          = msg.auth;
      snippets      = msg.snippets || [];
      errorState    = msg.error    || null;
      offlineState  = msg.offline  || null;
      showOnboarding = !!msg.showOnboarding;
      renderBanner();
      render();
    }
  });

  renderBanner();
  render();
})();
</script>
</body>
</html>`;
  }
}
