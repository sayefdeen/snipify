import * as vscode from 'vscode';
import { ISnippetStorage } from '../storage/ISnippetStorage';

interface VSCodeSnippetEntry {
  prefix?: string | string[];
  body: string | string[];
  description?: string;
  scope?: string;
}

interface SnipifyJsonEntry {
  title: string;
  language: string;
  tags?: string[];
  code: string;
}

export function parseVSCodeSnippets(raw: unknown): Array<{ title: string; language: string; tags: string[]; code: string }> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Not a valid .code-snippets file');
  }
  const entries = raw as Record<string, unknown>;
  return Object.entries(entries).map(([title, entry]) => {
    const e = entry as VSCodeSnippetEntry;
    const body = Array.isArray(e.body) ? e.body.join('\n') : String(e.body ?? '');
    const scope = e.scope ?? 'plaintext';
    const desc = typeof e.description === 'string' ? e.description : '';
    const tags = desc.startsWith('#')
      ? desc.split(/\s+/).filter((t) => t.startsWith('#')).map((t) => t.slice(1))
      : [];
    return { title, language: scope, tags, code: body };
  });
}

export function parseSnipifyJson(raw: unknown): Array<{ title: string; language: string; tags: string[]; code: string }> {
  if (!Array.isArray(raw)) {
    throw new Error('Not a valid Snipify JSON export (expected an array)');
  }
  return (raw as SnipifyJsonEntry[]).map((s, i) => {
    if (!s.title || !s.code) {
      throw new Error(`Entry ${i + 1} is missing required fields (title, code)`);
    }
    return {
      title: s.title,
      language: s.language ?? 'plaintext',
      tags: Array.isArray(s.tags) ? s.tags : [],
      code: s.code,
    };
  });
}

export async function importSnippetsCommand(
  storage: ISnippetStorage,
  provider: 'github' | 'bitbucket'
): Promise<number> {
  const uris = await vscode.window.showOpenDialog({
    canSelectMany: false,
    filters: {
      'Snippet files': ['json', 'code-snippets'],
    },
    title: 'Import Snippets',
  });
  if (!uris?.length) return 0;

  const uri = uris[0];
  const raw = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');

  let parsed: ReturnType<typeof parseVSCodeSnippets>;
  try {
    const json: unknown = JSON.parse(raw);
    parsed = Array.isArray(json)
      ? parseSnipifyJson(json)
      : parseVSCodeSnippets(json);
  } catch (err) {
    throw new Error(`Could not parse file: ${(err as Error).message}`);
  }

  if (parsed.length === 0) {
    vscode.window.showWarningMessage('Snipify: No snippets found in the selected file.');
    return 0;
  }

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Snipify: Importing snippets…', cancellable: false },
    async (progress) => {
      for (let i = 0; i < parsed.length; i++) {
        const s = parsed[i];
        progress.report({ message: `${i + 1} / ${parsed.length}: ${s.title}`, increment: 100 / parsed.length });
        await storage.save({ ...s, provider });
      }
    }
  );

  return parsed.length;
}
