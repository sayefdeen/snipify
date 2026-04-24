import { ISnippetStorage } from './ISnippetStorage';
import { Snippet } from '../models/Snippet';

const BB_API = 'https://api.bitbucket.org/2.0';
const REPO   = 'snipify-snippets';
const BRANCH = 'main';

export class BitbucketStorage implements ISnippetStorage {
  private readonly credential: string;
  private readonly workspace: string;

  constructor(token: string) {
    // Format from BitbucketAuthProvider.getToken(): "workspace|email:apiToken"
    const pipeIdx   = token.indexOf('|');
    this.workspace  = token.substring(0, pipeIdx);
    this.credential = Buffer.from(token.substring(pipeIdx + 1)).toString('base64');
  }

  private get authHeaders(): Record<string, string> {
    return { Authorization: `Basic ${this.credential}`, Accept: 'application/json' };
  }

  private get repoUrl(): string {
    return `${BB_API}/repositories/${this.workspace}/${REPO}`;
  }

  // Derive a stable file-safe id from the snippet title.
  // "My Function" → "my-function"  (used as both id and filename: my-function.json)
  private titleToId(title: string): string {
    return title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '') || 'snippet';
  }

  private snippetUrl(id: string): string {
    return `https://bitbucket.org/${this.workspace}/${REPO}/src/${BRANCH}/${id}.json`;
  }

  private buildBody(
    fields: Record<string, string>,
    file?: { name: string; content: string }
  ): { body: Buffer; contentType: string } {
    const boundary = `----snipify${Date.now().toString(16)}`;
    const crlf = '\r\n';

    const textPart = (name: string, value: string): string =>
      `--${boundary}${crlf}` +
      `Content-Disposition: form-data; name="${name}"${crlf}${crlf}` +
      `${value}${crlf}`;

    let body = '';
    if (file) {
      body +=
        `--${boundary}${crlf}` +
        `Content-Disposition: form-data; name="${file.name}"; filename="${file.name}"${crlf}` +
        `Content-Type: application/json${crlf}${crlf}` +
        `${file.content}${crlf}`;
    }
    for (const [k, v] of Object.entries(fields)) {
      body += textPart(k, v);
    }
    body += `--${boundary}--${crlf}`;

    return { body: Buffer.from(body, 'utf8'), contentType: `multipart/form-data; boundary=${boundary}` };
  }

  private async postSrc(fields: Record<string, string>, file?: { name: string; content: string }): Promise<Response> {
    const { body, contentType } = this.buildBody(fields, file);
    return fetch(`${this.repoUrl}/src`, {
      method: 'POST',
      headers: { Authorization: `Basic ${this.credential}`, 'Content-Type': contentType },
      body,
    });
  }

  private async ensureRepo(): Promise<void> {
    const res = await fetch(this.repoUrl, { headers: this.authHeaders });
    if (res.ok) return;
    if (res.status === 404) {
      throw new Error(
        `Snipify needs a private repository named "${REPO}" in your Bitbucket workspace. ` +
        `Create it at bitbucket.org/${this.workspace} → Repositories → Create repository, then try again.`
      );
    }
    throw Object.assign(
      new Error(`Cannot access ${REPO} repo: ${res.status} ${res.statusText}`),
      { status: res.status }
    );
  }

  async getAll(): Promise<Snippet[]> {
    const res = await fetch(`${this.repoUrl}/src/${BRANCH}/?pagelen=100`, { headers: this.authHeaders });
    if (res.status === 404) return [];
    if (!res.ok) {
      const retryAfter = res.headers.get('Retry-After');
      const resetAt = retryAfter ? Date.now() + parseInt(retryAfter, 10) * 1000 : undefined;
      const errBody = await res.text().catch(() => '');
      throw Object.assign(
        new Error(`Failed to fetch snippets: ${res.status} ${res.statusText} — ${errBody}`),
        { status: res.status, resetAt }
      );
    }

    const data = (await res.json()) as { values: Array<{ path: string; type: string }> };
    const files = data.values.filter((f) => f.type === 'commit_file' && f.path.endsWith('.json'));

    const snippets: Snippet[] = [];
    await Promise.all(files.map(async (f) => {
      const r = await fetch(`${this.repoUrl}/src/${BRANCH}/${f.path}`, {
        headers: { Authorization: `Basic ${this.credential}` },
      });
      if (!r.ok) return;
      try {
        const s = JSON.parse(await r.text()) as Snippet & { createdAt: string; updatedAt: string };
        snippets.push({ ...s, createdAt: new Date(s.createdAt), updatedAt: new Date(s.updatedAt) });
      } catch { /* skip malformed files */ }
    }));

    return snippets.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async save(snippet: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>): Promise<Snippet> {
    await this.ensureRepo();

    const id = this.titleToId(snippet.title);

    // Reject duplicate titles — the file would overwrite silently otherwise
    const existing = await fetch(`${this.repoUrl}/src/${BRANCH}/${id}.json`, {
      headers: { Authorization: `Basic ${this.credential}` },
    });
    if (existing.ok) {
      throw new Error(`A snippet named "${snippet.title}" already exists. Choose a different title.`);
    }

    const now = new Date();
    const full: Snippet = {
      ...snippet,
      id,
      createdAt: now,
      updatedAt: now,
      provider: 'bitbucket',
      url: this.snippetUrl(id),
    };

    const res = await this.postSrc(
      { message: `Add snippet: ${snippet.title}`, branch: BRANCH },
      { name: `${id}.json`, content: JSON.stringify(full) }
    );
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Failed to save snippet: ${res.status} ${res.statusText} — ${err}`);
    }
    return full;
  }

  async update(id: string, updates: Partial<Snippet>): Promise<Snippet> {
    const current = await this.getById(id);
    if (!current) throw new Error(`Snippet ${id} not found`);

    const newTitle = updates.title ?? current.title;
    const newId    = this.titleToId(newTitle);
    const merged: Snippet = {
      ...current,
      ...updates,
      id: newId,
      updatedAt: new Date(),
      url: this.snippetUrl(newId),
    };

    if (newId !== id) {
      // Title changed — write new file, then delete the old one (two commits)
      const writeRes = await this.postSrc(
        { message: `Rename snippet: ${current.title} → ${newTitle}`, branch: BRANCH },
        { name: `${newId}.json`, content: JSON.stringify(merged) }
      );
      if (!writeRes.ok) {
        const err = await writeRes.text().catch(() => '');
        throw new Error(`Failed to update snippet: ${writeRes.status} ${writeRes.statusText} — ${err}`);
      }
      await this.postSrc({
        files: `${id}.json`,
        message: `Remove old file after rename`,
        branch: BRANCH,
      });
    } else {
      const res = await this.postSrc(
        { message: `Update snippet: ${merged.title}`, branch: BRANCH },
        { name: `${id}.json`, content: JSON.stringify(merged) }
      );
      if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(`Failed to update snippet: ${res.status} ${res.statusText} — ${err}`);
      }
    }

    return merged;
  }

  async delete(id: string): Promise<void> {
    const res = await this.postSrc({
      files: `${id}.json`,
      message: `Delete snippet ${id}`,
      branch: BRANCH,
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Failed to delete snippet: ${res.status} ${res.statusText}`);
    }
  }

  async getById(id: string): Promise<Snippet | null> {
    const res = await fetch(`${this.repoUrl}/src/${BRANCH}/${id}.json`, {
      headers: { Authorization: `Basic ${this.credential}` },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to fetch snippet: ${res.statusText}`);
    try {
      const s = JSON.parse(await res.text()) as Snippet & { createdAt: string; updatedAt: string };
      return { ...s, createdAt: new Date(s.createdAt), updatedAt: new Date(s.updatedAt) };
    } catch {
      return null;
    }
  }
}
