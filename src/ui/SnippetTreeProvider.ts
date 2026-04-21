import * as vscode from 'vscode';
import { Snippet } from '../models/Snippet';

export class SnippetTreeItem extends vscode.TreeItem {
  constructor(public readonly snippet: Snippet) {
    super(snippet.title, vscode.TreeItemCollapsibleState.None);
    this.description = snippet.language;
    this.tooltip = snippet.title;
    this.contextValue = 'snippet';
  }
}

export class SnippetTreeProvider implements vscode.TreeDataProvider<SnippetTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SnippetTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private snippets: Snippet[] = [];

  refresh(snippets: Snippet[]): void {
    this.snippets = snippets;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SnippetTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): SnippetTreeItem[] {
    return this.snippets.map((s) => new SnippetTreeItem(s));
  }
}
