import { ProviderType } from '../models/User';
import { ISnippetStorage } from './ISnippetStorage';
import { GitHubGistStorage } from './GitHubGistStorage';
import { GitLabSnippetStorage } from './GitLabSnippetStorage';
import { BitbucketStorage } from './BitbucketStorage';

export class StorageFactory {
  static create(provider: ProviderType, token: string): ISnippetStorage {
    switch (provider) {
      case 'github':
        return new GitHubGistStorage(token);
      case 'gitlab':
        return new GitLabSnippetStorage(token);
      case 'bitbucket':
        return new BitbucketStorage(token);
      default: {
        const _exhaustive: never = provider;
        throw new Error(`Unknown provider: ${_exhaustive}`);
      }
    }
  }
}
