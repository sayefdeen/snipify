import * as vscode from 'vscode';

const TOKEN_KEY = 'snipify.authToken';

export async function storeToken(secrets: vscode.SecretStorage, token: string): Promise<void> {
  await secrets.store(TOKEN_KEY, token);
}

export async function getToken(secrets: vscode.SecretStorage): Promise<string | null> {
  return (await secrets.get(TOKEN_KEY)) ?? null;
}

export async function deleteToken(secrets: vscode.SecretStorage): Promise<void> {
  await secrets.delete(TOKEN_KEY);
}
