import { ISnippetStorage } from './ISnippetStorage';
import { Snippet } from '../models/Snippet';

export class GitHubGistStorage implements ISnippetStorage {
  constructor(private readonly token: string) {}

  async getAll(): Promise<Snippet[]> {
    throw new Error('Not implemented yet — coming in Phase 3');
  }

  async save(_snippet: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>): Promise<Snippet> {
    throw new Error('Not implemented yet — coming in Phase 3');
  }

  async update(_id: string, _updates: Partial<Snippet>): Promise<Snippet> {
    throw new Error('Not implemented yet — coming in Phase 3');
  }

  async delete(_id: string): Promise<void> {
    throw new Error('Not implemented yet — coming in Phase 3');
  }

  async getById(_id: string): Promise<Snippet | null> {
    throw new Error('Not implemented yet — coming in Phase 3');
  }
}
