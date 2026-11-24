import { describe, expect, it } from 'vitest';
import {
  expectedListedImportName, collectScarpRawImports,
  buildScarpImportGraph, listedImportNavigationTarget, MAX_IMPORTS_PER_SOURCE,
} from './sourceImports';
import type { StudioDocument } from './documents';

function document(name: string, text: string): StudioDocument {
  return {
    id: name, name: name.split('/').pop() ?? name,
    path: 'C:/Scarp/' + name,
    content: text, savedContent: text, revision: 0,
  };
}
const listed = (...names: string[]) =>
  names.map(name => ({ name, path: 'C:/Scarp/' + name }));

describe('read-only import path matching', () => {
  it.each([
    ['main.srp', 'lib.srp', 'lib.srp'],
    ['src/main.srp', 'lib.srp', 'src/lib.srp'],
    ['examples/main.srp', 'nested/part.srp', 'examples/nested/part.srp'],
    ['basic_tuple/src/main.srp', 'helper.srp', 'basic_tuple/src/helper.srp'],
  ] as const)('matches listed name %s + %s', (source, specifier, expected) => {
    expect(expectedListedImportName(source, specifier)).toBe(expected);
  });
  it.each([
    '../secrets.srp', '/root.srp', '\\windows\\file.srp',
    'C:/escape.srp', '', 'module.rs', './relative.srp',
    'a/../b.srp', 'a//b.srp', 'a/.hidden.srp', 'a\\b.srp',
    'a\nb.srp', 'x'.repeat(300) + '.srp',
  ])('rejects unsupported specifier %j', (specifier) => {
    expect(expectedListedImportName('src/main.srp', specifier)).toBeNull();
  });
  it('does not infer navigation from invalid source labels', () => {
    expect(expectedListedImportName('../out.srp', 'helper.srp')).toBeNull();
    expect(expectedListedImportName('root/main.txt', 'helper.srp')).toBeNull();
  });
});

describe('editor-only import header parsing', () => {
  it('finds a literal path and alias with stable source coordinates', () => {
    const result = collectScarpRawImports('import "helpers.srp" as h;\nprint(h);');
    expect(result.incomplete).toBe(false);
    expect(result.references).toHaveLength(1);
    expect(result.references[0]).toMatchObject({
      specifier: 'helpers.srp', alias: 'h',
      offset: 0, line: 1, column: 1, recognized: true,
    });
  });
  it('ignores quoted and commented-out import keywords', () => {
    const source = '// import "fake.srp" as fake;\nprint("import other");';
    expect(collectScarpRawImports(source).references).toEqual([]);
  });
  it('retains malformed headers only as non-navigable review notes', () => {
    for (const source of [
      'import "unaliased.srp";', 'import someVar as alias;',
      'import "mod.srp" named alias;', 'import "mod.srp" as ;',
    ]) {
      const result = collectScarpRawImports(source);
      expect(result.references[0]?.recognized).toBe(false);
    }
  });
  it('finds separate imports across multiline headers', () => {
    const source = 'import\n"first.srp"\nas\nfirst;\r\nimport "second.srp" as second;';
    expect(collectScarpRawImports(source).references.map(x => x.specifier))
      .toEqual(['first.srp', 'second.srp']);
  });
  it('caps work instead of returning an unbounded inventory', () => {
    const text = Array.from({ length: MAX_IMPORTS_PER_SOURCE + 2 },
      (_, i) => 'import "mod' + i + '.srp" as m' + i + ';').join('\n');
    const result = collectScarpRawImports(text);
    expect(result.references).toHaveLength(MAX_IMPORTS_PER_SOURCE);
    expect(result.incomplete).toBe(true);
  });
});

describe('open buffer import graph', () => {
  it('links an open module and a listed but unopened module', () => {
    const main = document('src/main.srp',
      'import "lib.srp" as lib;\nimport "other.srp" as other;');
    const library = document('src/lib.srp', 'funcra go() {}');
    const graph = buildScarpImportGraph([main, library],
      listed('src/main.srp', 'src/lib.srp', 'src/other.srp'));
    expect(graph.edges.map(edge => edge.status)).toEqual(['open', 'listed']);
    expect(graph.edges[0].targetDocumentId).toBe(library.id);
    expect(graph.summary.open).toBe(1);
    expect(graph.summary.listed).toBe(1);
    expect(graph.cycles).toEqual([]);
  });

  it('does not index files outside the current Explorer listing', () => {
    const hidden = document('private/main.srp',
      'import "private.srp" as private;');
    const graph = buildScarpImportGraph([hidden], listed('src/main.srp'));
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
  });

  it('reports missing and unsafe links without synthesizing native paths', () => {
    const main = document('src/main.srp',
      'import "../outside.srp" as bad;\nimport "missing.srp" as missing;');
    const graph = buildScarpImportGraph([main], listed('src/main.srp'));
    expect(graph.edges.map(edge => edge.status)).toEqual(['unsafe', 'missing']);
    expect(graph.edges.every(edge => edge.targetPath === null)).toBe(true);
  });

  it('never opens a self-import or a removed listing target', () => {
    const main = document('src/main.srp', 'import "main.srp" as self;');
    const list = listed('src/main.srp');
    const edge = buildScarpImportGraph([main], list).edges[0];
    expect(edge.status).toBe('self');
    expect(listedImportNavigationTarget(edge, list)).toBeNull();
  });

  it('allows navigation only to exact currently-listed original paths', () => {
    const main = document('src/main.srp', 'import "util.srp" as util;');
    const list = listed('src/main.srp', 'src/util.srp');
    const edge = buildScarpImportGraph([main], list).edges[0];
    expect(edge.status).toBe('listed');
    expect(listedImportNavigationTarget(edge, list)).toBe('C:/Scarp/src/util.srp');
    expect(listedImportNavigationTarget(edge, list.slice(0, 1))).toBeNull();
  });

  it('detects a two-file cycle only within open buffers', () => {
    const a = document('src/a.srp', 'import "b.srp" as b;');
    const b = document('src/b.srp', 'import "a.srp" as a;');
    const graph = buildScarpImportGraph([a,b], listed('src/a.srp','src/b.srp'));
    expect(graph.cycles).toEqual([[a.id,b.id,a.id]]);
    expect(graph.edges.every(edge => edge.status === 'open')).toBe(true);
  });

  it('does not guess cycles through unopened sources', () => {
    const a = document('src/a.srp', 'import "b.srp" as b;');
    const graph = buildScarpImportGraph([a], listed('src/a.srp','src/b.srp'));
    expect(graph.cycles).toEqual([]);
  });

  it('stays scoped to the originating nested project directory', () => {
    const main = document('basic_tuple/main.srp',
      'import "helper.srp" as helper;');
    const graph = buildScarpImportGraph([main],
      listed('basic_tuple/main.srp', 'basic_tuple/helper.srp', 'loops/helper.srp'));
    expect(graph.edges[0].targetRelativeName).toBe('basic_tuple/helper.srp');
    expect(graph.edges[0].targetPath).toBe('C:/Scarp/basic_tuple/helper.srp');
  });

  it('preserves source strings and returns reproducible independent results', () => {
    const main = document('src/main.srp', 'import "helper.srp" as helper;');
    const list = listed('src/main.srp', 'src/helper.srp');
    const first = buildScarpImportGraph([main], list);
    const second = buildScarpImportGraph([main], list);
    expect(first).toEqual(second);
    expect(first.edges).not.toBe(second.edges);
    expect(main.content).toBe('import "helper.srp" as helper;');
  });
});
