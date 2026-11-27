import { describe,expect,it } from 'vitest';
import { genericParameterHeader,explicitTypeArguments,explicitCallOpenOffset,functionCallOpenIndex,
  MAX_GENERIC_HEADER_UNITS,MAX_GENERIC_PARAMETERS } from './genericSyntax';
import { scanScarpSource } from './sourceLex';
import { indexLocalFunctionHeaders,findLocalFunctionDefinition,scarpCallNameAtOffset } from './definition';
import { activeLocalCall,localSignatureAt } from './signature';
import { LocalSourceAnalysis } from './localAnalysis';
import { scanScarpOutlineSymbols } from './assist';
import { indexSymbolFile } from '../model/workspaceSymbols';
import { createUntitled } from '../model/documents';

const tokens=(value:string)=>scanScarpSource(value).tokens.filter(token=>token.kind!=='comment');
const generic='pure funcra pair<A, B: Comparable>(first: A, second: B) -> tuple<A, B> { return (first, second); }\n';
describe('published generic declaration syntax',()=>{
  it('parses bounded parameter names and supported constraints',()=>{
    const source='<T: Numeric, U, V: Comparable> (';
    expect(genericParameterHeader(tokens(source),0)).toEqual({labels:['T: Numeric','U','V: Comparable'],openIndex:11});
    const parsed=genericParameterHeader(tokens('<T,\n// note\nU> ('),0);
    expect(parsed?.labels).toEqual(['T','U']);
  });
  it.each(['<>(', '<T,T>(', '<T: Other>(', '<T: numeric>(', '<T,>(', '<T:>(', '<T>','<T+U>(', '<"T">('])('rejects unsupported header %s',source=>{
    expect(genericParameterHeader(tokens(source),0)).toBeNull();
  });
  it('rejects over-budget generic headers',()=>{
    const long='<'+Array.from({length:MAX_GENERIC_PARAMETERS+1},(_,i)=>'T'+i).join(',')+'>(';
    expect(genericParameterHeader(tokens(long),0)).toBeNull();
    expect(genericParameterHeader(tokens('<T'+' '.repeat(MAX_GENERIC_HEADER_UNITS)+'>('),0)).toBeNull();
  });
  it('retains original declaration offsets and does not leak generic fields into ordinary definition shape',()=>{
    const source='// café 🌍\r\n'+generic;
    const header=indexLocalFunctionHeaders(source)?.[0];
    expect(header).toMatchObject({name:'pair',line:2,typeParameters:['A','B: Comparable']});
    expect(source[header!.openOffset]).toBe('(');
    expect(findLocalFunctionDefinition(source,'pair')).toEqual({name:'pair',line:2,startColumn:13,endColumn:17});
    expect(scanScarpOutlineSymbols(source).map(symbol=>symbol.name)).toEqual(['pair']);
  });
  it('keeps duplicate generic and non-generic names ambiguous',()=>{
    expect(findLocalFunctionDefinition(generic+'funcra pair(a: integer) {}','pair')).toBeNull();
    expect(indexLocalFunctionHeaders(generic+'funcra pair<T: Unknown>(x: T) {}')).toBeNull();
  });
});
describe('explicit type arguments',()=>{
  it.each(['::<integer>(', '::<integer,string>(', '::<list<integer>>(', '::<map<string,list<integer>>>(',
    '::<array<integer,2>,option<string>>(', '::<pkg.Record,tuple<integer,string>>('])('recognizes %s',suffix=>{
    const parsed=explicitTypeArguments(tokens(suffix),0);
    expect(parsed?.endOffset).toBe(suffix.length-1);
    expect(explicitCallOpenOffset(suffix,0,suffix.length)).toBe(suffix.length-1);
  });
  it.each(['::<>()','::<integer,>(', '::<integer+string>(', '::<list<integer>>>(', '::<3>(', '::<"x">(',
    '::<integer>', '<integer>(', '::<integer>=('])('does not guess malformed or comparison syntax %s',suffix=>{
    expect(explicitTypeArguments(tokens(suffix),0)).toBeNull();
  });
  it('does not mistake type commas for value arguments or borrow a qualified inner call',()=>{
    for(const value of ['pair::<integer,string>(1, ','pair::<list<integer>,string>(1, ','pair(1, ']){
      expect(activeLocalCall(value,value.length)).toEqual({name:'pair',argument:1});
    }
    const qualified='pair(math.pair::<integer,string>(';
    expect(activeLocalCall(qualified,qualified.length)).toBeNull();
    const partial='pair(pair::<integer,';
    expect(activeLocalCall(partial,partial.length)).toBeNull();
  });
  it('does not resolve comparisons, qualified calls, constructor names or declaration names',()=>{
    for(const source of ['x < integer > (1)','math.pair::<integer,string>(1,2)','new Choice::pair::<integer>(1)',
      'funcra pair<T>(value: T) {}','"pair::<integer>(1)"']){
      const at=source.includes('pair')?source.indexOf('pair'):source.indexOf('x');
      expect(scarpCallNameAtOffset(source,at)).toBeNull();
    }
    expect(functionCallOpenIndex(tokens('pair::<integer,string>(1,2)'),0)).not.toBeNull();
  });
});
describe('generic editor provider integration',()=>{
  it('provides lexical generic hover, completion and signature labels without substituting inferred types',()=>{
    const source=generic+'pair::<integer,string>(1, "x");';
    const analysis=new LocalSourceAnalysis(source);
    const offset=source.lastIndexOf('pair');
    expect(analysis.definition(offset)?.name).toBe('pair');
    expect(analysis.hover(offset)?.label).toBe('pair<A, B: Comparable>(first: A, second: B)');
    expect(analysis.signature(source.lastIndexOf('"x"'))?.activeParameter).toBe(1);
    expect(analysis.complete(offset,offset+4,'pa',new Set())[0]).toEqual({
      name:'pair',detail:'pair<A, B: Comparable>(first: A, second: B)',
    });
    expect(localSignatureAt(source,source.indexOf('1, "x"'))?.activeParameter).toBe(0);
  });
  it('keeps generic source calls distinct from strings and declaration headers',()=>{
    const source=generic+'pair::<integer,string>(1,"x");\nprint("pair::<integer>(1)");\nmodule.pair::<integer,string>(1,"x");';
    const index=indexSymbolFile({...createUntitled(1),content:source});
    expect(index.symbols.filter(symbol=>symbol.kind==='function').map(symbol=>symbol.name)).toEqual(['pair']);
    expect(index.calls.filter(call=>call.name==='pair')).toHaveLength(1);
    expect(source.slice(index.calls.find(call=>call.name==='pair')!.offset,index.calls.find(call=>call.name==='pair')!.end)).toBe('pair');
  });
  it('decorates explicit generic calls using their declared value parameters only',()=>{
    const source=generic+'pair::<integer,string>(1, "x");';
    const analysis=new LocalSourceAnalysis(source);
    expect(analysis.parameterInlays('literals',false)).toEqual([
      {offset:source.lastIndexOf('1,'),label:'first'},
      {offset:source.lastIndexOf('"x"'),label:'second'},
    ]);
  });
});
