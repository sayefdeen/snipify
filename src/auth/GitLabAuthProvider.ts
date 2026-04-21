import { IAuthProvider } from './IAuthProvider';
import { User } from '../models/User';

export class GitLabAuthProvider implements IAuthProvider {
  async login(): Promise<User> {
    throw new Error('GitLab support coming soon');
  }

  async logout(): Promise<void> {
    throw new Error('GitLab support coming soon');
  }

  async getToken(): Promise<string | null> {
    throw new Error('GitLab support coming soon');
  }

  async isLoggedIn(): Promise<boolean> {
    throw new Error('GitLab support coming soon');
  }

  async getUser(): Promise<User | null> {
    throw new Error('GitLab support coming soon');
  }
}
