import * as vscode from 'vscode';
import { IAuthProvider } from '../auth/IAuthProvider';

export async function loginCommand(auth: IAuthProvider): Promise<void> {
  try {
    const user = await auth.login();
    vscode.window.showInformationMessage(`Snipify: Logged in as ${user.username}`);
  } catch (err) {
    vscode.window.showErrorMessage(`Snipify: Login failed — ${(err as Error).message}`);
  }
}
