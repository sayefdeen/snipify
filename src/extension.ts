import * as vscode from 'vscode';
import { ProviderType } from './models/User';
import { Snippet } from './models/Snippet';
import { AuthProviderFactory } from './auth/AuthProviderFactory';
import { StorageFactory } from './storage/StorageFactory';
import { SnippetTreeProvider, SnippetNode } from './ui/SnippetTreeProvider';
import { loginCommand } from './commands/login';
import { saveSnippetCommand } from './commands/saveSnippet';
import { insertSnippetCommand } from './commands/insertSnippet';
import { deleteSnippetCommand } from './commands/deleteSnippet';
import { editSnippetCommand } from './commands/editSnippet';
import { SnippetQuickPick } from './ui/SnippetQuickPick';

const PINNED_KEY = 'snipify.pinnedIds';

function resolveSnippet(arg: Snippet | SnippetNode): Snippet {
  return 'kind' in arg ? arg.snippet : arg;
}

function setContext(key: string, value: string): void {
  vscode.commands.executeCommand('setContext', key, value);
}

export function activate(context: vscode.ExtensionContext): void {
  const config = vscode.workspace.getConfiguration('snipify');
  const providerType = (config.get<string>('provider') ?? 'github') as ProviderType;

  const auth = AuthProviderFactory.create(providerType, context.secrets);
  const treeProvider = new SnippetTreeProvider();

  const treeView = vscode.window.createTreeView('snipify.snippetsView', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
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

  const getPinnedIds = (): Set<string> =>
    new Set(context.globalState.get<string[]>(PINNED_KEY, []));

  const savePinnedIds = (ids: Set<string>): Thenable<void> =>
    context.globalState.update(PINNED_KEY, [...ids]);

  const applyPinned = (snippets: Snippet[]): Snippet[] => {
    const ids = getPinnedIds();
    return snippets.map((s) => ({ ...s, pinned: ids.has(s.id) }));
  };

  const loadSnippets = async (): Promise<void> => {
    const loggedIn = await auth.isLoggedIn();
    if (!loggedIn) {
      treeProvider.setAuth('signed-out');
      setContext('snipify:authState', 'signed-out');
      return;
    }
    treeProvider.setAuth('loading');
    setContext('snipify:authState', 'loading');
    try {
      const storage = await getStorage();
      const snippets = applyPinned(await storage.getAll());
      treeProvider.setSnippets(snippets);
      setContext('snipify:authState', snippets.length === 0 ? 'empty' : 'ready');
    } catch {
      treeProvider.setAuth('signed-out');
      setContext('snipify:authState', 'signed-out');
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
      treeProvider.setAuth('signed-out');
      setContext('snipify:authState', 'signed-out');
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
    vscode.commands.registerCommand('snipify.insertSnippet', async (arg: Snippet | SnippetNode) => {
      await insertSnippetCommand(resolveSnippet(arg));
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('snipify.deleteSnippet', async (arg: Snippet | SnippetNode) => {
      const snippet = resolveSnippet(arg);
      const storage = await getStorage();
      await deleteSnippetCommand(snippet.id, storage);
      await loadSnippets();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('snipify.editSnippet', async (arg: Snippet | SnippetNode) => {
      const snippet = resolveSnippet(arg);
      const storage = await getStorage();
      await editSnippetCommand(snippet.id, {}, storage);
      await loadSnippets();
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
    vscode.commands.registerCommand('snipify.pinSnippet', async (arg: Snippet | SnippetNode) => {
      const ids = getPinnedIds();
      ids.add(resolveSnippet(arg).id);
      await savePinnedIds(ids);
      await loadSnippets();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('snipify.unpinSnippet', async (arg: Snippet | SnippetNode) => {
      const ids = getPinnedIds();
      ids.delete(resolveSnippet(arg).id);
      await savePinnedIds(ids);
      await loadSnippets();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('snipify.filterSnippets', async () => {
      const query = await vscode.window.showInputBox({
        placeHolder: 'Filter by title, language, or tag…',
        prompt: 'Leave empty to clear filter',
      });
      if (query === undefined) return;
      treeProvider.setFilter(query);
      setContext('snipify:filterActive', query.trim().length > 0 ? 'true' : '');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('snipify.clearFilter', () => {
      treeProvider.setFilter('');
      setContext('snipify:filterActive', '');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('snipify.refresh', async () => {
      treeProvider.setAuth('loading');
      setContext('snipify:authState', 'loading');
      try {
        const storage = await getStorage();
        const snippets = await storage.getAll();
        treeProvider.setSnippets(snippets);
        setContext('snipify:authState', snippets.length === 0 ? 'empty' : 'ready');
      } catch (err) {
        treeProvider.setAuth('signed-out');
        setContext('snipify:authState', 'signed-out');
        vscode.window.showErrorMessage(`Snipify: ${(err as Error).message}`);
      }
    })
  );

  refreshStatusBar();
  loadSnippets();
}

export function deactivate(): void {}
