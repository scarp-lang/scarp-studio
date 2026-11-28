import {describe,expect,it} from 'vitest';
import type {StudioDocument} from './documents';
import {buildSourceBreadcrumbIndex,activeSourceBreadcrumbs,breadcrumbOffset,currentBreadcrumbTarget} from './sourceBreadcrumbs';

const doc=(content:string,revision=1):StudioDocument=>({id:'test',name:'test.srp',path:null,content,savedContent:'',revision});
const source=[
  'funcra outer(x: integer) -> integer {',
  '  funcra inner(y: integer) -> integer {',
  '    return y;',
  '  }',
  '  return inner(x);',
  '}',
  'funcra other() {',
  '  print("fake } {"); // funcra fake() {}',
  '}',
  '',
].join('\n');
describe('source breadcrumb indexing',()=>{
  it('finds completed function ranges in nesting order',()=>{
    const index=buildSourceBreadcrumbIndex(doc(source));
    expect(index.ranges.map(item=>item.name)).toEqual(['outer','inner','other']);
    expect(activeSourceBreadcrumbs(index,3,8).map(item=>item.name)).toEqual(['outer','inner']);
    expect(activeSourceBreadcrumbs(index,5,8).map(item=>item.name)).toEqual(['outer']);
    expect(activeSourceBreadcrumbs(index,8,8).map(item=>item.name)).toEqual(['other']);
    expect(activeSourceBreadcrumbs(index,10,1)).toEqual([]);
  });
  it('ignores declaration-looking text in strings and comments',()=>{
    const index=buildSourceBreadcrumbIndex(doc('// funcra hidden() {}\nfuncra real() { print("funcra fake() {}"); }'));
    expect(index.ranges.map(item=>item.name)).toEqual(['real']);
  });
  it('recognizes record and variant declaration bodies',()=>{
    const index=buildSourceBreadcrumbIndex(doc('record Point { x: integer; }\nvariant Choice { A; B; }'));
    expect(index.ranges.map(item=>[item.name,item.kind])).toEqual([['Point','record'],['Choice','variant']]);
  });
  it('recognizes a generic function parameter header',()=>{
    const index=buildSourceBreadcrumbIndex(doc('funcra identity<T>(x: T) -> T { return x; }'));
    expect(index.ranges.map(item=>item.name)).toEqual(['identity']);
  });
  it('withholds unfinished or mismatched ranges',()=>{
    const incomplete=buildSourceBreadcrumbIndex(doc('funcra complete() {}\nfuncra unfinished() {'));
    expect(incomplete.complete).toBe(false);
    expect(incomplete.ranges.map(item=>item.name)).toEqual(['complete']);
    const malformed=buildSourceBreadcrumbIndex(doc('funcra wrong() { ] }'));
    expect(malformed.complete).toBe(false);
    expect(malformed.ranges).toEqual([]);
  });
  it('does not use a following declaration body for a header without a body',()=>{
    const index=buildSourceBreadcrumbIndex(doc('funcra prototype();\nfuncra real() { }'));
    expect(index.ranges.map(item=>item.name)).toEqual(['real']);
    expect(index.complete).toBe(false);
  });
  it('does not infer scopes inside broken string literals',()=>{
    const index=buildSourceBreadcrumbIndex(doc('funcra first() {}\nprint("unfinished'));
    expect(index.complete).toBe(false);
    expect(index.ranges).toEqual([]);
  });
  it('bounds large source analysis',()=>{
    const index=buildSourceBreadcrumbIndex(doc('x'.repeat(512*1024+1)));
    expect(index.complete).toBe(false);
    expect(index.ranges).toEqual([]);
  });
});
describe('breadcrumb coordinates and navigation',()=>{
  it('uses Monaco-compatible UTF-16 and mixed line separators',()=>{
    const text='a\r\n🙂b\rc\n';
    expect(breadcrumbOffset(text,1,2)).toBe(1);
    expect(breadcrumbOffset(text,2,3)).toBe(5);
    expect(breadcrumbOffset(text,3,1)).toBe(7);
    expect(breadcrumbOffset(text,4,1)).toBe(text.length);
    expect(breadcrumbOffset(text,2,5)).toBeNull();
    expect(breadcrumbOffset(text,5,1)).toBeNull();
  });
  it('rejects invalid coordinate values',()=>{
    for(const n of [0,-1,NaN,Infinity,1.5]){
      expect(breadcrumbOffset('abc',n,1)).toBeNull();
      expect(breadcrumbOffset('abc',1,n)).toBeNull();
    }
  });
  it('returns exact declaration name coordinates and rejects stale generation',()=>{
    const document=doc(source);
    const index=buildSourceBreadcrumbIndex(document);
    const inner=index.ranges[1];
    expect(currentBreadcrumbTarget(index,document,inner)).toEqual({
      documentId:document.id,revision:1,source,line:2,column:10,
    });
    expect(currentBreadcrumbTarget(index,doc(source,2),inner)).toBeNull();
    expect(currentBreadcrumbTarget(index,doc(source+' '),inner)).toBeNull();
    expect(currentBreadcrumbTarget(index,document,{...inner})).toBeNull();
  });
});
