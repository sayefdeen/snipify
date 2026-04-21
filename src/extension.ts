import * as vscode from 'vscode';
import { ProviderType } from './models/User';
import { AuthProviderFactory } from './auth/AuthProviderFactory';
import { StorageFactory } from './storage/StorageFactory';
import { SnippetTreeProvider, SnippetTreeItem } from './ui/SnippetTreeProvider';
import { loginCommand } from './commands/login';
import { saveSnippetCommand } from './commands/saveSnippet';
import { insertSnippetCommand } from './commands/insertSnippet';
import { deleteSnippetCommand } from './commands/deleteSnippet';
import { editSnippetCommand } from './commands/editSnippet';
import { SnippetQuickPick } from './ui/SnippetQuickPick';

export function activate(context: vscode.ExtensionContext): void {
  const config = vscode.workspace.getConfiguration('snipify');
  const providerType = (config.get<string>('provider') ?? 'github') as ProviderType;

  const auth = AuthProviderFactory.create(providerType, context.secrets);
  const treeProvider = new SnippetTreeProvider();

  const treeView = vscode.window.createTreeView('snipify.snippetsView', {
    treeDataProvider: treeProvider,
    showCollapseAll: false,
  });

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.command = 'snipify.login';
  statusBar.text = '$(account) Snipify';
  statusBar.tooltip = 'Click to log in with GitHub';
  statusBar.show();

  const refreshStatusBar = async (): Promise<void> => {
    const user = await auth.getUser();
    if (user) {
      statusBar.text = `$(account) Snipify: ${user.username}`;
      statusBar.tooltip = `Logged in as ${user.username}`;
    } else {
      statusBar.text = '$(account) Snipify';
      statusBar.tooltip = 'Click to log in with GitHub';
    }
  };

  const getStorage = async (): Promise<ReturnType<typeof StorageFactory.create>> => {
    const token = await auth.getToken();
    if (!token) {
      throw new Error('Not logged in. Run "Snipify: Login with GitHub" first.');
    }
    return StorageFactory.create(providerType, token);
  };

  const loadSnippets = async (): Promise<void> => {
    const loggedIn = await auth.isLoggedIn();
    if (!loggedIn) {
      return;
    }
    treeProvider.setLoading(true);
    try {
      const storage = await getStorage();
      const snippets = await storage.getAll();
      treeProvider.refresh(snippets);
    } catch {
      treeProvider.refresh([]);
    }
  };

  context.subscriptions.push(treeView, statusBar);

  context.subscriptions.push(
    vscode.commands.registerCommand('snipify.login', async () => {
      await loginCommand(auth);
      await refreshStatusBar();
      await loadSnippets();
      await vscode.commands.executeCommand('snipify.snippetsView.focus');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('snipify.logout', async () => {
      await auth.logout();
      treeProvider.refresh([]);
      await refreshStatusBar();
      vscode.window.showInformationMessage('Snipify: Logged out');
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
    vscode.commands.registerCommand('snipify.search', async () => {
      try {
        const storage = await getStorage();
        const snippets = await storage.getAll();
        const snippet = await SnippetQuickPick.show(snippets);
        if (snippet) {
          await insertSnippetCommand(snippet);
        }
      } catch (err) {
        vscode.window.showErrorMessage(`Snipify: ${(err as Error).message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('snipify.refresh', async () => {
      treeProvider.setLoading(true);
      try {
        const storage = await getStorage();
        const snippets = await storage.getAll();
        treeProvider.refresh(snippets);
      } catch (err) {
        treeProvider.refresh([]);
        vscode.window.showErrorMessage(`Snipify: ${(err as Error).message}`);
      }
    })
  );

  // On activation: restore status bar and load snippets if already logged in
  refreshStatusBar();
  loadSnippets();
}

export function deactivate(): void {}
