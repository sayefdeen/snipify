import { ProviderType } from './User';

export interface Snippet {
  id: string;
  title: string;
  code: string;
  language: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  provider: ProviderType;
  pinned?: boolean;
}
