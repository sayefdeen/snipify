import * as vscode from 'vscode';
import { ProviderType } from './models/User';
import { AuthProviderFactory } from './auth/AuthProviderFactory';
import { StorageFactory } from './storage/StorageFactory';
import { SnippetTreeProvider } from './ui/SnippetTreeProvider';
import { loginCommand } from './commands/login';
import { saveSnippetCommand } from './commands/saveSnippet';
import { insertSnippetCommand } from './commands/insertSnippet';
import { deleteSnippetCommand } from './commands/deleteSnippet';
import { editSnippetCommand } from './commands/editSnippet';
import { SnippetTreeItem } from './ui/SnippetTreeProvider';

export function activate(context: vscode.ExtensionContext): void {
  const config = vscode.workspace.getConfiguration('snipify');
  const providerType = (config.get<string>('provider') ?? 'github') as ProviderType;

  const auth = AuthProviderFactory.create(providerType);
  const treeProvider = new SnippetTreeProvider();

  const treeView = vscode.window.createTreeView('snipify.snippetsView', {
    treeDataProvider: treeProvider,
  });

  const getStorage = async () => {
    const token = await auth.getToken();
    if (!token) {
      throw new Error('Not logged in');
    }
    return StorageFactory.create(providerType, token);
  };

  context.subscriptions.push(treeView);

  context.subscriptions.push(
    vscode.commands.registerCommand('snipify.login', () => loginCommand(auth))
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('snipify.logout', async () => {
      await auth.logout();
      treeProvider.refresh([]);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('snipify.saveSnippet', async () => {
      const storage = await getStorage();
      await saveSnippetCommand(context, auth, storage);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('snipify.insertSnippet', async (item: SnippetTreeItem) => {
      await insertSnippetCommand(item.snippet);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('snipify.deleteSnippet', async (item: SnippetTreeItem) => {
      const storage = await getStorage();
      await deleteSnippetCommand(item.snippet.id, storage);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('snipify.editSnippet', async (item: SnippetTreeItem) => {
      const storage = await getStorage();
      await editSnippetCommand(item.snippet.id, {}, storage);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('snipify.refresh', async () => {
      const storage = await getStorage();
      const snippets = await storage.getAll();
      treeProvider.refresh(snippets);
    })
  );
}

export function deactivate(): void {}
