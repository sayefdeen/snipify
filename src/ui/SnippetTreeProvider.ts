import * as vscode from 'vscode';
import { Snippet } from '../models/Snippet';

export type GroupMode = 'recency' | 'language' | 'sections';
export type AuthState = 'signed-out' | 'loading' | 'ready';

export type SnippetNode = { kind: 'snippet'; snippet: Snippet };
type GroupNode = {
  kind: 'group';
  id: string;
  label: string;
  icon: string;
  children: SnippetNode[];
  collapsed?: boolean;
};
type Node = SnippetNode | GroupNode;

const LANG_ICON: Readonly<Record<string, { icon: string; color: string }>> = {
  typescript: { icon: 'symbol-class', color: 'charts.blue' },
  javascript: { icon: 'symbol-method', color: 'charts.yellow' },
  typescriptreact: { icon: 'symbol-class', color: 'charts.blue' },
  javascriptreact: { icon: 'symbol-method', color: 'charts.yellow' },
  python: { icon: 'symbol-namespace', color: 'charts.green' },
  go: { icon: 'symbol-method', color: 'charts.blue' },
  rust: { icon: 'symbol-method', color: 'charts.orange' },
  html: { icon: 'code', color: 'charts.orange' },
  css: { icon: 'symbol-color', color: 'charts.purple' },
  scss: { icon: 'symbol-color', color: 'charts.purple' },
  json: { icon: 'json', color: 'charts.yellow' },
  markdown: { icon: 'markdown', color: 'charts.foreground' },
  shellscript: { icon: 'terminal', color: 'charts.foreground' },
  sql: { icon: 'symbol-property', color: 'charts.purple' },
  yaml: { icon: 'symbol-key', color: 'charts.foreground' },
};

const SVG_LANGS = new Set([
  'typescript', 'javascript', 'typescriptreact', 'javascriptreact',
  'python', 'html', 'css', 'scss', 'go', 'rust',
  'json', 'markdown', 'shellscript', 'sql', 'yaml', 'plaintext',
]);

function iconFor(lang: string, extensionUri: vscode.Uri): vscode.Uri | vscode.ThemeIcon {
  const key = lang.toLowerCase();
  if (SVG_LANGS.has(key)) {
    return vscode.Uri.joinPath(extensionUri, 'assets', 'icons', `${key}.svg`);
  }
  const meta = LANG_ICON[key] ?? { icon: 'symbol-file', color: 'charts.foreground' };
  return new vscode.ThemeIcon(meta.icon, new vscode.ThemeColor(meta.color));
}

function relTime(date: Date): string {
  const d = (Date.now() - date.getTime()) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  if (d < 604800) return `${Math.floor(d / 86400)}d ago`;
  return date.toLocaleDateString();
}

function escapeMd(s: string): string {
  return s.replace(/[\\`*_{}[\]()#+\-.!]/g, (c) => '\\' + c);
}

function buildTooltip(s: Snippet): vscode.MarkdownString {
  const md = new vscode.MarkdownString(undefined, true);
  md.isTrusted = true;
  md.supportThemeIcons = true;
  const iconName = LANG_ICON[s.language.toLowerCase()]?.icon ?? 'symbol-file';
  md.appendMarkdown(`**${escapeMd(s.title)}** &nbsp;$(${iconName}) ${s.language}\n\n`);
  if (s.tags.length) {
    md.appendMarkdown(s.tags.map((t) => `$(tag) ${escapeMd(t)}`).join(' · ') + '\n\n');
  }
  md.appendCodeblock(s.code.split('\n').slice(0, 12).join('\n'), s.language);
  md.appendMarkdown(`\n_Updated ${relTime(s.updatedAt)} · ${s.provider}_`);
  return md;
}

function snippetItem(s: Snippet, extensionUri: vscode.Uri): vscode.TreeItem {
  const item = new vscode.TreeItem(s.title || 'Untitled', vscode.TreeItemCollapsibleState.None);
  item.iconPath = iconFor(s.language, extensionUri);
  const tagStr = s.tags.length
    ? s.tags
        .slice(0, 3)
        .map((t) => `#${t}`)
        .join(' ')
    : '';
  item.description = tagStr || s.language;
  item.contextValue = s.pinned ? 'snippet.pinned' : 'snippet';
  item.tooltip = buildTooltip(s);
  item.command = { command: 'snipify.insertSnippet', title: 'Insert snippet', arguments: [s] };
  item.accessibilityInformation = {
    label: `${s.title}, ${s.language}${tagStr ? `, tags ${s.tags.join(', ')}` : ''}`,
  };
  return item;
}

function groupItem(node: GroupNode): vscode.TreeItem {
  const state = node.collapsed
    ? vscode.TreeItemCollapsibleState.Collapsed
    : vscode.TreeItemCollapsibleState.Expanded;
  const item = new vscode.TreeItem(node.label, state);
  item.id = `group:${node.id}`;
  item.iconPath = new vscode.ThemeIcon(node.icon);
  item.description = String(node.children.length);
  item.contextValue = 'group';
  return item;
}

export class SnippetTreeProvider implements vscode.TreeDataProvider<Node> {
  private readonly _onDidChange = new vscode.EventEmitter<Node | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  private snippets: Snippet[] = [];
  private auth: AuthState = 'loading';
  private mode: GroupMode = 'sections';
  private filterQuery = '';

  constructor(private readonly extensionUri: vscode.Uri) {}

  setAuth(auth: AuthState): void {
    this.auth = auth;
    this._onDidChange.fire();
  }

  setSnippets(snippets: Snippet[]): void {
    this.snippets = snippets;
    this.auth = 'ready';
    this._onDidChange.fire();
  }

  setGroupMode(mode: GroupMode): void {
    this.mode = mode;
    this._onDidChange.fire();
  }

  setFilter(q: string): void {
    this.filterQuery = q.trim().toLowerCase();
    this._onDidChange.fire();
  }

  // kept for back-compat with existing extension.ts call sites
  setLoading(value: boolean): void {
    if (value) {
      this.auth = 'loading';
      this._onDidChange.fire();
    }
  }

  refresh(snippets: Snippet[]): void {
    this.setSnippets(snippets);
  }

  getTreeItem(node: Node): vscode.TreeItem {
    return node.kind === 'snippet' ? snippetItem(node.snippet, this.extensionUri) : groupItem(node);
  }

  getChildren(node?: Node): Node[] {
    if (this.auth !== 'ready' || this.snippets.length === 0) {
      return [];
    }
    if (!node) {
      return this.buildRoot();
    }
    return node.kind === 'group' ? node.children : [];
  }

  private buildRoot(): Node[] {
    const all = this.filtered();
    if (all.length === 0) return [];
    switch (this.mode) {
      case 'recency':
        return this.groupByRecency(all);
      case 'language':
        return this.groupByLanguage(all);
      case 'sections':
        return this.sectionLayout(all);
    }
  }

  private filtered(): Snippet[] {
    if (!this.filterQuery) return this.snippets;
    const q = this.filterQuery;
    return this.snippets.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.language.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  private sectionLayout(all: Snippet[]): Node[] {
    const pinned = all.filter((s) => s.pinned);
    const unpinned = all.filter((s) => !s.pinned);
    const recent = [...unpinned]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 5);
    const nodes: Node[] = [];
    if (pinned.length) {
      nodes.push({
        kind: 'group',
        id: 'pinned',
        label: 'Pinned',
        icon: 'pinned',
        children: pinned.map((s) => ({ kind: 'snippet', snippet: s })),
      });
    }
    if (recent.length) {
      nodes.push({
        kind: 'group',
        id: 'recent',
        label: 'Recent',
        icon: 'history',
        children: recent.map((s) => ({ kind: 'snippet', snippet: s })),
      });
    }
    nodes.push({
      kind: 'group',
      id: 'all',
      label: 'All Snippets',
      icon: 'folder',
      collapsed: true,
      children: all.map((s) => ({ kind: 'snippet', snippet: s })),
    });
    return nodes;
  }

  private groupByRecency(all: Snippet[]): Node[] {
    const now = Date.now();
    const day = 86_400_000;
    const bucket: Record<string, Snippet[]> = { today: [], week: [], older: [] };
    for (const s of all) {
      const age = now - s.updatedAt.getTime();
      (age < day ? bucket.today : age < 7 * day ? bucket.week : bucket.older).push(s);
    }
    const order: Array<[string, string, string]> = [
      ['today', 'Today', 'clock'],
      ['week', 'This week', 'history'],
      ['older', 'Earlier', 'calendar'],
    ];
    return order
      .filter(([k]) => bucket[k].length > 0)
      .map(([k, label, icon]) => ({
        kind: 'group' as const,
        id: k,
        label,
        icon,
        children: bucket[k].map((s) => ({ kind: 'snippet' as const, snippet: s })),
      }));
  }

  private groupByLanguage(all: Snippet[]): Node[] {
    const by = new Map<string, Snippet[]>();
    for (const s of all) {
      const arr = by.get(s.language) ?? [];
      arr.push(s);
      by.set(s.language, arr);
    }
    return [...by.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([lang, items]) => ({
        kind: 'group' as const,
        id: `lang:${lang}`,
        label: lang,
        icon: LANG_ICON[lang.toLowerCase()]?.icon ?? 'symbol-file',
        children: items.map((s) => ({ kind: 'snippet' as const, snippet: s })),
      }));
  }
}
