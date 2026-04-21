import { User } from '../models/User';

export interface IAuthProvider {
  login(): Promise<User>;
  logout(): Promise<void>;
  getToken(): Promise<string | null>;
  isLoggedIn(): Promise<boolean>;
  getUser(): Promise<User | null>;
}
