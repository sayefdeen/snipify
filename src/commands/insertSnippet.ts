import * as vscode from 'vscode';
import { Snippet } from '../models/Snippet';

export async function insertSnippetCommand(snippet: Snippet): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('Snipify: No active editor — open a file first.');
    return;
  }

  await editor.insertSnippet(
    new vscode.SnippetString(snippet.code),
    editor.selections.map((s) => s.active),
  );
}
