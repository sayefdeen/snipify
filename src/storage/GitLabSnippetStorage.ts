import { ISnippetStorage } from './ISnippetStorage';
import { Snippet } from '../models/Snippet';

export class GitLabSnippetStorage implements ISnippetStorage {
  constructor(private readonly token: string) {}

  async getAll(): Promise<Snippet[]> {
    throw new Error('GitLab support coming soon');
  }

  async save(_snippet: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>): Promise<Snippet> {
    throw new Error('GitLab support coming soon');
  }

  async update(_id: string, _updates: Partial<Snippet>): Promise<Snippet> {
    throw new Error('GitLab support coming soon');
  }

  async delete(_id: string): Promise<void> {
    throw new Error('GitLab support coming soon');
  }

  async getById(_id: string): Promise<Snippet | null> {
    throw new Error('GitLab support coming soon');
  }
}
