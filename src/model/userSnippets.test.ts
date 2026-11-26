import { describe, expect, it } from 'vitest';
import { createSnippetStore, validateUserSnippet, parseSnippets, serializeSnippets, exportSnippets, reviewSnippetImport,
  mutateSnippets, searchUserSnippets, SNIPPET_STORAGE_KEY, MAX_USER_SNIPPETS, MAX_SNIPPET_STORAGE_UNITS,
  type UserSnippet, type PreparedUserSnippet } from './userSnippets';
const sample = (prefix = 'my_print', body = 'print({{1:value}});{{0}}'): UserSnippet =>
  ({ prefix, name: 'My print', description: 'Output helper', body, enabled: true });
function prepared(item = sample()): PreparedUserSnippet {
  const result = validateUserSnippet(item);
  if (!result.ok) throw Error(result.error);
  return result.value;
}
function storage(initial: string | null = null) {
  let raw = initial;
  let writes = 0;
  let fail = false;
  return {
    backend: { getItem: (key: string) => { expect(key).toBe(SNIPPET_STORAGE_KEY); return raw; },
      setItem: (key: string, value: string) => {
        expect(key).toBe(SNIPPET_STORAGE_KEY); if (fail) throw Error('quota'); writes++; raw = value;
      } },
    read: () => raw, writes: () => writes, setRaw: (value: string | null) => { raw = value; },
    fail: () => { fail = true; },
  };
}
describe('user snippet validation and collection', () => {
  it('accepts a valid snippet, normalizes line endings and never serializes compiled state', () => {
    const item = prepared(sample('my_print', 'print(1);\r\n{{0}}'));
    expect(item.body).toBe('print(1);\n{{0}}');
    expect(item.compiled.preview).toBe('print(1);\n');
    expect(Object.isFrozen(item)).toBe(true);
    const raw = exportSnippets([item]);
    expect(raw).not.toContain('compiled');
    const parsed = parseSnippets(raw);
    expect(parsed).toEqual({ ok: true, value: [item] });
  });
  it.each(['print', 'PRINT', 'bind', 'funcra', 'integer', 'a-b', 'a.b', 'two words', '1abc', '', 'a'.repeat(49)])('rejects reserved or invalid prefix %j', prefix => {
    expect(validateUserSnippet(sample(prefix)).ok).toBe(false);
  });
  it('rejects hidden fields and invalid metadata', () => {
    for (const item of [{ ...sample(), command: 'run' }, { ...sample(), enabled: 'true' },
      { ...sample(), name: '  whitespace' }, { ...sample(), name: '\u202eabc' },
      { ...sample(), description: 'two\nlines' }, { ...sample(), body: '{{3:bad}}' }]) {
      expect(validateUserSnippet(item).ok).toBe(false);
    }
  });
  it('rejects duplicate prefixes case-insensitively, invalid roots, duplicate JSON keys and bounds', () => {
    expect(parseSnippets(serializeSnippets([sample(), sample('MY_PRINT')])).ok).toBe(false);
    expect(parseSnippets('{"format":"scarp-studio.snippets","version":1,"version":1,"snippets":[]}').ok).toBe(false);
    expect(parseSnippets('{"format":"scarp-studio.snippets","version":2,"snippets":[]}').ok).toBe(false);
    expect(parseSnippets(' '.repeat(MAX_SNIPPET_STORAGE_UNITS + 1)).ok).toBe(false);
    expect(parseSnippets(serializeSnippets(Array.from({ length: MAX_USER_SNIPPETS + 1 }, (_, i) => sample('test_' + i)))).ok).toBe(false);
  });
  it('supports immutable create, rename, disable, removal and bounded search', () => {
    const first = prepared();
    const entries = [first, prepared({ ...sample('second'), name: 'Other', enabled: false })];
    expect(searchUserSnippets(entries, 'OUTPUT my', true)).toEqual([first]);
    expect(searchUserSnippets(entries, 'other', true)).toEqual([]);
    expect(searchUserSnippets(entries, 'other')).toEqual([entries[1]]);
    expect(mutateSnippets(entries, { kind: 'create', item: sample('SECOND') }).ok).toBe(false);
    expect(mutateSnippets(entries, { kind: 'replace', prefix: 'missing', item: sample() }).ok).toBe(false);
    const renamed = mutateSnippets(entries, { kind: 'replace', prefix: 'MY_PRINT', item: { ...sample('renamed'), enabled: false } });
    expect(renamed.ok && renamed.value[0].prefix).toBe('renamed');
    expect(renamed.ok && renamed.value[0].enabled).toBe(false);
    expect(entries[0]).toBe(first);
    expect(mutateSnippets(entries, { kind: 'delete', prefix: 'MY_PRINT' })).toEqual({ ok: true, value: [entries[1]] });
  });
});
describe('reviewed snippet collection imports', () => {
  it('reports additions, exact duplicates and conflicts without replacing existing text', () => {
    const current = [prepared(), prepared(sample('second'))];
    const incoming = serializeSnippets([sample(), sample('SECOND', 'print(0);'), sample('third')]);
    const plan = reviewSnippetImport(current, incoming);
    expect(plan.ok).toBe(true);
    if (!plan.ok) throw Error(plan.error);
    expect(plan.value.additions).toEqual(['third']);
    expect(plan.value.unchanged).toEqual(['my_print']);
    expect(plan.value.conflicts).toEqual(['SECOND']);
    expect(plan.value.result[1]).toBe(current[1]);
    expect(plan.value.result.map(item => item.prefix)).toEqual(['my_print', 'second', 'third']);
  });
  it('enforces the aggregate limit rather than truncating a reviewed import', () => {
    const full = Array.from({ length: MAX_USER_SNIPPETS }, (_, i) => prepared(sample('test_' + i)));
    expect(reviewSnippetImport(full, serializeSnippets([sample('extra')])).ok).toBe(false);
  });
});
describe('snippet store persistence and stale reviews', () => {
  it('publishes only reviewed changes and rejects a stale revision', () => {
    const disk = storage();
    const store = createSnippetStore(disk.backend);
    let notifications = 0;
    const unsubscribe = store.subscribe(() => notifications++);
    expect(store.mutate({ kind: 'create', item: sample() }, 0).ok).toBe(true);
    expect(store.mutate({ kind: 'delete', prefix: 'my_print' }, 0).ok).toBe(false);
    expect(disk.writes()).toBe(1);
    expect(notifications).toBe(1);
    expect(createSnippetStore(disk.backend).getSnapshot().items[0].prefix).toBe('my_print');
    unsubscribe();
    expect(store.mutate({ kind: 'delete', prefix: 'my_print' }, 1).ok).toBe(true);
    expect(notifications).toBe(1);
  });
  it('detects an external edit before persisting a mutation', () => {
    const disk = storage(serializeSnippets([sample()]));
    const store = createSnippetStore(disk.backend);
    disk.setRaw(serializeSnippets([sample('external')]));
    expect(store.mutate({ kind: 'delete', prefix: 'my_print' }, 0).ok).toBe(false);
    expect(disk.writes()).toBe(0);
    expect(store.getSnapshot().items[0].prefix).toBe('external');
  });
  it('preserves unreadable storage until a matching explicit discard review', () => {
    const disk = storage('malformed');
    const store = createSnippetStore(disk.backend);
    expect(store.getSnapshot().persistence).toBe('blocked');
    expect(store.mutate({ kind: 'create', item: sample() }, 0).ok).toBe(false);
    expect(disk.read()).toBe('malformed');
    disk.setRaw('changed');
    expect(store.discardUnreadable(0).ok).toBe(false);
    expect(store.reload().ok).toBe(false);
    expect(store.discardUnreadable(store.getSnapshot().revision).ok).toBe(true);
    expect(parseSnippets(disk.read())).toEqual({ ok: true, value: [] });
  });
  it('retains session edits and clearly marks persistence failure', () => {
    const disk = storage();
    disk.fail();
    const store = createSnippetStore(disk.backend);
    expect(store.mutate({ kind: 'create', item: sample() }, 0).ok).toBe(true);
    expect(store.getSnapshot().persistence).toBe('session-only');
    expect(store.getSnapshot().items).toHaveLength(1);
    expect(disk.read()).toBeNull();
  });
  it('applies additive import but rejects altered or stale plans', () => {
    const store = createSnippetStore(null);
    expect(store.mutate({ kind: 'create', item: sample() }, 0).ok).toBe(true);
    const incoming = serializeSnippets([sample('my_print', 'print(0);'), sample('new_one')]);
    const result = reviewSnippetImport(store.getSnapshot().items, incoming);
    if (!result.ok) throw Error(result.error);
    const review = result.value;
    expect(store.applyImport({ ...review, result: [prepared(sample('new_one'))] }, 1).ok).toBe(false);
    expect(store.applyImport(review, 0).ok).toBe(false);
    expect(store.applyImport(review, 1).ok).toBe(true);
    expect(store.getSnapshot().items.map(item => item.prefix)).toEqual(['my_print', 'new_one']);
    expect(store.getSnapshot().items[0].body).toBe(sample().body);
  });
});
