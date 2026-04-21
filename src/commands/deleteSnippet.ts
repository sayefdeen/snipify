import * as vscode from 'vscode';
import { ISnippetStorage } from '../storage/ISnippetStorage';

export async function deleteSnippetCommand(id: string, storage: ISnippetStorage): Promise<void> {
  const confirm = await vscode.window.showWarningMessage(
    'Delete this snippet? This cannot be undone.',
    { modal: true },
    'Delete'
  );
  if (confirm !== 'Delete') {
    return;
  }

  await storage.delete(id);
  vscode.window.showInformationMessage('Snipify: Snippet deleted.');
  await vscode.commands.executeCommand('snipify.refresh');
}
