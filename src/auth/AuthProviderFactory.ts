import { ProviderType } from '../models/User';
import { IAuthProvider } from './IAuthProvider';
import { GitHubAuthProvider } from './GitHubAuthProvider';
import { GitLabAuthProvider } from './GitLabAuthProvider';
import { BitbucketAuthProvider } from './BitbucketAuthProvider';

export class AuthProviderFactory {
  static create(provider: ProviderType): IAuthProvider {
    switch (provider) {
      case 'github':
        return new GitHubAuthProvider();
      case 'gitlab':
        return new GitLabAuthProvider();
      case 'bitbucket':
        return new BitbucketAuthProvider();
      default: {
        const _exhaustive: never = provider;
        throw new Error(`Unknown provider: ${_exhaustive}`);
      }
    }
  }
}
