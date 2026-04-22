import * as vscode from 'vscode';
import { Snippet } from '../models/Snippet';

type ExportFormat = 'vscode' | 'json';

interface VSCodeSnippetEntry {
  prefix: string;
  body: string[];
  description: string;
  scope: string;
}

function toVSCodeSnippets(snippets: Snippet[]): Record<string, VSCodeSnippetEntry> {
  const out: Record<string, VSCodeSnippetEntry> = {};
  for (const s of snippets) {
    out[s.title] = {
      prefix: s.title.toLowerCase().replace(/\s+/g, '-'),
      body: s.code.split('\n'),
      description: s.tags.length ? s.tags.map((t) => `#${t}`).join(' ') : s.language,
      scope: s.language,
    };
  }
  return out;
}

export async function exportSnippetsCommand(snippets: Snippet[]): Promise<void> {
  if (snippets.length === 0) {
    vscode.window.showWarningMessage('Snipify: No snippets to export.');
    return;
  }

  const format = await vscode.window.showQuickPick(
    [
      { label: 'VS Code Snippets', description: '.code-snippets — importable directly into VS Code', value: 'vscode' as ExportFormat },
      { label: 'JSON',             description: '.json — full snippet data for backup or migration',  value: 'json'   as ExportFormat },
    ],
    { placeHolder: 'Choose export format' }
  );
  if (!format) return;

  const isVSCode = format.value === 'vscode';
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(`snipify-export${isVSCode ? '.code-snippets' : '.json'}`),
    filters: isVSCode
      ? { 'VS Code Snippets': ['code-snippets'] }
      : { 'JSON': ['json'] },
  });
  if (!uri) return;

  const content = isVSCode
    ? JSON.stringify(toVSCodeSnippets(snippets), null, 2)
    : JSON.stringify(snippets.map((s) => ({
        title: s.title,
        language: s.language,
        tags: s.tags,
        code: s.code,
        url: s.url,
      })), null, 2);

  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
  vscode.window.showInformationMessage(
    `Snipify: Exported ${snippets.length} snippet${snippets.length === 1 ? '' : 's'} to ${uri.fsPath}`
  );
}
