import {describe,expect,it} from 'vitest';
import {indexSymbolFile} from '../model/workspaceSymbols';
import {captureScarpFunctionInterfaces,displayInterfaceShape,sameInterfaceShape,MAX_INTERFACE_PARAMETERS,
  type ScarpInterfaceShape} from './scarpFunctionInterfaces';

function capture(content:string){
  const index=indexSymbolFile({id:'fixture',name:'fixture.srp',path:null,content,savedContent:content,revision:0});
  return captureScarpFunctionInterfaces(content,index.symbols);
}
function shape(content:string):ScarpInterfaceShape{
  const result=capture(content)[0]?.evidence;
  if(!result?.ok)throw Error('Missing interface shape: '+(result&&!result.ok?result.issue:'none'));
  return result.shape;
}
describe('canonical Scarp lexical function interfaces',()=>{
  it('captures typed parameters, visibility, pure modifier and return tokens',()=>{
    const value=shape('pub pure funcra calculate(a: integer, b: float) -> float { return b; }');
    expect(value).toEqual({name:'calculate',visibility:'public',pure:true,generic:[],
      parameters:[['a',':','integer'],['b',':','float']],returnType:['float'],nextContract:null});
    expect(displayInterfaceShape(value)).toBe('pub pure funcra calculate ( a : integer , b : float ) -> float');
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.parameters[0])).toBe(true);
    expect(JSON.stringify(value)).not.toContain('return b');
  });
  it('captures zero-parameter functions with an implicit lexical return',()=>{
    const value=shape('funcra no_args() { print("private body"); }');
    expect(value.parameters).toEqual([]);
    expect(value.returnType).toBeNull();
    expect(value.visibility).toBe('local');
    expect(JSON.stringify(value)).not.toContain('private body');
  });
  it('preserves generic constraints and nested type argument token sequences',()=>{
    const value=shape('pub funcra map<T: Numeric, U: Comparable>(x: array<tuple<T, U>, 2>) -> tuple<T, U> { }');
    expect(value.generic).toEqual(['<','T',':','Numeric',',','U',':','Comparable','>']);
    expect(value.parameters).toEqual([['x',':','array','<','tuple','<','T',',','U','>',',','2','>']]);
    expect(value.returnType).toEqual(['tuple','<','T',',','U','>']);
  });
  it('balances nested combined angle closers and tuple-shaped types',()=>{
    const value=shape('funcra nested(v: array<array<integer>>) -> tuple<array<integer>, boolean> { }');
    expect(value.parameters[0]).toEqual(['v',':','array','<','array','<','integer','>>']);
    expect(value.returnType).toEqual(['tuple','<','array','<','integer','>',',','boolean','>']);
  });
  it('ignores body content and comments when comparing captured shapes',()=>{
    const a=shape('pub funcra f(a: integer) -> integer { return a; }');
    const b=shape('pub // comment\r\nfuncra f(\r\n a : integer // another comment\n) -> integer { return 42; }');
    expect(sameInterfaceShape(a,b)).toBe(true);
    expect(sameInterfaceShape(a,shape('pub funcra f(a: float) -> integer { }'))).toBe(false);
    expect(sameInterfaceShape(a,shape('pub pure funcra f(a: integer) -> integer { }'))).toBe(false);
    expect(sameInterfaceShape(a,shape('pub funcra f(a: integer) -> float { }'))).toBe(false);
  });
  it('retains only the next contract keyword and never the expression',()=>{
    const value=shape('pub funcra guarded(x: integer) -> integer needs x > 0 ensures result > 0 { return x; }');
    expect(value.nextContract).toBe('needs');
    expect(value.returnType).toEqual(['integer']);
    expect(JSON.stringify(value)).not.toContain('result');
    expect(displayInterfaceShape(value)).toContain('needs …');
    const changed=shape('pub funcra guarded(x: integer) -> integer needs x > 500 { return x; }');
    expect(sameInterfaceShape(value,changed)).toBe(true);
  });
  it('does not include nested functions, string or comment declarations',()=>{
    const result=capture('// pub funcra hidden() {}\nbind text = "funcra fake()";\npub funcra outer() { funcra inner() {} }');
    expect(result).toHaveLength(1);
    expect(result[0].evidence).toMatchObject({ok:true,shape:{name:'outer'}});
  });
  it('marks unsupported untyped, default-expression and trailing-comma shapes',()=>{
    for(const source of [
      'funcra f(a) {}','funcra f(a: integer = 3) {}','funcra f(a: integer,) {}',
      'funcra f(a: array<integer) {}','funcra f(a: "private") {}','funcra f() -> {}',
    ]){
      const result=capture(source);
      expect(result).toHaveLength(1);
      expect(result[0].evidence.ok).toBe(false);
    }
  });
  it('bounds parameter count and token span',()=>{
    const parameters=Array.from({length:MAX_INTERFACE_PARAMETERS+1},(_,i)=>'p'+i+': integer').join(',');
    const result=capture('funcra too_many('+parameters+') {}');
    expect(result[0]?.evidence.ok).toBe(false);
    const long=capture('funcra too_long('+ ' '.repeat(2050)+'x: integer) {}');
    expect(long[0]?.evidence).toEqual({ok:false,issue:'header-limit'});
  });
});
