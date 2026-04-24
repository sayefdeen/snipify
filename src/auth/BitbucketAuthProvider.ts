import * as vscode from 'vscode';
import { IAuthProvider } from './IAuthProvider';
import { User } from '../models/User';

const EMAIL_KEY     = 'snipify.bitbucket.email';
const TOKEN_KEY     = 'snipify.bitbucket.apiToken';
const WORKSPACE_KEY = 'snipify.bitbucket.workspace';
const BB_API        = 'https://api.bitbucket.org/2.0';

interface BBUser {
  account_id: string;
  display_name: string;
  nickname: string;
}

export class BitbucketAuthProvider implements IAuthProvider {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  async login(): Promise<User> {
    // Show setup checklist before asking for credentials
    const proceed = await vscode.window.showInformationMessage(
      'Snipify — Bitbucket Setup',
      {
        modal: true,
        detail:
          'Before connecting, make sure you have:\n\n' +
          '1. A private Bitbucket repository named "snipify-snippets" in your workspace.\n' +
          '   Create it at: bitbucket.org → Repositories → Create repository\n\n' +
          '2. An Atlassian API token with these scopes:\n' +
          '   • read:user:bitbucket\n' +
          '   • read:repository:bitbucket\n' +
          '   • write:repository:bitbucket\n' +
          '   • delete:repository:bitbucket\n' +
          '   • admin:repository:bitbucket\n\n' +
          '   Create it at: id.atlassian.com/manage-profile/security/api-tokens',
      },
      'Continue',
      'Cancel'
    );
    if (proceed !== 'Continue') throw new Error('Login cancelled');

    const email = await vscode.window.showInputBox({
      title: 'Snipify — Bitbucket Login (1/3)',
      prompt: 'Atlassian account email',
      placeHolder: 'you@example.com',
      ignoreFocusOut: true,
      validateInput: (v) => (v.trim() ? null : 'Email is required'),
    });
    if (!email) throw new Error('Login cancelled');

    const apiToken = await vscode.window.showInputBox({
      title: 'Snipify — Bitbucket Login (2/3)',
      prompt: 'Atlassian API token (id.atlassian.com/manage-profile/security/api-tokens)',
      placeHolder: 'ATATT…',
      password: true,
      ignoreFocusOut: true,
      validateInput: (v) => (v.trim() ? null : 'API token is required'),
    });
    if (!apiToken) throw new Error('Login cancelled');

    const workspaceSlug = await vscode.window.showInputBox({
      title: 'Snipify — Bitbucket Login (3/3)',
      prompt: 'Workspace slug — the URL segment in bitbucket.org/{workspace}/snipify-snippets',
      placeHolder: 'your-workspace-slug',
      ignoreFocusOut: true,
      validateInput: (v) => (v.trim() ? null : 'Workspace slug is required'),
    });
    if (!workspaceSlug) throw new Error('Login cancelled');

    const credential = Buffer.from(`${email.trim()}:${apiToken.trim()}`).toString('base64');
    const res = await fetch(`${BB_API}/user`, {
      headers: { Authorization: `Basic ${credential}`, Accept: 'application/json' },
    });
    if (res.status === 401) {
      let detail = '';
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        detail = body?.error?.message ? ` (${body.error.message})` : '';
      } catch { /* ignore */ }
      throw new Error(
        `Invalid email or API token${detail}. Make sure you used your Atlassian account email and a valid API token.`
      );
    }
    if (res.status === 403) {
      let missing: string[] = [];
      try {
        const body = (await res.json()) as { error?: { detail?: { required?: string[]; granted?: string[] } } };
        const granted = body?.error?.detail?.granted ?? [];
        const required = body?.error?.detail?.required ?? [];
        missing = required.filter((s) => !granted.includes(s));
      } catch { /* ignore */ }
      const hint = missing.length
        ? ` Missing: ${missing.join(', ')}. Delete this token and create a new one with all required scopes.`
        : ' Delete this token and create a new one with all required scopes.';
      throw new Error(`Token is missing required Bitbucket scopes.${hint}`);
    }
    if (!res.ok) {
      let detail = '';
      try { detail = ` — ${await res.text()}`; } catch { /* ignore */ }
      throw new Error(`Bitbucket error: ${res.statusText}${detail}`);
    }

    const data = (await res.json()) as BBUser;

    // Verify the snipify-snippets repo exists in the given workspace
    const repoCheck = await fetch(
      `${BB_API}/repositories/${workspaceSlug.trim()}/snipify-snippets`,
      { headers: { Authorization: `Basic ${credential}`, Accept: 'application/json' } }
    );
    if (repoCheck.status === 404) {
      throw new Error(
        `Repository "snipify-snippets" not found in workspace "${workspaceSlug.trim()}". ` +
        `Create it at bitbucket.org/${workspaceSlug.trim()} → Repositories → Create repository, then log in again.`
      );
    }
    if (!repoCheck.ok) {
      throw new Error(
        `Could not access workspace "${workspaceSlug.trim()}": ${repoCheck.status} ${repoCheck.statusText}. ` +
        `Check the workspace slug and that your token has the required scopes.`
      );
    }

    await this.secrets.store(EMAIL_KEY,     email.trim());
    await this.secrets.store(TOKEN_KEY,     apiToken.trim());
    await this.secrets.store(WORKSPACE_KEY, workspaceSlug.trim());

    return { id: data.account_id, username: data.display_name, provider: 'bitbucket' };
  }

  async logout(): Promise<void> {
    await this.secrets.delete(EMAIL_KEY);
    await this.secrets.delete(TOKEN_KEY);
    await this.secrets.delete(WORKSPACE_KEY);
  }

  // Returns "workspace|email:apiToken" so BitbucketStorage can split them
  async getToken(): Promise<string | null> {
    const email     = await this.secrets.get(EMAIL_KEY);
    const token     = await this.secrets.get(TOKEN_KEY);
    const workspace = await this.secrets.get(WORKSPACE_KEY);
    if (!email || !token || !workspace) return null;
    return `${workspace}|${email}:${token}`;
  }

  async isLoggedIn(): Promise<boolean> {
    return (await this.getToken()) !== null;
  }

  async getUser(): Promise<User | null> {
    const token = await this.getToken();
    if (!token) return null;
    try {
      const pipeIdx    = token.indexOf('|');
      const credential = Buffer.from(token.substring(pipeIdx + 1)).toString('base64');
      const res = await fetch(`${BB_API}/user`, {
        headers: { Authorization: `Basic ${credential}`, Accept: 'application/json' },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as BBUser;
      return { id: data.account_id, username: data.display_name, provider: 'bitbucket' };
    } catch {
      return null;
    }
  }
}
