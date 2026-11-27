import { describe, expect, it } from 'vitest';
import {
  findOpenCodeReferences, scarpIdentifierAtCursor,
  currentReferenceNavigationTarget, countReferenceRoles, groupOpenCodeReferences,
  MAX_REFERENCE_FILES, MAX_REFERENCE_HITS,
} from './openCodeReferences';
import type { StudioDocument } from './documents';
const docs = (name:string, content:string, revision=0):StudioDocument => ({
  id:name,name,content,savedContent:content,revision,path:'C:/work/'+name,
});
const options = { caseSensitive:true, scope:'all' as const, activeId:null };

describe('code identifier extraction at a Monaco caret',()=>{
  it('extracts exact source token and supports caret immediately after it',()=>{
    const source = 'funcra run() { print(run()); }';
    expect(scarpIdentifierAtCursor(source,1,8)).toBe('run');
    expect(scarpIdentifierAtCursor(source,1,11)).toBe('run');
    expect(scarpIdentifierAtCursor(source,1,1)).toBe('funcra');
  });
  it('ignores comments, strings, whitespace and invalid cursor positions',()=>{
    const text = 'print("hello"); // TODO print\nrun();';
    expect(scarpIdentifierAtCursor(text,1,9)).toBeNull();
    expect(scarpIdentifierAtCursor(text,1,23)).toBeNull();
    expect(scarpIdentifierAtCursor(text,2,1)).toBe('run');
    expect(scarpIdentifierAtCursor(text,0,1)).toBeNull();
    expect(scarpIdentifierAtCursor(text,2,100)).toBeNull();
    expect(scarpIdentifierAtCursor(text,2,0)).toBeNull();
  });
  it('honors CRLF, CR and LF line boundaries',()=>{
    expect(scarpIdentifierAtCursor('alpha\r\nbeta\rgamma\ndelta',2,1))
      .toBe('beta');
    expect(scarpIdentifierAtCursor('alpha\r\nbeta\rgamma\ndelta',4,1))
      .toBe('delta');
  });
  it('does not extract an identifier from a huge buffer',()=>{
    expect(scarpIdentifierAtCursor('x'.repeat(512*1024+1),1,1)).toBeNull();
  });
});

describe('read-only lexical code references across open files',()=>{
  it('finds a function declaration and use but skips strings/comments',()=>{
    const document = docs('main.srp',
      'funcra helper() {}\nhelper();\n// helper();\nprint("helper");');
    const report = findOpenCodeReferences([document],'helper',options);
    expect(report.complete).toBe(true);
    expect(report.matches).toBe(2);
    expect(report.hits.map(h=>h.role)).toEqual(['declaration-like','usage']);
    expect(report.hits.map(h=>h.line)).toEqual([1,2]);
  });
  it('preserves language case sensitivity unless explicitly disabled',()=>{
    const source = docs('main.srp','Some();\nsome();\nSOME();');
    expect(findOpenCodeReferences([source],'some',options).matches).toBe(1);
    expect(findOpenCodeReferences([source],'some',
      {...options,caseSensitive:false}).matches).toBe(3);
  });
  it('supports active-only scope without reading other tabs',()=>{
    const list = [docs('a.srp','name();'),docs('b.srp','name();')];
    const report = findOpenCodeReferences(list,'name',
      {caseSensitive:true,scope:'active',activeId:'b.srp'});
    expect(report.hits).toHaveLength(1);
    expect(report.hits[0].documentId).toBe('b.srp');
    expect(report.searchedDocuments).toBe(1);
  });
  it('does not match an identifier as a substring of a longer identifier',()=>{
    const report = findOpenCodeReferences([docs('main.srp',
      'foobar(); foo(); foo_bar();')],'foo',options);
    expect(report.matches).toBe(1);
  });
  it('includes non-ASCII context without splitting a surrogate pair',()=>{
    const report = findOpenCodeReferences([docs('main.srp',
      'print("🚀");\nname();')],'name',options);
    expect(report.hits[0].line).toBe(2);
    expect(report.hits[0].preview).toContain('name');
  });
  it('flags unsupported query spelling instead of evaluating regex',()=>{
    for(const query of ['', 'foo-bar', '[abc]', '2name', 'x'.repeat(129)]) {
      const report = findOpenCodeReferences([docs('main.srp','foo();')],query,options);
      expect(report.error).not.toBeNull();
      expect(report.hits).toEqual([]);
    }
  });
  it('caps searched documents and identifies the report as incomplete',()=>{
    const documents = Array.from({length:MAX_REFERENCE_FILES+4},
      (_,i)=>docs('f'+i+'.srp','print(name);'));
    const report = findOpenCodeReferences(documents,'name',options);
    expect(report.complete).toBe(false);
    expect(report.searchedDocuments).toBe(MAX_REFERENCE_FILES);
    expect(report.skippedDocuments).toBe(4);
  });
  it('limits matching hits without hiding that the result was cut short',()=>{
    const document = docs('many.srp','name '.repeat(MAX_REFERENCE_HITS+10));
    const result = findOpenCodeReferences([document],'name',options);
    expect(result.matches).toBe(MAX_REFERENCE_HITS);
    expect(result.complete).toBe(false);
    expect(result.message).toContain('incomplete');
  });
  it('refuses oversized source buffers without analyzing hidden suffixes',()=>{
    const document = docs('huge.srp','x'.repeat(512*1024+1)+'name');
    const result = findOpenCodeReferences([document],'name',options);
    expect(result.matches).toBe(0);
    expect(result.complete).toBe(false);
    expect(result.skippedDocuments).toBeGreaterThan(0);
  });
  it('does not keep stale references navigable across revisions or close/reopen',()=>{
    const before = docs('main.srp','name();',1);
    const result = findOpenCodeReferences([before],'name',options);
    const hit = result.hits[0];
    expect(currentReferenceNavigationTarget(hit,[before])).toMatchObject({
      documentId:'main.srp',revision:1,line:1,column:1,
    });
    expect(currentReferenceNavigationTarget(hit,[docs('main.srp','name();',2)]))
      .toBeNull();
    expect(currentReferenceNavigationTarget(hit,[docs('main.srp','other();',1)]))
      .toBeNull();
    expect(currentReferenceNavigationTarget(hit,[])).toBeNull();
  });
  it('returns separate source groups and role counts without reordering hits',()=>{
    const list = [
      docs('a.srp','funcra name() {}\nname();'),
      docs('b.srp','name();'),
    ];
    const result = findOpenCodeReferences(list,'name',options);
    const groups = groupOpenCodeReferences(result.hits);
    expect(groups.map(g=>[g.documentName,g.hits.length]))
      .toEqual([['a.srp',2],['b.srp',1]]);
    expect(countReferenceRoles(result.hits)).toEqual({
      declarationLike:1,usages:2,
    });
    expect(result.hits.map(h=>h.documentName))
      .toEqual(['a.srp','a.srp','b.srp']);
  });
  it('produces deterministic results without changing editor content',()=>{
    const source = docs('main.srp','name();');
    const first = findOpenCodeReferences([source],'name',options);
    const second = findOpenCodeReferences([source],'name',options);
    expect(first).toEqual(second);
    expect(first.hits).not.toBe(second.hits);
    expect(source.content).toBe('name();');
  });
});


describe('reference coverage accounting and lexical boundaries',()=>{
  it('counts skipped and scanned buffers exactly when result limits and malformed files coexist',()=>{
    const list=[docs('bad.srp','"unclosed'),docs('many.srp','name '.repeat(MAX_REFERENCE_HITS+1)),docs('last.srp','other;')];
    const report=findOpenCodeReferences(list,'name',options);
    expect(report.matches).toBe(MAX_REFERENCE_HITS);
    expect(report.searchedDocuments).toBe(2);
    expect(report.skippedDocuments).toBe(1);
    expect(report.complete).toBe(false);
  });
  it('does not call exactly full results incomplete when the remaining buffers contain no matches',()=>{
    const report=findOpenCodeReferences([docs('a.srp','name '.repeat(MAX_REFERENCE_HITS)),docs('b.srp','other;')],'name',options);
    expect(report.matches).toBe(MAX_REFERENCE_HITS);
    expect(report.complete).toBe(true);
    expect(report.searchedDocuments).toBe(2);
  });
  it('skips malformed lexical sources and marks coverage incomplete',()=>{
    const report=findOpenCodeReferences([docs('bad.srp','name; "unfinished')],'name',options);
    expect(report).toMatchObject({complete:false,searchedDocuments:0,skippedDocuments:1,matches:0});
    expect(scarpIdentifierAtCursor('name; "unfinished',1,1)).toBeNull();
  });
  it('does not match unsupported non-ASCII-adjacent identifier fragments',()=>{
    const report=findOpenCodeReferences([docs('a.srp','अname nameअ name;')],'name',options);
    expect(report.matches).toBe(1);
    expect(report.complete).toBe(false);
    expect(scarpIdentifierAtCursor('अname',1,2)).toBeNull();
  });
  it('never splits supplementary scalars when bounding a long context preview',()=>{
    const name='x'.repeat(128);
    const source='print("'+ '😀'.repeat(50)+'"); '+name+'(); print("'+ '😀'.repeat(80)+'");';
    const report=findOpenCodeReferences([docs('a.srp',source)],name,options);
    const preview=report.hits[0].preview;
    expect(preview).toContain(name);
    expect(preview.length).toBeLessThanOrEqual(200);
    expect(new TextDecoder().decode(new TextEncoder().encode(preview))).toBe(preview);
  });
});
