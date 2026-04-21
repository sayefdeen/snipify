import * as vscode from 'vscode';
import { ISnippetStorage } from '../storage/ISnippetStorage';
import { Snippet } from '../models/Snippet';

export async function editSnippetCommand(
  id: string,
  _updates: Partial<Pick<Snippet, 'title' | 'tags'>>,
  storage: ISnippetStorage
): Promise<void> {
  const current = await storage.getById(id);
  if (!current) {
    vscode.window.showErrorMessage('Snipify: Snippet not found.');
    return;
  }

  const title = await vscode.window.showInputBox({
    prompt: 'Snippet title',
    value: current.title,
    validateInput: (v) => (v.trim() ? null : 'Title cannot be empty'),
  });
  if (title === undefined) {
    return; // cancelled
  }

  const tags = await vscode.window.showInputBox({
    prompt: 'Tags (comma-separated)',
    value: current.tags.join(', '),
  });
  if (tags === undefined) {
    return; // cancelled
  }

  const parsedTags = tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  await storage.update(id, { title: title.trim(), tags: parsedTags });
  vscode.window.showInformationMessage('Snipify: Snippet updated.');
  await vscode.commands.executeCommand('snipify.refresh');
}
