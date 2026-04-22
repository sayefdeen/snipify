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
  html_url: string;
  files: Record<string, GistFile>;
  created_at: string;
  updated_at: string;
}

interface GistMetadata {
  language: string;
  tags: string[];
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
    const file = Object.values(gist.files)[0];
    if (!file) {
      return null;
    }

    const match = gist.description?.match(/^Language: (\S+)(?:, Tags: (.+))?$/);
    const language = match ? match[1] : this.inferLanguage(file.filename);
    const tags = match && match[2] ? match[2].split(', ').map((t) => t.trim()) : [];

    return {
      id: gist.id,
      title: file.filename,
      code: file.content,
      language,
      tags,
      createdAt: new Date(gist.created_at),
      updatedAt: new Date(gist.updated_at),
      provider: 'github',
      url: gist.html_url,
    };
  }

  private inferLanguage(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      ts: 'typescript', tsx: 'typescriptreact',
      js: 'javascript', jsx: 'javascriptreact',
      py: 'python', rb: 'ruby', go: 'go',
      rs: 'rust', java: 'java', cs: 'csharp',
      cpp: 'cpp', c: 'c', html: 'html',
      css: 'css', scss: 'scss', json: 'json',
      md: 'markdown', sh: 'shellscript', yml: 'yaml', yaml: 'yaml',
    };
    return (ext && map[ext]) ? map[ext] : 'plaintext';
  }

  async getAll(): Promise<Snippet[]> {
    const res = await fetch(`${GISTS_API}?per_page=100`, { headers: this.headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch gists: ${res.statusText}`);
    }
    const gists = (await res.json()) as GistResponse[];

    const snippets: Snippet[] = [];
    for (const gist of gists) {
      if (Object.keys(gist.files).length === 0) {
        continue;
      }
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
    };

    const body = {
      description: `Language: ${meta.language}${meta.tags.length ? `, Tags: ${meta.tags.join(', ')}` : ''}`,
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
    };

    const files: Record<string, { content?: string } | null> = {};

    if (updates.title && updates.title !== current.title) {
      files[current.title] = null;
      files[updates.title] = { content: updates.code ?? current.code };
    } else {
      files[merged.title] = { content: merged.code };
    }

    const body = {
      description: `Language: ${meta.language}${meta.tags.length ? `, Tags: ${meta.tags.join(', ')}` : ''}`,
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
