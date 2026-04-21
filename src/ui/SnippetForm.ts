import * as vscode from 'vscode';
import { Snippet } from '../models/Snippet';

interface FormSubmitMessage {
  command: 'submit';
  title: string;
  tags: string;
  language: string;
}

interface FormCancelMessage {
  command: 'cancel';
}

type WebviewMessage = FormSubmitMessage | FormCancelMessage;

export class SnippetForm {
  static show(
    context: vscode.ExtensionContext,
    code: string,
    language: string,
    onSubmit: (data: Pick<Snippet, 'title' | 'tags' | 'language' | 'code'>) => Promise<void>
  ): void {
    const panel = vscode.window.createWebviewPanel(
      'snipifyForm',
      'Save Snippet',
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: false }
    );

    panel.webview.html = SnippetForm.getHtml(code, language);

    panel.webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        if (message.command === 'cancel') {
          panel.dispose();
          return;
        }

        if (message.command === 'submit') {
          const tags = message.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);

          try {
            await onSubmit({
              title: message.title,
              tags,
              language: message.language,
              code,
            });
            panel.dispose();
          } catch (err) {
            vscode.window.showErrorMessage(`Snipify: Failed to save — ${(err as Error).message}`);
          }
        }
      },
      undefined,
      context.subscriptions
    );
  }

  private static getHtml(code: string, language: string): string {
    const escapedCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Save Snippet</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 20px;
      max-width: 600px;
    }
    label {
      display: block;
      margin-bottom: 4px;
      font-weight: bold;
      color: var(--vscode-foreground);
    }
    input {
      width: 100%;
      padding: 6px 8px;
      margin-bottom: 16px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, #555);
      border-radius: 2px;
      font-size: var(--vscode-font-size);
      box-sizing: border-box;
    }
    input:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }
    pre {
      background: var(--vscode-textBlockQuote-background, #1e1e1e);
      border: 1px solid var(--vscode-textBlockQuote-border, #444);
      border-radius: 4px;
      padding: 12px;
      overflow-x: auto;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: var(--vscode-editor-font-size, 13px);
      max-height: 200px;
      overflow-y: auto;
      margin-bottom: 20px;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .actions {
      display: flex;
      gap: 8px;
    }
    button {
      padding: 6px 16px;
      border: none;
      border-radius: 2px;
      cursor: pointer;
      font-size: var(--vscode-font-size);
    }
    .btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .btn-primary:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .btn-secondary {
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #fff);
    }
    h2 {
      margin-top: 0;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <h2>Save Snippet</h2>

  <label for="title">Title *</label>
  <input id="title" type="text" placeholder="e.g. useDebounce hook" autofocus />

  <label for="tags">Tags <span style="font-weight:normal">(comma-separated)</span></label>
  <input id="tags" type="text" placeholder="e.g. react, hooks, typescript" />

  <label for="language">Language</label>
  <input id="language" type="text" value="${language}" />

  <label>Preview</label>
  <pre>${escapedCode}</pre>

  <div class="actions">
    <button class="btn-primary" onclick="submit()">Save</button>
    <button class="btn-secondary" onclick="cancel()">Cancel</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function submit() {
      const title = document.getElementById('title').value.trim();
      if (!title) {
        document.getElementById('title').focus();
        return;
      }
      vscode.postMessage({
        command: 'submit',
        title,
        tags: document.getElementById('tags').value,
        language: document.getElementById('language').value.trim() || '${language}',
      });
    }

    function cancel() {
      vscode.postMessage({ command: 'cancel' });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
      if (e.key === 'Escape') cancel();
    });
  </script>
</body>
</html>`;
  }
}
