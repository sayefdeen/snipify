import { IAuthProvider } from './IAuthProvider';
import { User } from '../models/User';

export class BitbucketAuthProvider implements IAuthProvider {
  async login(): Promise<User> {
    throw new Error('Bitbucket support coming soon');
  }

  async logout(): Promise<void> {
    throw new Error('Bitbucket support coming soon');
  }

  async getToken(): Promise<string | null> {
    throw new Error('Bitbucket support coming soon');
  }

  async isLoggedIn(): Promise<boolean> {
    throw new Error('Bitbucket support coming soon');
  }

  async getUser(): Promise<User | null> {
    throw new Error('Bitbucket support coming soon');
  }
}
