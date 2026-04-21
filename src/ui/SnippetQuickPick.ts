import * as vscode from 'vscode';
import { Snippet } from '../models/Snippet';

interface SnippetQuickPickItem extends vscode.QuickPickItem {
  snippet: Snippet;
}

export class SnippetQuickPick {
  static async show(snippets: Snippet[]): Promise<Snippet | undefined> {
    if (snippets.length === 0) {
      vscode.window.showInformationMessage('Snipify: No snippets saved yet.');
      return undefined;
    }

    const items: SnippetQuickPickItem[] = snippets.map((s) => ({
      label: s.title,
      description: s.language,
      detail: s.tags.length ? `Tags: ${s.tags.join(', ')}` : undefined,
      snippet: s,
    }));

    const picked = await vscode.window.showQuickPick(items, {
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder: 'Search snippets by title, language, or tag…',
    });

    return picked?.snippet;
  }
}
