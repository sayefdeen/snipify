import { ISnippetStorage } from '../storage/ISnippetStorage';
import { Snippet } from '../models/Snippet';

export async function editSnippetCommand(
  _id: string,
  _updates: Partial<Pick<Snippet, 'title' | 'tags'>>,
  _storage: ISnippetStorage
): Promise<void> {
  throw new Error('Not implemented yet — coming in Phase 7');
}
