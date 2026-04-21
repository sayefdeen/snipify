import * as vscode from 'vscode';
import { Snippet } from '../models/Snippet';

export async function insertSnippetCommand(snippet: Snippet): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('Snipify: No active editor — open a file first.');
    return;
  }

  await editor.edit((editBuilder) => {
    for (const selection of editor.selections) {
      editBuilder.insert(selection.active, snippet.code);
    }
  });
}
