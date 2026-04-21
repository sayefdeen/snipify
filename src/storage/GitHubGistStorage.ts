import { ISnippetStorage } from './ISnippetStorage';
import { Snippet } from '../models/Snippet';

const GISTS_API = 'https://api.github.com/gists';

interface GistFile {
  filename: string;
  content: string;
}

interface GistResponse {
  id: string;
  description: string;
  files: Record<string, GistFile>;
  created_at: string;
  updated_at: string;
}

interface GistMetadata {
  language: string;
  tags: string[];
  createdAt: string;
}

export class GitHubGistStorage implements ISnippetStorage {
  constructor(private readonly token: string) {}

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  private mapGistToSnippet(gist: GistResponse): Snippet | null {
    let meta: GistMetadata;
    try {
      meta = JSON.parse(gist.description) as GistMetadata;
    } catch {
      return null; // not a Snipify gist
    }

    const file = Object.values(gist.files)[0];
    if (!file) {
      return null;
    }

    return {
      id: gist.id,
      title: file.filename,
      code: file.content,
      language: meta.language ?? 'plaintext',
      tags: meta.tags ?? [],
      createdAt: new Date(meta.createdAt ?? gist.created_at),
      updatedAt: new Date(gist.updated_at),
      provider: 'github',
    };
  }

  async getAll(): Promise<Snippet[]> {
    const res = await fetch(`${GISTS_API}?per_page=100`, { headers: this.headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch gists: ${res.statusText}`);
    }
    const gists = (await res.json()) as GistResponse[];

    const snippets: Snippet[] = [];
    for (const gist of gists) {
      // Fetch full gist to get file content (list endpoint omits content)
      const full = await this.getById(gist.id);
      if (full) {
        snippets.push(full);
      }
    }
    return snippets;
  }

  async save(snippet: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>): Promise<Snippet> {
    const meta: GistMetadata = {
      language: snippet.language,
      tags: snippet.tags,
      createdAt: new Date().toISOString(),
    };

    const body = {
      description: JSON.stringify(meta),
      public: false,
      files: {
        [snippet.title]: { content: snippet.code },
      },
    };

    const res = await fetch(GISTS_API, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Failed to save snippet: ${res.statusText}`);
    }

    const gist = (await res.json()) as GistResponse;
    return this.mapGistToSnippet(gist)!;
  }

  async update(id: string, updates: Partial<Snippet>): Promise<Snippet> {
    const current = await this.getById(id);
    if (!current) {
      throw new Error(`Snippet ${id} not found`);
    }

    const merged = { ...current, ...updates };
    const meta: GistMetadata = {
      language: merged.language,
      tags: merged.tags,
      createdAt: merged.createdAt.toISOString(),
    };

    const files: Record<string, { content?: string } | null> = {};

    if (updates.title && updates.title !== current.title) {
      // Rename: delete old filename, create new one
      files[current.title] = null;
      files[updates.title] = { content: updates.code ?? current.code };
    } else {
      files[merged.title] = { content: merged.code };
    }

    const body = {
      description: JSON.stringify(meta),
      files,
    };

    const res = await fetch(`${GISTS_API}/${id}`, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Failed to update snippet: ${res.statusText}`);
    }

    const gist = (await res.json()) as GistResponse;
    return this.mapGistToSnippet(gist)!;
  }

  async delete(id: string): Promise<void> {
    const res = await fetch(`${GISTS_API}/${id}`, {
      method: 'DELETE',
      headers: this.headers,
    });

    if (!res.ok) {
      throw new Error(`Failed to delete snippet: ${res.statusText}`);
    }
  }

  async getById(id: string): Promise<Snippet | null> {
    const res = await fetch(`${GISTS_API}/${id}`, { headers: this.headers });
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      throw new Error(`Failed to fetch snippet: ${res.statusText}`);
    }

    const gist = (await res.json()) as GistResponse;
    return this.mapGistToSnippet(gist);
  }
}
