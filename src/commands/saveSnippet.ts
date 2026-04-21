import * as vscode from 'vscode';
import { IAuthProvider } from '../auth/IAuthProvider';
import { ISnippetStorage } from '../storage/ISnippetStorage';

export async function saveSnippetCommand(
  _context: vscode.ExtensionContext,
  _auth: IAuthProvider,
  _storage: ISnippetStorage
): Promise<void> {
  throw new Error('Not implemented yet — coming in Phase 4');
}
