import { Snippet } from '../models/Snippet';

export interface ISnippetStorage {
  getAll(): Promise<Snippet[]>;
  save(snippet: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>): Promise<Snippet>;
  update(id: string, updates: Partial<Snippet>): Promise<Snippet>;
  delete(id: string): Promise<void>;
  getById(id: string): Promise<Snippet | null>;
}
