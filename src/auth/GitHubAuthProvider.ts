import * as vscode from 'vscode';
import { IAuthProvider } from './IAuthProvider';
import { User } from '../models/User';
import { storeToken, getToken, deleteToken } from '../utils/tokenStorage';

export class GitHubAuthProvider implements IAuthProvider {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  async login(): Promise<User> {
    const session = await vscode.authentication.getSession('github', ['gist', 'read:user'], {
      createIfNone: true,
    });
    await storeToken(this.secrets, session.accessToken);
    return {
      id: session.account.id,
      username: session.account.label,
      provider: 'github',
    };
  }

  async logout(): Promise<void> {
    await deleteToken(this.secrets);
  }

  async getToken(): Promise<string | null> {
    return getToken(this.secrets);
  }

  async isLoggedIn(): Promise<boolean> {
    const token = await getToken(this.secrets);
    return token !== null;
  }

  async getUser(): Promise<User | null> {
    const token = await getToken(this.secrets);
    if (!token) return null;
    const session = await vscode.authentication.getSession('github', ['gist', 'read:user'], {
      createIfNone: false,
    });
    if (!session) return null;
    return {
      id: session.account.id,
      username: session.account.label,
      provider: 'github',
    };
  }
}
