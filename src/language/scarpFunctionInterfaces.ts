import {scanScarpSource,scarpInsightIdentifier,type InsightToken} from './sourceLex';
import {functionHeaderOpenIndex} from './genericSyntax';
import type {WorkspaceSymbol} from '../model/workspaceSymbols';

export const MAX_INTERFACE_TOKENS=256;
export const MAX_INTERFACE_UNITS=2048;
export const MAX_INTERFACE_PARAMETERS=64;
export type InterfaceIssue='lexical-incomplete'|'missing-header'|'header-limit'|'unsupported-shape';
export const INTERFACE_ISSUE_LABELS:Readonly<Record<InterfaceIssue,string>>=Object.freeze({
  'lexical-incomplete':'Lexical source incomplete','missing-header':'Recognized declaration header unavailable',
  'header-limit':'Function interface budget reached','unsupported-shape':'Unsupported lexical interface shape',
});
export interface ScarpInterfaceShape{
  readonly name:string;
  readonly visibility:'public'|'local';
  readonly pure:boolean;
  readonly generic:readonly string[];
  readonly parameters:readonly (readonly string[])[];
  readonly returnType:readonly string[]|null;
  /** Only the first following contract keyword is observed. No expression is stored. */
  readonly nextContract:'needs'|'ensures'|null;
}
export type InterfaceShapeEvidence={readonly ok:true;readonly shape:ScarpInterfaceShape}|
  {readonly ok:false;readonly issue:InterfaceIssue};
const fail=(issue:InterfaceIssue):InterfaceShapeEvidence=>Object.freeze({ok:false,issue});
const allowedOperator=new Set([':', '::', '.', '<','>','>>','?', '&','*','->']);
const allowedDelimiter=new Set(['(',')','[',']',',']);
function validShapeToken(token:InsightToken):boolean{
  if(token.previewTruncated)return false;
  if(token.kind==='identifier')return scarpInsightIdentifier(token.text);
  if(token.kind==='number')return /^[0-9]+$/.test(token.text);
  if(token.kind==='operator')return allowedOperator.has(token.text);
  return token.kind==='delimiter'&&allowedDelimiter.has(token.text);
}
const openToClose:Readonly<Record<string,string>>=Object.freeze({'(' : ')','[':']','<':'>'});
const closers=new Set([')',']','>','>>']);
function updateStack(stack:string[],token:string):boolean{
  if(Object.hasOwn(openToClose,token)){stack.push(openToClose[token]);return stack.length<=32;}
  if(token==='>>')return stack.pop()==='>'&&stack.pop()==='>';
  if(closers.has(token))return stack.pop()===token;
  return true;
}
function tokenTexts(tokens:readonly InsightToken[]):readonly string[]{
  return Object.freeze(tokens.map(token=>token.text));
}
function parameterShape(tokens:readonly InsightToken[]):boolean{
  // Conservative typed parameter shape. No default expressions or patterns
  // are inferred. Generic and tuple type tokens may nest after the colon.
  const colon=tokens.findIndex(token=>token.text===':');
  return colon===1&&tokens[0]?.kind==='identifier'&&tokens.length>2&&tokens.slice(2).every(validShapeToken);
}

/** Capture a canonical lexical shape only. Whitespace and comments do not
 * affect the shape; parameter and type tokens do. No body, contract
 * expression, native path, or arbitrary string literal enters the result.
 */
function parseInterface(tokens:readonly InsightToken[],nameIndex:number,symbol:WorkspaceSymbol):InterfaceShapeEvidence{
  const name=tokens[nameIndex];
  if(!name||name.kind!=='identifier'||name.text!==symbol.name||name.start!==symbol.offset||
    tokens[nameIndex-1]?.text!=='funcra')return fail('missing-header');
  const open=functionHeaderOpenIndex(tokens,nameIndex);
  if(open===null)return fail('unsupported-shape');
  const within=(index:number)=>index-nameIndex<=MAX_INTERFACE_TOKENS&&!!tokens[index]&&
    tokens[index].end-name.start<=MAX_INTERFACE_UNITS;
  if(!within(open))return fail('header-limit');
  const generic=tokens.slice(nameIndex+1,open);
  if(generic.some(token=>!validShapeToken(token)))return fail('unsupported-shape');
  const parameters:(readonly string[])[]=[];
  let index=open+1,start=index;
  const stack:string[]=[];
  while(within(index)){
    const token=tokens[index];
    if(stack.length===0&&(token.text===','||token.text===')')){
      const part=tokens.slice(start,index);
      if(part.length){
        if(parameters.length>=MAX_INTERFACE_PARAMETERS)return fail('header-limit');
        if(!parameterShape(part))return fail('unsupported-shape');
        parameters.push(tokenTexts(part));
      }else if(token.text===','||parameters.length>0)return fail('unsupported-shape');
      if(token.text===')')break;
      start=index+1;index++;continue;
    }
    if(!validShapeToken(token)||!updateStack(stack,token.text))return fail('unsupported-shape');
    index++;
  }
  if(!within(index))return fail('header-limit');
  if(tokens[index].text!==')'||stack.length)return fail('unsupported-shape');
  index++;
  let returnType:readonly string[]|null=null;
  if(!within(index))return fail('header-limit');
  if(tokens[index].text==='->'){
    index++;const from=index;
    while(within(index)){
      const token=tokens[index];
      if(!stack.length&&(token.text==='{'||token.text==='needs'||token.text==='ensures'))break;
      if(!validShapeToken(token)||!updateStack(stack,token.text))return fail('unsupported-shape');
      index++;
    }
    if(!within(index))return fail('header-limit');
    if(index===from||stack.length)return fail('unsupported-shape');
    returnType=tokenTexts(tokens.slice(from,index));
  }
  if(!within(index))return fail('header-limit');
  const following=tokens[index].text;
  if(following!=='{'&&following!=='needs'&&following!=='ensures')return fail('unsupported-shape');
  return Object.freeze({ok:true,shape:Object.freeze({
    name:symbol.name,visibility:symbol.visibility,pure:symbol.pure,generic:tokenTexts(generic),
    parameters:Object.freeze(parameters),returnType,nextContract:following==='{'?null:following,
  })});
}
export interface IndexedInterfaceEvidence{
  readonly offset:number;
  readonly evidence:InterfaceShapeEvidence;
}
/** One lexical pass per source, with O(tokens + declarations) offset lookup.
 * A partial lexical scan cannot authorize a definitive interface shape.
 */
export function captureScarpFunctionInterfaces(content:string,symbols:readonly WorkspaceSymbol[]):readonly IndexedInterfaceEvidence[]{
  const functions=symbols.filter(symbol=>symbol.kind==='function'&&symbol.scope==='top-level');
  if(!functions.length)return Object.freeze([]);
  const lexical=scanScarpSource(content);
  const complete=lexical.complete&&lexical.issues.length===0;
  const tokens=lexical.tokens.filter(token=>token.kind!=='comment');
  const byOffset=new Map(tokens.map((token,index)=>[token.start,index]));
  return Object.freeze(functions.map(symbol=>Object.freeze({
    offset:symbol.offset,evidence:!complete?fail('lexical-incomplete'):
      parseInterface(tokens,byOffset.get(symbol.offset)??-1,symbol),
  })));
}
export function sameInterfaceShape(a:ScarpInterfaceShape,b:ScarpInterfaceShape):boolean{
  return a.name===b.name&&a.visibility===b.visibility&&a.pure===b.pure&&
    JSON.stringify(a.generic)===JSON.stringify(b.generic)&&JSON.stringify(a.parameters)===JSON.stringify(b.parameters)&&
    JSON.stringify(a.returnType)===JSON.stringify(b.returnType)&&a.nextContract===b.nextContract;
}
export function displayInterfaceShape(shape:ScarpInterfaceShape):string{
  return (shape.visibility==='public'?'pub ':'')+(shape.pure?'pure ':'')+'funcra '+shape.name+
    (shape.generic.length?' '+shape.generic.join(' '):'')+' ( '+
    shape.parameters.map(part=>part.join(' ')).join(' , ')+' )'+
    (shape.returnType?' -> '+shape.returnType.join(' '):'')+
    (shape.nextContract?' '+shape.nextContract+' …':'');
}
