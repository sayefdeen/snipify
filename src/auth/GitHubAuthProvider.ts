import { IAuthProvider } from './IAuthProvider';
import { User } from '../models/User';

export class GitHubAuthProvider implements IAuthProvider {
  async login(): Promise<User> {
    throw new Error('Not implemented yet — coming in Phase 2');
  }

  async logout(): Promise<void> {
    throw new Error('Not implemented yet — coming in Phase 2');
  }

  async getToken(): Promise<string | null> {
    throw new Error('Not implemented yet — coming in Phase 2');
  }

  async isLoggedIn(): Promise<boolean> {
    throw new Error('Not implemented yet — coming in Phase 2');
  }

  async getUser(): Promise<User | null> {
    throw new Error('Not implemented yet — coming in Phase 2');
  }
}
