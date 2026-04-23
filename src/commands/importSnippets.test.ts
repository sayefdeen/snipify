import { parseVSCodeSnippets, parseSnipifyJson } from './importSnippets';

describe('parseVSCodeSnippets', () => {
  it('parses a basic entry', () => {
    const raw = {
      'useDebounce': { body: 'const d = useDebounce()', scope: 'typescript' },
    };
    const result = parseVSCodeSnippets(raw);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ title: 'useDebounce', language: 'typescript', code: 'const d = useDebounce()', tags: [] });
  });

  it('joins array body with newlines', () => {
    const raw = { 'multi': { body: ['line1', 'line2'], scope: 'javascript' } };
    const [entry] = parseVSCodeSnippets(raw);
    expect(entry.code).toBe('line1\nline2');
  });

  it('defaults to plaintext when scope is missing', () => {
    const raw = { 'noscope': { body: 'foo' } };
    expect(parseVSCodeSnippets(raw)[0].language).toBe('plaintext');
  });

  it('extracts hashtag tags from description', () => {
    const raw = { 'tagged': { body: 'x', description: '#react #hooks', scope: 'typescriptreact' } };
    expect(parseVSCodeSnippets(raw)[0].tags).toEqual(['react', 'hooks']);
  });

  it('ignores non-hashtag description', () => {
    const raw = { 'plain': { body: 'x', description: 'Just a snippet' } };
    expect(parseVSCodeSnippets(raw)[0].tags).toEqual([]);
  });

  it('throws for an array input', () => {
    expect(() => parseVSCodeSnippets([])).toThrow();
  });

  it('throws for null', () => {
    expect(() => parseVSCodeSnippets(null)).toThrow();
  });
});

describe('parseSnipifyJson', () => {
  it('parses a valid array', () => {
    const raw = [{ title: 'foo', code: 'bar', language: 'go', tags: ['net'] }];
    const [entry] = parseSnipifyJson(raw);
    expect(entry).toMatchObject({ title: 'foo', code: 'bar', language: 'go', tags: ['net'] });
  });

  it('defaults language to plaintext when missing', () => {
    const raw = [{ title: 'x', code: 'y' }];
    expect(parseSnipifyJson(raw)[0].language).toBe('plaintext');
  });

  it('defaults tags to empty array when missing', () => {
    const raw = [{ title: 'x', code: 'y' }];
    expect(parseSnipifyJson(raw)[0].tags).toEqual([]);
  });

  it('throws for a non-array', () => {
    expect(() => parseSnipifyJson({ title: 'x', code: 'y' })).toThrow();
  });

  it('throws when title is missing', () => {
    expect(() => parseSnipifyJson([{ code: 'y' }])).toThrow(/missing required fields/);
  });

  it('throws when code is missing', () => {
    expect(() => parseSnipifyJson([{ title: 'x' }])).toThrow(/missing required fields/);
  });
});
