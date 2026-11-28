import {describe,expect,it} from 'vitest';
import {captureScarpCallArguments,MAX_ARGUMENT_SCAN_TOKENS,MAX_ARGUMENT_NESTING} from './scarpCallArguments';
import {indexSymbolFile} from '../model/workspaceSymbols';
import {executeListedSymbolIndex} from '../model/listedSymbolIndex';
import {prepareProjectInspection} from '../model/projectInspection';
import {DEFAULT_PROJECT_SEARCH_SCOPE} from '../model/projectSearchScope';
import {buildArityReview,filterArityReview,groupArityByName,arityReviewText,DEFAULT_ARITY_FILTER} from '../model/listedCallArity';

function observe(content:string){
  const index=indexSymbolFile({id:'test',name:'main.srp',path:null,content,savedContent:content,revision:0});
  const observed=captureScarpCallArguments(content,index.calls);
  return index.calls.map((call,index)=>({name:call.name,...observed[index].evidence}));
}
function count(content:string,name:string){
  return observe(content).find(item=>item.name===name);
}
describe('lexical argument observation',()=>{
  it('counts empty, simple, nested and tuple/array positions without expressions',()=>{
    const source='funcra main() { f(); g(1, 2); h((1, 2), [3, 4], nested(5, 6)); }';
    expect(count(source,'f')).toMatchObject({ok:true,count:0});
    expect(count(source,'g')).toMatchObject({ok:true,count:2});
    expect(count(source,'h')).toMatchObject({ok:true,count:3});
    expect(count(source,'nested')).toMatchObject({ok:true,count:2});
  });
  it('does not count punctuation inside comments or ordinary/raw/multiline strings',()=>{
    const source='funcra main() { f("a,b)", r"c,d", """a,\nb)""", // ignored , )\n 5); }';
    const rows=observe(source);
    expect(rows.find(item=>item.name==='f')).toMatchObject({ok:true,count:4});
    expect(JSON.stringify(rows)).not.toContain('a,b');
  });
  it('counts explicit generic call suffixes and ignores nested generic commas',()=>{
    const source='funcra main() { f::<int, string>(g::<int, string>(1), 2); }';
    expect(count(source,'f')).toMatchObject({ok:true,count:2,explicitTypeCount:2});
    expect(count(source,'g')).toMatchObject({ok:true,count:1,explicitTypeCount:2});
  });
  it('does not treat relational operators as angle nesting',()=>{
    expect(count('funcra main() { f(x < y, x > z); }','f')).toMatchObject({ok:true,count:2});
  });
  it('reports unknown for empty and trailing positions',()=>{
    for(const source of ['f(,1);','f(1,,2);','f(1,);']){
      expect(count('funcra main() { '+source+' }','f')).toMatchObject({ok:false,issue:'empty-argument'});
    }
  });
  it('declines unbalanced delimiters, unsupported separators and incomplete literals',()=>{
    expect(count('funcra main() { f([1, 2)); }','f')).toMatchObject({ok:false});
    expect(count('funcra main() { f(name: 1); }','f')).toMatchObject({ok:false,issue:'unsupported-shape'});
    const valid='funcra main() { f(1); }';
    const indexed=indexSymbolFile({id:'test',name:'main.srp',path:null,content:valid,savedContent:valid,revision:0});
    expect(captureScarpCallArguments('funcra main() { f("unfinished); }',indexed.calls)[0]?.evidence).toMatchObject({ok:false,issue:'lexical-incomplete'});
  });
  it('limits both token traversal and nesting',()=>{
    expect(count('funcra main() { f('+Array(MAX_ARGUMENT_SCAN_TOKENS).fill('1 + ').join('')+'1); }','f')).toMatchObject({ok:false,issue:'argument-limit'});
    expect(count('funcra main() { f('+'('.repeat(MAX_ARGUMENT_NESTING+1)+'1'+')'.repeat(MAX_ARGUMENT_NESTING+1)+'); }','f')).toMatchObject({ok:false,issue:'argument-limit'});
  });
  it('does not capture qualified calls indexed as member access',()=>{
    const rows=observe('funcra main() { obj.f(1); f(1); }');
    expect(rows.filter(item=>item.name==='f')).toHaveLength(1);
  });
});

const control={isCurrent:()=>true,isCancelled:()=>false};
const entries=[{name:'a.srp',path:'C:/project/a.srp'},{name:'b.srp',path:'C:/project/b.srp'}];
async function report(a:string,b:string,capture=true,scope=DEFAULT_PROJECT_SEARCH_SCOPE){
  const plan=prepareProjectInspection(entries,{mode:'working',scope,listingLimited:false});
  if(!plan.ok)throw Error(plan.error);
  const result=await executeListedSymbolIndex(plan.value,[],async path=>path===entries[0].path?a:b,control,capture);
  if(result.kind!=='report')throw Error('Expected report');
  return result.report;
}
describe('listed candidate argument review',()=>{
  it('compares observed positional counts across selected files only with opt-in',async()=>{
    const a='pub funcra target(x: integer, y: integer) -> integer { return x; }';
    const b='funcra main() { target(1, 2); target(1); }';
    const result=await report(a,b);
    const review=buildArityReview(result);
    expect(review.available).toBe(true);
    expect(review.complete).toBe(true);
    const rows=review.rows.filter(row=>row.call.name==='target');
    expect(rows.map(row=>[row.count,row.expected,row.status])).toEqual([
      [2,2,'same-observed-count'],[1,2,'different-observed-count'],
    ]);
    expect(buildArityReview(await report(a,b,false)).available).toBe(false);
  });
  it('does not promote duplicate candidates or non-function spellings to count comparisons',async()=>{
    const result=await report('funcra same() {} funcra same(x: integer) {}','funcra main() { same(); }');
    expect(buildArityReview(result).rows.find(row=>row.call.name==='same')).toMatchObject({status:'multiple-declarations',expected:null});
    const shadow=await report('funcra same() {}','funcra main() { bind same = 1; same(); }');
    expect(buildArityReview(shadow).rows.find(row=>row.call.name==='same')).toMatchObject({status:'nested-or-shadowed',expected:null});
  });
  it('withholds comparisons for excluded or incomplete coverage',async()=>{
    const result=await report('funcra same() {}','funcra main() { same(); }');
    for(const changed of [{...result,complete:false},{...result,excluded:1}]){
      expect(buildArityReview(changed).rows.find(row=>row.call.name==='same')).toMatchObject({status:'coverage-incomplete',expected:null});
    }
  });
  it('reports unavailable evidence separately from absent candidates',async()=>{
    const result=await report('funcra same() {}','funcra main() { same(); other(); }');
    const review=buildArityReview({...result,interfaces:[]});
    expect(review.rows.find(row=>row.call.name==='same')).toMatchObject({status:'shape-unavailable'});
    expect(review.rows.find(row=>row.call.name==='other')).toMatchObject({status:'no-declaration'});
    const unavailable=buildArityReview({...result,callArguments:[]});
    expect(unavailable.rows.every(row=>row.status==='arguments-unavailable')).toBe(true);
  });
  it('filters, groups and discloses labels/spellings independently',async()=>{
    const result=await report('funcra privateName(x: integer) {}','funcra main() { privateName(); privateName(12345); }');
    const review=buildArityReview(result);
    expect(filterArityReview(review,{...DEFAULT_ARITY_FILTER,status:'different-observed-count'})).toHaveLength(1);
    expect(groupArityByName(review).find(group=>group.name==='privateName')?.observedCounts).toEqual([{count:0,calls:1},{count:1,calls:1}]);
    expect(arityReviewText(review)).not.toContain('privateName');
    expect(arityReviewText(review,true,false)).toContain('b.srp');
    expect(arityReviewText(review,true,false)).not.toContain('privateName');
    expect(arityReviewText(review,false,true)).toContain('privateName');
    expect(arityReviewText(review,true,true)).not.toContain('12345');
    expect(arityReviewText(review,true,true)).not.toContain('C:/');
  });
});
