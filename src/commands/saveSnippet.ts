import * as vscode from 'vscode';
import { IAuthProvider } from '../auth/IAuthProvider';
import { ISnippetStorage } from '../storage/ISnippetStorage';
import { SnippetForm } from '../ui/SnippetForm';
import { detectLanguage } from '../utils/languageDetector';

export async function saveSnippetCommand(
  context: vscode.ExtensionContext,
  auth: IAuthProvider,
  storage: ISnippetStorage
): Promise<void> {
  const loggedIn = await auth.isLoggedIn();
  if (!loggedIn) {
    const action = await vscode.window.showWarningMessage(
      'Snipify: You need to log in first.',
      'Login'
    );
    if (action === 'Login') {
      await vscode.commands.executeCommand('snipify.login');
    }
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('Snipify: No active editor found.');
    return;
  }

  const selection = editor.selection;
  const code = editor.document.getText(selection.isEmpty ? undefined : selection);
  if (!code.trim()) {
    vscode.window.showWarningMessage('Snipify: No code selected.');
    return;
  }

  const language = detectLanguage(editor);

  SnippetForm.show(context, code, language, async (data) => {
    await storage.save({ ...data, provider: 'github' });
    vscode.window.showInformationMessage(`Snipify: "${data.title}" saved!`);
    await vscode.commands.executeCommand('snipify.refresh');
  });
}
