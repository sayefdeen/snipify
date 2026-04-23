import * as vscode from 'vscode';
import { ProviderType } from './models/User';
import { Snippet } from './models/Snippet';
import { AuthProviderFactory } from './auth/AuthProviderFactory';
import { StorageFactory } from './storage/StorageFactory';
import { SidebarViewProvider } from './ui/SidebarViewProvider';
import { classifyError } from './utils/classifyError';
import { loginCommand } from './commands/login';
import { saveSnippetCommand } from './commands/saveSnippet';
import { SnippetForm } from './ui/SnippetForm';
import { insertSnippetCommand } from './commands/insertSnippet';
import { deleteSnippetCommand } from './commands/deleteSnippet';
import { editSnippetCommand } from './commands/editSnippet';
import { SnippetQuickPick } from './ui/SnippetQuickPick';
import { exportSnippetsCommand } from './commands/exportSnippets';
import { importSnippetsCommand } from './commands/importSnippets';

const PINNED_KEY     = 'snipify.pinnedIds';
const USAGE_KEY      = 'snipify.usageCounts';
const ONBOARDING_KEY = 'snipify.onboardingDone';
const CACHE_FILE     = 'snippets-cache.json';

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
  let _busy = false;

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

  const getUsageCounts = (): Record<string, number> =>
    context.globalState.get<Record<string, number>>(USAGE_KEY, {});

  const cacheUri = vscode.Uri.joinPath(context.globalStorageUri, CACHE_FILE);

  const writeCache = async (snippets: Snippet[]): Promise<void> => {
    try {
      await vscode.workspace.fs.createDirectory(context.globalStorageUri);
      const payload = JSON.stringify(snippets.map((s) => ({ ...s, createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString() })));
      await vscode.workspace.fs.writeFile(cacheUri, Buffer.from(payload, 'utf8'));
    } catch {
      // non-fatal — cache write failures are silent
    }
  };

  const readCache = async (): Promise<Snippet[]> => {
    try {
      const raw = await vscode.workspace.fs.readFile(cacheUri);
      const parsed = JSON.parse(Buffer.from(raw).toString('utf8')) as Array<Snippet & { createdAt: string; updatedAt: string }>;
      return parsed.map((s) => ({ ...s, createdAt: new Date(s.createdAt), updatedAt: new Date(s.updatedAt) }));
    } catch {
      return [];
    }
  };

  const incrementUsage = (id: string): Thenable<void> => {
    const counts = getUsageCounts();
    counts[id] = (counts[id] ?? 0) + 1;
    return context.globalState.update(USAGE_KEY, counts);
  };



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
      sidebar.clearError();
      sidebar.clearOffline();
      const onboardingDone = context.globalState.get<boolean>(ONBOARDING_KEY, false);
      sidebar.setOnboarding(!onboardingDone && currentSnippets.length === 0);
      sidebar.setSnippets(currentSnippets, getPinnedIds(), getUsageCounts());
      await writeCache(currentSnippets);
    } catch (err) {
      const { kind, resetAt } = classifyError(err);
      sidebar.setError(kind, resetAt);
      const cached = currentSnippets.length > 0 ? currentSnippets : await readCache();
      if (cached.length > 0) {
        currentSnippets = cached;
        sidebar.setOffline(Date.now());
        sidebar.setSnippets(cached, getPinnedIds(), getUsageCounts());
      } else {
        sidebar.setAuth('ready');
      }
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
          if (s) {
            await insertSnippetCommand(s);
            await incrementUsage(s.id);
            sidebar.setSnippets(currentSnippets, getPinnedIds(), getUsageCounts());
          }
          break;
        }

        case 'edit': {
          if (_busy) break;
          const s = currentSnippets.find((x) => x.id === msg.id);
          if (s) {
            _busy = true;
            try {
              const storage = await getStorage();
              await editSnippetCommand(s.id, {}, storage);
              await loadSnippets();
            } catch (err) {
              vscode.window.showErrorMessage(`Snipify: ${(err as Error).message}`);
            } finally {
              _busy = false;
            }
          }
          break;
        }

        case 'delete': {
          if (_busy) break;
          const s = currentSnippets.find((x) => x.id === msg.id);
          if (s) {
            _busy = true;
            try {
              const storage = await getStorage();
              await deleteSnippetCommand(s.id, storage);
              await loadSnippets();
            } catch (err) {
              vscode.window.showErrorMessage(`Snipify: ${(err as Error).message}`);
            } finally {
              _busy = false;
            }
          }
          break;
        }

        case 'pin': {
          const ids = getPinnedIds();
          ids.add(msg.id);
          await savePinnedIds(ids);
          sidebar.setSnippets(currentSnippets, ids, getUsageCounts());
          break;
        }

        case 'unpin': {
          const ids = getPinnedIds();
          ids.delete(msg.id);
          await savePinnedIds(ids);
          sidebar.setSnippets(currentSnippets, ids, getUsageCounts());
          break;
        }

        case 'copyLink': {
          const s = currentSnippets.find((x) => x.id === msg.id);
          if (s?.url) {
            await vscode.env.clipboard.writeText(s.url);
            vscode.window.showInformationMessage(`Snipify: Gist URL copied to clipboard`);
          }
          break;
        }

        case 'saveSnippet':
          await vscode.commands.executeCommand('snipify.saveSnippet');
          break;

        case 'dismiss-banner':
          sidebar.clearError();
          sidebar.clearOffline();
          break;

        case 'dismiss-onboarding':
          await context.globalState.update(ONBOARDING_KEY, true);
          sidebar.setOnboarding(false);
          break;
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
      if (_busy) return;
      _busy = true;
      try {
        const storage = await getStorage();
        await saveSnippetCommand(context, auth, storage);
        await loadSnippets();
      } catch (err) {
        vscode.window.showErrorMessage(`Snipify: ${(err as Error).message}`);
      } finally {
        _busy = false;
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
    vscode.commands.registerCommand('snipify.snippetMenu', async () => {
      const pick = await vscode.window.showQuickPick(
        [
          { label: '$(export) Export Snippets', action: 'export' },
          { label: '$(import) Import Snippets', action: 'import' },
        ],
        { placeHolder: 'Snipify actions' }
      );
      if (pick?.action === 'export') {
        await exportSnippetsCommand(currentSnippets);
      } else if (pick?.action === 'import') {
        try {
          const storage = await getStorage();
          const count = await importSnippetsCommand(storage, providerType);
          if (count > 0) {
            vscode.window.showInformationMessage(`Snipify: Imported ${count} snippet${count === 1 ? '' : 's'}.`);
            await loadSnippets();
          }
        } catch (err) {
          vscode.window.showErrorMessage(`Snipify: ${(err as Error).message}`);
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('snipify.exportSnippets', async () => {
      await exportSnippetsCommand(currentSnippets);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('snipify.importSnippets', async () => {
      try {
        const storage = await getStorage();
        const count = await importSnippetsCommand(storage, providerType);
        if (count > 0) {
          vscode.window.showInformationMessage(`Snipify: Imported ${count} snippet${count === 1 ? '' : 's'}.`);
          await loadSnippets();
        }
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

  // Provider migration warning — prompt before the switch takes effect
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (!e.affectsConfiguration('snipify.provider')) return;
      const newProvider = vscode.workspace.getConfiguration('snipify').get<string>('provider') ?? 'github';
      if (newProvider === providerType) return;
      const count = currentSnippets.length;
      const countLabel = count > 0 ? `Your ${count} current snippet${count === 1 ? '' : 's'} will stay on the old provider — they won't copy over.` : '';
      const choice = await vscode.window.showWarningMessage(
        `Switch snippet provider to ${newProvider}?`,
        { modal: true, detail: `${countLabel} Snipify will show an empty list until you save something new, or switch back.\n\nTip: export your snippets first so you can re-import later.` },
        'Export first…',
        'Switch anyway',
        'Cancel'
      );
      if (choice === 'Export first…') {
        await exportSnippetsCommand(currentSnippets);
      } else if (choice !== 'Switch anyway') {
        // Revert the setting change
        await vscode.workspace.getConfiguration('snipify').update('provider', providerType, vscode.ConfigurationTarget.Global);
      }
    })
  );

  refreshStatusBar();
  loadSnippets();
}

export function deactivate(): void {}
