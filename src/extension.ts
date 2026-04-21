import * as vscode from 'vscode';
import { ProviderType } from './models/User';
import { Snippet } from './models/Snippet';
import { AuthProviderFactory } from './auth/AuthProviderFactory';
import { StorageFactory } from './storage/StorageFactory';
import { SidebarViewProvider } from './ui/SidebarViewProvider';
import { loginCommand } from './commands/login';
import { saveSnippetCommand } from './commands/saveSnippet';
import { SnippetForm } from './ui/SnippetForm';
import { insertSnippetCommand } from './commands/insertSnippet';
import { deleteSnippetCommand } from './commands/deleteSnippet';
import { editSnippetCommand } from './commands/editSnippet';
import { SnippetQuickPick } from './ui/SnippetQuickPick';

const PINNED_KEY = 'snipify.pinnedIds';

export function activate(context: vscode.ExtensionContext): void {
  const config = vscode.workspace.getConfiguration('snipify');
  const providerType = (config.get<string>('provider') ?? 'github') as ProviderType;

  const auth = AuthProviderFactory.create(providerType, context.secrets);
  const sidebar = new SidebarViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarViewProvider.viewId, sidebar)
  );

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.command = 'snipify.login';
  statusBar.text = '$(account) Snipify';
  statusBar.tooltip = 'Click to log in with GitHub';
  statusBar.show();
  context.subscriptions.push(statusBar);

  let currentSnippets: Snippet[] = [];

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
    if (!token) throw new Error('Not logged in. Run "Snipify: Login with GitHub" first.');
    return StorageFactory.create(providerType, token);
  };

  const getPinnedIds = (): Set<string> =>
    new Set(context.globalState.get<string[]>(PINNED_KEY, []));

  const savePinnedIds = (ids: Set<string>): Thenable<void> =>
    context.globalState.update(PINNED_KEY, [...ids]);

  const loadSnippets = async (): Promise<void> => {
    const loggedIn = await auth.isLoggedIn();
    if (!loggedIn) {
      sidebar.setAuth('signed-out');
      return;
    }
    sidebar.setAuth('loading');
    try {
      const storage = await getStorage();
      currentSnippets = await storage.getAll();
      sidebar.setSnippets(currentSnippets, getPinnedIds());
    } catch {
      sidebar.setAuth('signed-out');
    }
  };

  context.subscriptions.push(
    sidebar.onMessage(async (msg) => {
      switch (msg.type) {
        case 'login':
          await loginCommand(auth);
          await refreshStatusBar();
          await loadSnippets();
          break;

        case 'refresh':
          await loadSnippets();
          break;

        case 'insert': {
          const s = currentSnippets.find((x) => x.id === msg.id);
          if (s) await insertSnippetCommand(s);
          break;
        }

        case 'edit': {
          const s = currentSnippets.find((x) => x.id === msg.id);
          if (s) {
            try {
              const storage = await getStorage();
              await editSnippetCommand(s.id, {}, storage);
              await loadSnippets();
            } catch (err) {
              vscode.window.showErrorMessage(`Snipify: ${(err as Error).message}`);
            }
          }
          break;
        }

        case 'delete': {
          const s = currentSnippets.find((x) => x.id === msg.id);
          if (s) {
            try {
              const storage = await getStorage();
              await deleteSnippetCommand(s.id, storage);
              await loadSnippets();
            } catch (err) {
              vscode.window.showErrorMessage(`Snipify: ${(err as Error).message}`);
            }
          }
          break;
        }

        case 'pin': {
          const ids = getPinnedIds();
          ids.add(msg.id);
          await savePinnedIds(ids);
          sidebar.setSnippets(currentSnippets, ids);
          break;
        }

        case 'unpin': {
          const ids = getPinnedIds();
          ids.delete(msg.id);
          await savePinnedIds(ids);
          sidebar.setSnippets(currentSnippets, ids);
          break;
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('snipify.login', async () => {
      await loginCommand(auth);
      await refreshStatusBar();
      await loadSnippets();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('snipify.logout', async () => {
      await auth.logout();
      currentSnippets = [];
      sidebar.setAuth('signed-out');
      await refreshStatusBar();
      vscode.window.showInformationMessage('Snipify: Logged out');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('snipify.saveSnippet', async () => {
      try {
        const storage = await getStorage();
        await saveSnippetCommand(context, auth, storage);
        await loadSnippets();
      } catch (err) {
        vscode.window.showErrorMessage(`Snipify: ${(err as Error).message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('snipify.search', async () => {
      try {
        const snippet = await SnippetQuickPick.show(currentSnippets);
        if (snippet) await insertSnippetCommand(snippet);
      } catch (err) {
        vscode.window.showErrorMessage(`Snipify: ${(err as Error).message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('snipify.newSnippet', async () => {
      const loggedIn = await auth.isLoggedIn();
      if (!loggedIn) {
        const action = await vscode.window.showWarningMessage('Snipify: You need to log in first.', 'Login');
        if (action === 'Login') await vscode.commands.executeCommand('snipify.login');
        return;
      }
      try {
        const storage = await getStorage();
        SnippetForm.showNew(context, async (data) => {
          await storage.save({ ...data, provider: 'github' });
          vscode.window.showInformationMessage(`Snipify: "${data.title}" saved!`);
          await loadSnippets();
        });
      } catch (err) {
        vscode.window.showErrorMessage(`Snipify: ${(err as Error).message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('snipify.refresh', async () => {
      await loadSnippets();
    })
  );

  refreshStatusBar();
  loadSnippets();
}

export function deactivate(): void {}
