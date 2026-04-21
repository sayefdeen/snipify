import * as vscode from 'vscode';
import { Snippet } from '../models/Snippet';

export class SnippetTreeItem extends vscode.TreeItem {
  constructor(public readonly snippet: Snippet) {
    super(snippet.title, vscode.TreeItemCollapsibleState.None);
    this.description = snippet.language;
    this.tooltip = `${snippet.title} · ${snippet.tags.join(', ')}`;
    this.contextValue = 'snippet';
    this.command = {
      command: 'snipify.insertSnippet',
      title: 'Insert Snippet',
      arguments: [this],
    };
  }
}

class MessageTreeItem extends vscode.TreeItem {
  constructor(message: string, icon?: string) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'message';
    if (icon) {
      this.iconPath = new vscode.ThemeIcon(icon);
    }
  }
}

export class SnippetTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private snippets: Snippet[] = [];
  private loading = false;
  private initialized = false;

  setLoading(value: boolean): void {
    this.loading = value;
    this._onDidChangeTreeData.fire();
  }

  refresh(snippets: Snippet[]): void {
    this.snippets = snippets;
    this.loading = false;
    this.initialized = true;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.TreeItem[] {
    if (this.loading) {
      return [new MessageTreeItem('Loading snippets...', 'sync~spin')];
    }
    if (!this.initialized) {
      return [new MessageTreeItem('Log in to see your snippets', 'account')];
    }
    if (this.snippets.length === 0) {
      return [new MessageTreeItem('No snippets yet — select code and save!', 'add')];
    }
    return this.snippets.map((s) => new SnippetTreeItem(s));
  }
}
