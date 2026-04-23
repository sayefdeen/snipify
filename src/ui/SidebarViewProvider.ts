import * as vscode from 'vscode';
import { Snippet } from '../models/Snippet';

export type AuthState = 'signed-out' | 'loading' | 'ready';

export type SidebarMessage =
  | { type: 'insert'; id: string }
  | { type: 'edit'; id: string }
  | { type: 'delete'; id: string }
  | { type: 'pin'; id: string }
  | { type: 'unpin'; id: string }
  | { type: 'copyLink'; id: string }
  | { type: 'refresh' }
  | { type: 'login' };

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
    this._view.webview.postMessage({ type: 'update', auth: this._auth, snippets: data });
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

.state-wrap{padding:24px 16px 8px;text-align:center;color:var(--vscode-descriptionForeground);font-size:12px;line-height:1.6}
.state-btn{display:inline-block;margin-top:10px;padding:4px 14px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;border-radius:2px;cursor:pointer;font-size:12px;font-family:var(--vscode-font-family)}
.state-btn:hover{background:var(--vscode-button-hoverBackground)}

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
    var countBadge = s.usageCount > 0
      ? '<span class="usage-count">'+s.usageCount+'</span>'
      : '';
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

  function render() {
    var el = document.getElementById('content');

    if (auth === 'signed-out') {
      el.innerHTML = '<div class="state-wrap">Sign in with GitHub to sync your snippets.'
        +'<br/><button class="state-btn" data-action="login">Login with GitHub</button></div>';
      return;
    }
    if (auth === 'loading') {
      el.innerHTML = '<div class="state-wrap">Loading snippets…</div>';
      return;
    }

    var all = filtered(snippets);

    if (!all.length && !filter) {
      el.innerHTML = '<div class="state-wrap">No snippets yet.<br/>Select code, right-click, and choose <b>Save Snippet</b>.</div>';
      return;
    }
    if (!all.length) {
      el.innerHTML = '<div class="state-wrap">No results for “'+esc(filter)+'”</div>';
      return;
    }
    if (filter) { el.innerHTML = all.map(rowHtml).join(''); return; }

    var pinned   = all.filter(function(s){ return s.pinned; });
    var unpinned = all.filter(function(s){ return !s.pinned; });
    var mostUsed = all.filter(function(s){ return s.usageCount > 0; })
                      .sort(function(a,b){ return b.usageCount - a.usageCount; }).slice(0,5);

    var now   = Date.now();
    var DAY   = 86400000;
    var WEEK  = 7  * DAY;
    var MONTH = 30 * DAY;
    var unpinned = all.filter(function(s){ return !s.pinned; })
                      .slice().sort(function(a,b){ return b.updatedAt - a.updatedAt; });
    var buckets = { today: [], week: [], month: [], earlier: [] };
    unpinned.forEach(function(s) {
      var age = now - s.updatedAt;
      if      (age < DAY)   buckets.today.push(s);
      else if (age < WEEK)  buckets.week.push(s);
      else if (age < MONTH) buckets.month.push(s);
      else                  buckets.earlier.push(s);
    });

    var html = '';
    if (pinned.length)          html += groupHtml('pinned',   'Pinned',      pinned,           false);
    if (mostUsed.length)        html += groupHtml('mostUsed', 'Most Used',   mostUsed,         false);
    if (buckets.today.length)   html += groupHtml('today',    'Today',       buckets.today,    false);
    if (buckets.week.length)    html += groupHtml('week',     'This Week',   buckets.week,     false);
    if (buckets.month.length)   html += groupHtml('month',    'This Month',  buckets.month,    false);
    if (buckets.earlier.length) html += groupHtml('earlier',  'Earlier',     buckets.earlier,  true);
    el.innerHTML = html;
  }

  var hoverCard    = document.getElementById('hover-card');
  var hcIcon       = document.getElementById('hc-icon');
  var hcTitle      = document.getElementById('hc-title');
  var hcTags       = document.getElementById('hc-tags');
  var hcCode       = document.getElementById('hc-code');
  var hcMeta       = document.getElementById('hc-meta');
  var hoverTimer   = null;
  var currentHoverId = null;

  function relTimeMs(ms) {
    var d = (Date.now() - ms) / 1000;
    if (d < 60) return 'just now';
    if (d < 3600) return Math.floor(d/60)+'m ago';
    if (d < 86400) return Math.floor(d/3600)+'h ago';
    if (d < 604800) return Math.floor(d/86400)+'d ago';
    return new Date(ms).toLocaleDateString();
  }

  function showHoverCard(s, row) {
    hcIcon.src   = iconSrc(s.language);
    hcTitle.textContent = s.title || 'Untitled';
    hcTags.textContent  = s.tags.length ? s.tags.map(function(t){return '#'+t;}).join(' ') : s.language;
    hcCode.textContent  = s.codePreview || '';
    hcMeta.textContent  = 'Updated ' + relTimeMs(s.updatedAt) + ' · ' + s.language;

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
      clearTimeout(hoverTimer);
      currentHoverId = null;
      hoverCard.style.display = 'none';
      return;
    }
    var id = row.dataset.id;
    if (id === currentHoverId) return;
    currentHoverId = id;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(function() {
      if (currentHoverId !== id) return;
      var s = snippets.find(function(x) { return x.id === id; });
      if (s) showHoverCard(s, row);
    }, 500);
  });

  contentEl.addEventListener('mouseleave', function() {
    clearTimeout(hoverTimer);
    currentHoverId = null;
    hoverCard.style.display = 'none';
  });

  document.getElementById('content').addEventListener('click', function(e) {
    var hdr = e.target.closest('[data-group]');
    if (hdr) {
      var gid = hdr.dataset.group;
      var grp = document.getElementById('grp-'+gid);
      if (grp) collapsed[gid] = grp.classList.toggle('collapsed');
      return;
    }
    var btn = e.target.closest('[data-action]');
    if (btn) {
      vscode.postMessage(btn.dataset.id
        ? { type: btn.dataset.action, id: btn.dataset.id }
        : { type: btn.dataset.action });
      return;
    }
    var row = e.target.closest('.snippet-row');
    if (row) vscode.postMessage({ type: 'insert', id: row.dataset.id });
  });

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

  window.addEventListener('message', function(e) {
    var msg = e.data;
    if (msg.type === 'update') {
      auth = msg.auth;
      snippets = msg.snippets || [];
      render();
    }
  });

  render();
})();
</script>
</body>
</html>`;
  }
}
