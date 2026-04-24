export type ProviderType = 'github' | 'bitbucket';

export interface User {
  id: string;
  username: string;
  avatarUrl?: string;
  provider: ProviderType;
}
