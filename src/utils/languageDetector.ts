import * as vscode from 'vscode';

export function detectLanguage(editor: vscode.TextEditor): string {
  return editor.document.languageId;
}
