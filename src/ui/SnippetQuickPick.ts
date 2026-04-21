import * as vscode from 'vscode';
import { Snippet } from '../models/Snippet';

export class SnippetQuickPick {
  static async show(_snippets: Snippet[]): Promise<Snippet | undefined> {
    throw new Error('Not implemented yet — coming in Phase 8');
  }
}
