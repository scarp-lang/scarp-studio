import { describe, expect, it } from 'vitest';
import {
  MAX_ARCHITECTURE_QUERY_RESULTS,
  MAX_ARCHITECTURE_QUERY_TERMS,
  MAX_ARCHITECTURE_QUERY_TOKEN_UNITS,
  MAX_ARCHITECTURE_QUERY_UNITS,
  architectureQueryHelp,
  buildArchitectureSearchItems,
  parseArchitectureQuery,
  searchWorkspaceArchitecture,
} from './workspaceArchitectureQuery';
import {
  ambiguousCallFixture,
  importChainFixture,
  smallArchitectureFixture,
} from '../test/workspaceArchitectureFixtures';

describe('architecture query parser', () => {
  it('parses plain terms as unscoped case-insensitive terms', () => {
    const parsed = parseArchitectureQuery('render service');
    expect(parsed.complete).toBe(true);
    expect(parsed.issues).toEqual([]);
    expect(parsed.terms).toEqual([
      expect.objectContaining({ value: 'render', field: null, negated: false, quoted: false }),
      expect.objectContaining({ value: 'service', field: null, negated: false, quoted: false }),
    ]);
  });

  it('parses recognized field qualifiers', () => {
    const parsed = parseArchitectureQuery('kind:symbol name:render file:util symbol:function');
    expect(parsed.issues).toEqual([]);
    expect(parsed.terms.map(item => [item.field, item.value])).toEqual([
      ['kind', 'symbol'], ['name', 'render'], ['file', 'util'], ['symbol', 'function'],
    ]);
  });

  it('parses boolean and numeric predicates as field values', () => {
    const parsed = parseArchitectureQuery('pure:true cycle:false incoming:>=3 outgoing:<10');
    expect(parsed.issues).toEqual([]);
    expect(parsed.terms.map(item => [item.field, item.value])).toEqual([
      ['pure', 'true'], ['cycle', 'false'], ['incoming', '>=3'], ['outgoing', '<10'],
    ]);
  });

  it('parses risk comparison predicates', () => {
    const parsed = parseArchitectureQuery('risk:>=high');
    expect(parsed.terms).toHaveLength(1);
    expect(parsed.terms[0]).toMatchObject({ field: 'risk', value: '>=high' });
  });

  it('supports negated terms and negated field filters', () => {
    const parsed = parseArchitectureQuery('-test -kind:import name:render');
    expect(parsed.terms.map(item => item.negated)).toEqual([true, true, false]);
    expect(parsed.terms[1].field).toBe('kind');
  });

  it('supports quoted values with whitespace', () => {
    const parsed = parseArchitectureQuery('file:"src/service.srp" name:"public entry"');
    expect(parsed.issues).toEqual([]);
    expect(parsed.terms[0]).toMatchObject({ field: 'file', value: 'src/service.srp', quoted: true });
    expect(parsed.terms[1]).toMatchObject({ field: 'name', value: 'public entry', quoted: true });
  });

  it('supports escaped quotes and backslashes inside quoted values', () => {
    const parsed = parseArchitectureQuery('name:"hello \\"world\\"" file:"a\\\\b"');
    expect(parsed.issues).toEqual([]);
    expect(parsed.terms[0].value).toBe('hello "world"');
    expect(parsed.terms[1].value).toBe('a\\b');
  });

  it('reports an unterminated quoted token', () => {
    const parsed = parseArchitectureQuery('name:"unfinished');
    expect(parsed.complete).toBe(false);
    expect(parsed.issues.some(issue => /quote/i.test(issue.message))).toBe(true);
  });

  it('reports an unknown field instead of silently treating it as plain text', () => {
    const parsed = parseArchitectureQuery('unknown:value');
    expect(parsed.complete).toBe(false);
    expect(parsed.issues.some(issue => /field/i.test(issue.message))).toBe(true);
  });

  it('reports empty field values', () => {
    const parsed = parseArchitectureQuery('kind: name:render');
    expect(parsed.complete).toBe(false);
    expect(parsed.issues.length).toBeGreaterThan(0);
  });

  it('bounds source length without throwing on huge user input', () => {
    const parsed = parseArchitectureQuery('x'.repeat(MAX_ARCHITECTURE_QUERY_UNITS + 100));
    expect(parsed.source.length).toBeLessThanOrEqual(MAX_ARCHITECTURE_QUERY_UNITS);
    expect(parsed.complete).toBe(false);
    expect(parsed.issues.length).toBeGreaterThan(0);
  });

  it('bounds the number of parsed terms', () => {
    const parsed = parseArchitectureQuery(Array.from({ length: MAX_ARCHITECTURE_QUERY_TERMS + 8 }, (_, index) => 'x' + index).join(' '));
    expect(parsed.terms.length).toBeLessThanOrEqual(MAX_ARCHITECTURE_QUERY_TERMS);
    expect(parsed.complete).toBe(false);
  });

  it('bounds individual token values', () => {
    const parsed = parseArchitectureQuery('name:' + 'a'.repeat(MAX_ARCHITECTURE_QUERY_TOKEN_UNITS + 20));
    expect(parsed.terms[0].value.length).toBeLessThanOrEqual(MAX_ARCHITECTURE_QUERY_TOKEN_UNITS);
  });

  it('keeps empty and whitespace-only queries valid', () => {
    for (const input of ['', ' ', '\t\n']) {
      const parsed = parseArchitectureQuery(input);
      expect(parsed.complete).toBe(true);
      expect(parsed.terms).toEqual([]);
      expect(parsed.issues).toEqual([]);
    }
  });
});

describe('architecture search item construction', () => {
  it('creates module, symbol, call, import, cycle and hotspot item families', () => {
    const { architecture } = smallArchitectureFixture();
    const items = buildArchitectureSearchItems(architecture);
    const kinds = new Set(items.map(item => item.kind));

    expect(kinds).toContain('module');
    expect(kinds).toContain('symbol');
    expect(kinds).toContain('call');
    expect(kinds).toContain('import');
    expect(kinds).toContain('cycle');
    expect(kinds).toContain('hotspot');
  });

  it('copies structural metadata needed by field filters', () => {
    const { architecture } = smallArchitectureFixture();
    const items = buildArchitectureSearchItems(architecture);
    const load = items.find(item => item.kind === 'symbol' && item.name === 'load')!;

    expect(load.symbolKind).toBe('function');
    expect(load.scope).toBe('top-level');
    expect(load.file).toContain('service');
    expect(load.moduleId).not.toBeNull();
    expect(load.symbolId).not.toBeNull();
  });

  it('copies call candidate status onto call items', () => {
    const { architecture } = ambiguousCallFixture();
    const call = buildArchitectureSearchItems(architecture).find(item => item.kind === 'call' && item.name === 'calculate')!;
    expect(call.callStatus).toBe('multiple-candidates');
  });

  it('copies import status onto import items', () => {
    const { architecture } = smallArchitectureFixture();
    const item = buildArchitectureSearchItems(architecture).find(entry => entry.kind === 'import')!;
    expect(item.importStatus).toBe('open');
  });

  it('marks cycle search items as cyclic', () => {
    const { architecture } = smallArchitectureFixture();
    const cycles = buildArchitectureSearchItems(architecture).filter(item => item.kind === 'cycle');
    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles.every(item => item.cyclic)).toBe(true);
  });

  it('includes risk and edge counts on hotspot items', () => {
    const { architecture } = smallArchitectureFixture();
    const hotspots = buildArchitectureSearchItems(architecture).filter(item => item.kind === 'hotspot');
    for (const hotspot of hotspots) {
      expect(hotspot.risk).not.toBeNull();
      expect(hotspot.incoming).toBeGreaterThanOrEqual(0);
      expect(hotspot.outgoing).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('architecture free-text search', () => {
  it('finds a declaration by name', () => {
    const { architecture } = smallArchitectureFixture();
    const result = searchWorkspaceArchitecture(architecture, 'normalize');
    expect(result.matches.some(match => match.item.kind === 'symbol' && match.item.name === 'normalize')).toBe(true);
  });

  it('finds a module by listed path text', () => {
    const { architecture } = smallArchitectureFixture();
    const result = searchWorkspaceArchitecture(architecture, 'src/service');
    expect(result.matches.some(match => match.item.kind === 'module' && match.item.file === 'src/service.srp')).toBe(true);
  });

  it('requires all positive plain terms to match the item search surface', () => {
    const { architecture } = smallArchitectureFixture();
    const result = searchWorkspaceArchitecture(architecture, 'load service');
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches.every(match => match.item.searchable.toLowerCase().includes('load') &&
      match.item.searchable.toLowerCase().includes('service'))).toBe(true);
  });

  it('excludes negated plain terms', () => {
    const { architecture } = smallArchitectureFixture();
    const result = searchWorkspaceArchitecture(architecture, 'render -alt');
    expect(result.matches.some(match => match.item.file.includes('util'))).toBe(true);
    expect(result.matches.every(match => !match.item.searchable.toLowerCase().includes('alt'))).toBe(true);
  });

  it('matches text case-insensitively', () => {
    const { architecture } = smallArchitectureFixture();
    const lower = searchWorkspaceArchitecture(architecture, 'service');
    const upper = searchWorkspaceArchitecture(architecture, 'SERVICE');
    expect(upper.matches.map(item => item.item.id)).toEqual(lower.matches.map(item => item.item.id));
  });
});

describe('architecture field filters', () => {
  it('filters by item kind', () => {
    const { architecture } = smallArchitectureFixture();
    for (const kind of ['module', 'symbol', 'call', 'import', 'cycle', 'hotspot'] as const) {
      const result = searchWorkspaceArchitecture(architecture, 'kind:' + kind);
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches.every(match => match.item.kind === kind)).toBe(true);
    }
  });

  it('filters by declaration symbol kind', () => {
    const { architecture } = smallArchitectureFixture();
    const functions = searchWorkspaceArchitecture(architecture, 'symbol:function');
    expect(functions.matches.length).toBeGreaterThan(0);
    expect(functions.matches.every(match => match.item.symbolKind === 'function')).toBe(true);

    const records = searchWorkspaceArchitecture(architecture, 'symbol:record');
    expect(records.matches.some(match => match.item.name === 'Payload')).toBe(true);
    expect(records.matches.every(match => match.item.symbolKind === 'record')).toBe(true);
  });

  it('filters by exact lexical scope', () => {
    const { architecture } = smallArchitectureFixture();
    const result = searchWorkspaceArchitecture(architecture, 'scope:top-level kind:symbol');
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches.every(match => match.item.scope === 'top-level')).toBe(true);
  });

  it('filters by public visibility', () => {
    const { architecture } = smallArchitectureFixture();
    const result = searchWorkspaceArchitecture(architecture, 'visibility:public kind:symbol');
    expect(result.matches.some(match => match.item.name === 'load')).toBe(true);
    expect(result.matches.some(match => match.item.name === 'public_entry')).toBe(true);
    expect(result.matches.every(match => match.item.visibility === 'public')).toBe(true);
  });

  it('filters by pure boolean without coercing unknown text', () => {
    const { architecture } = smallArchitectureFixture();
    const falseResult = searchWorkspaceArchitecture(architecture, 'pure:false kind:symbol');
    expect(falseResult.matches.length).toBeGreaterThan(0);
    expect(falseResult.matches.every(match => match.item.pure === false)).toBe(true);

    const invalid = searchWorkspaceArchitecture(architecture, 'pure:maybe');
    expect(invalid.matches).toHaveLength(0);
  });

  it('filters ambiguous call statuses', () => {
    const { architecture } = ambiguousCallFixture();
    const result = searchWorkspaceArchitecture(architecture, 'status:multiple-candidates');
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches.every(match => match.item.callStatus === 'multiple-candidates')).toBe(true);
  });

  it('filters open import statuses', () => {
    const { architecture } = smallArchitectureFixture();
    const result = searchWorkspaceArchitecture(architecture, 'kind:import status:open');
    expect(result.matches).toHaveLength(architecture.importEdges.filter(edge => edge.status === 'open').length);
  });

  it('filters cycle membership', () => {
    const { architecture } = smallArchitectureFixture();
    const cyclic = searchWorkspaceArchitecture(architecture, 'cycle:true');
    expect(cyclic.matches.length).toBeGreaterThan(0);
    expect(cyclic.matches.every(match => match.item.cyclic)).toBe(true);

    const acyclic = searchWorkspaceArchitecture(architecture, 'kind:module cycle:false');
    expect(acyclic.matches.every(match => !match.item.cyclic)).toBe(true);
  });

  it('filters by file text without requiring a native absolute path', () => {
    const { architecture } = smallArchitectureFixture();
    const result = searchWorkspaceArchitecture(architecture, 'file:util');
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches.every(match => match.item.file.toLowerCase().includes('util'))).toBe(true);
  });

  it('filters by item name text', () => {
    const { architecture } = smallArchitectureFixture();
    const result = searchWorkspaceArchitecture(architecture, 'name:render');
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches.every(match => match.item.name.toLowerCase().includes('render'))).toBe(true);
  });
});

describe('architecture numeric and risk predicates', () => {
  it('supports incoming comparisons', () => {
    const { architecture } = smallArchitectureFixture();
    const atLeastOne = searchWorkspaceArchitecture(architecture, 'incoming:>=1');
    expect(atLeastOne.matches.length).toBeGreaterThan(0);
    expect(atLeastOne.matches.every(match => match.item.incoming >= 1)).toBe(true);

    const zero = searchWorkspaceArchitecture(architecture, 'incoming:=0');
    expect(zero.matches.every(match => match.item.incoming === 0)).toBe(true);
  });

  it('supports outgoing comparisons', () => {
    const { architecture } = smallArchitectureFixture();
    const positive = searchWorkspaceArchitecture(architecture, 'outgoing:>0');
    expect(positive.matches.length).toBeGreaterThan(0);
    expect(positive.matches.every(match => match.item.outgoing > 0)).toBe(true);

    const small = searchWorkspaceArchitecture(architecture, 'outgoing:<=1');
    expect(small.matches.every(match => match.item.outgoing <= 1)).toBe(true);
  });

  it('supports exact numeric values without an explicit equals sign', () => {
    const { architecture } = smallArchitectureFixture();
    const result = searchWorkspaceArchitecture(architecture, 'incoming:0');
    expect(result.matches.every(match => match.item.incoming === 0)).toBe(true);
  });

  it('returns no matches for malformed numeric predicates', () => {
    const { architecture } = smallArchitectureFixture();
    expect(searchWorkspaceArchitecture(architecture, 'incoming:many').matches).toEqual([]);
    expect(searchWorkspaceArchitecture(architecture, 'outgoing:>=-1').matches).toEqual([]);
  });

  it('supports risk thresholds in ascending severity order', () => {
    const { architecture } = smallArchitectureFixture();
    const high = searchWorkspaceArchitecture(architecture, 'risk:>=high kind:hotspot');
    expect(high.matches.every(match => match.item.risk === 'high' || match.item.risk === 'critical')).toBe(true);

    const lowOrMedium = searchWorkspaceArchitecture(architecture, 'risk:<=medium kind:hotspot');
    expect(lowOrMedium.matches.every(match => match.item.risk === 'low' || match.item.risk === 'medium')).toBe(true);
  });

  it('supports exact risk labels', () => {
    const { architecture } = smallArchitectureFixture();
    for (const risk of ['low', 'medium', 'high', 'critical'] as const) {
      const result = searchWorkspaceArchitecture(architecture, 'risk:' + risk + ' kind:hotspot');
      expect(result.matches.every(match => match.item.risk === risk)).toBe(true);
    }
  });
});

describe('architecture search ranking and bounds', () => {
  it('ranks exact or strong name matches ahead of incidental detail matches', () => {
    const { architecture } = smallArchitectureFixture();
    const result = searchWorkspaceArchitecture(architecture, 'render');
    const symbolIndex = result.matches.findIndex(match => match.item.kind === 'symbol' && match.item.name === 'render');
    const incidentalIndex = result.matches.findIndex(match => match.item.name !== 'render');
    expect(symbolIndex).toBeGreaterThanOrEqual(0);
    if (incidentalIndex >= 0) expect(symbolIndex).toBeLessThan(incidentalIndex);
  });

  it('adds risk weight when an empty query browses hotspots', () => {
    const { architecture } = smallArchitectureFixture();
    const result = searchWorkspaceArchitecture(architecture, '', ['hotspot']);
    for (let index = 1; index < result.matches.length; index++) {
      expect(result.matches[index - 1].score).toBeGreaterThanOrEqual(result.matches[index].score);
    }
  });

  it('restricts result families through the explicit kinds argument', () => {
    const { architecture } = smallArchitectureFixture();
    const result = searchWorkspaceArchitecture(architecture, '', ['module', 'symbol']);
    expect(result.matches.every(match => match.item.kind === 'module' || match.item.kind === 'symbol')).toBe(true);
  });

  it('returns no matches when the allowed kind set is empty', () => {
    const { architecture } = smallArchitectureFixture();
    expect(searchWorkspaceArchitecture(architecture, '', []).matches).toEqual([]);
  });

  it('caps displayed matches and reports truncation', () => {
    const { architecture } = importChainFixture(24, false);
    const result = searchWorkspaceArchitecture(architecture, '');
    expect(result.matches.length).toBeLessThanOrEqual(MAX_ARCHITECTURE_QUERY_RESULTS);
    expect(result.totalMatches).toBeGreaterThanOrEqual(result.matches.length);
    expect(result.truncated).toBe(result.totalMatches > MAX_ARCHITECTURE_QUERY_RESULTS);
  });

  it('provides non-overlapping label highlight ranges for plain search text', () => {
    const { architecture } = smallArchitectureFixture();
    const result = searchWorkspaceArchitecture(architecture, 'render');
    for (const match of result.matches.filter(item => item.item.label.toLowerCase().includes('render'))) {
      expect(match.highlights.length).toBeGreaterThan(0);
      for (let index = 1; index < match.highlights.length; index++) {
        expect(match.highlights[index - 1].end).toBeLessThanOrEqual(match.highlights[index].start);
      }
    }
  });

  it('does not create highlights for negative terms', () => {
    const { architecture } = smallArchitectureFixture();
    const result = searchWorkspaceArchitecture(architecture, '-missing render');
    for (const match of result.matches) {
      const highlighted = match.highlights.map(range => match.item.label.slice(range.start, range.end).toLowerCase());
      expect(highlighted.some(text => text.includes('missing'))).toBe(false);
    }
  });
});

describe('architecture query help', () => {
  it('documents field, negation, cycle and numeric query capabilities', () => {
    const help = architectureQueryHelp().join('\n');
    expect(help).toContain('kind:');
    expect(help).toContain('risk:');
    expect(help).toContain('incoming:');
    expect(help).toContain('Prefix');
    expect(help).toContain('cycle:true');
  });
});
