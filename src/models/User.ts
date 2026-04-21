export type ProviderType = 'github' | 'gitlab' | 'bitbucket';

export interface User {
  id: string;
  username: string;
  avatarUrl?: string;
  provider: ProviderType;
}
