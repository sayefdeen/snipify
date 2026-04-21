import * as vscode from 'vscode';

export class SearchViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'snipify.searchView';

  private _view?: vscode.WebviewView;
  private _onSearch = new vscode.EventEmitter<string>();
  readonly onSearch = this._onSearch.event;

  resolveWebviewView(view: vscode.WebviewView): void {
    this._view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this._html();
    view.webview.onDidReceiveMessage((msg: { query: string }) => {
      this._onSearch.fire(msg.query ?? '');
    });
  }

  clear(): void {
    this._view?.webview.postMessage({ type: 'clear' });
  }

  private _html(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { padding: 4px 8px 6px; background: transparent; }
  .wrap {
    display: flex;
    align-items: center;
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 2px;
    padding: 0 6px;
    gap: 4px;
  }
  .wrap:focus-within {
    border-color: var(--vscode-focusBorder);
    outline: none;
  }
  .icon {
    color: var(--vscode-input-placeholderForeground);
    font-size: 14px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }
  input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--vscode-input-foreground);
    font-size: 13px;
    font-family: var(--vscode-font-family);
    height: 24px;
  }
  input::placeholder { color: var(--vscode-input-placeholderForeground); }
  .clear {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--vscode-input-placeholderForeground);
    display: none;
    align-items: center;
    padding: 0;
    font-size: 14px;
  }
  .clear:hover { color: var(--vscode-input-foreground); }
  .clear.visible { display: flex; }
</style>
</head>
<body>
<div class="wrap">
  <span class="icon">
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.156a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z"/>
    </svg>
  </span>
  <input id="q" type="text" placeholder="Search snippets…" autocomplete="off" spellcheck="false"/>
  <button class="clear" id="clr" title="Clear">
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
    </svg>
  </button>
</div>
<script>
  const vscode = acquireVsCodeApi();
  const input = document.getElementById('q');
  const clr = document.getElementById('clr');

  input.addEventListener('input', () => {
    clr.classList.toggle('visible', input.value.length > 0);
    vscode.postMessage({ query: input.value });
  });

  clr.addEventListener('click', () => {
    input.value = '';
    clr.classList.remove('visible');
    vscode.postMessage({ query: '' });
    input.focus();
  });

  window.addEventListener('message', e => {
    if (e.data.type === 'clear') {
      input.value = '';
      clr.classList.remove('visible');
    }
  });
</script>
</body>
</html>`;
  }
}
