import {scanScarpSource,type InsightToken} from './sourceLex';
import {explicitTypeArguments,functionCallOpenIndex} from './genericSyntax';
import type {WorkspaceCall} from '../model/workspaceSymbols';

export const MAX_ARGUMENT_SCAN_TOKENS=768;
export const MAX_ARGUMENT_SCAN_UNITS=8192;
export const MAX_ARGUMENT_NESTING=48;
export const MAX_OBSERVED_ARGUMENTS=128;
export const MAX_ARGUMENT_WORK=120000;
export type CallArgumentIssue='lexical-incomplete'|'missing-call'|'unbalanced-delimiter'|'empty-argument'|'unsupported-shape'|'argument-limit'|'work-limit';
export const CALL_ARGUMENT_ISSUES:Readonly<Record<CallArgumentIssue,string>>=Object.freeze({
  'lexical-incomplete':'Incomplete lexical source',
  'missing-call':'Call opening not recognized',
  'unbalanced-delimiter':'Unbalanced argument delimiters',
  'empty-argument':'Empty or trailing argument position',
  'unsupported-shape':'Unsupported argument syntax',
  'argument-limit':'Argument observation limit',
  'work-limit':'Shared file observation budget',
});
export type CallArgumentEvidence=
  {readonly ok:true;readonly count:number;readonly explicitTypeCount:number|null}|
  {readonly ok:false;readonly issue:CallArgumentIssue};
export interface IndexedCallArguments{
  readonly offset:number;
  readonly evidence:CallArgumentEvidence;
}
const fail=(issue:CallArgumentIssue):CallArgumentEvidence=>Object.freeze({ok:false,issue});
const opens:Readonly<Record<string,string>>=Object.freeze({'(':')','[':']','{':'}'});
const closes=new Set(Object.values(opens));
interface Budget{remaining:number}
function observe(tokens:readonly InsightToken[],nameIndex:number,call:WorkspaceCall,budget:Budget):CallArgumentEvidence{
  const name=tokens[nameIndex];
  if(!name||name.start!==call.offset||name.end!==call.end||name.text!==call.name||name.kind!=='identifier')
    return fail('missing-call');
  const open=functionCallOpenIndex(tokens,nameIndex);
  if(open===null)return fail('missing-call');
  const explicit=open===nameIndex+1?null:explicitTypeArguments(tokens,nameIndex+1);
  if(open!==nameIndex+1&&!explicit)return fail('unsupported-shape');
  const stack:string[]=[];
  let count=0,hasValue=false,hadComma=false;
  for(let index=open+1;index<tokens.length;index++){
    if(--budget.remaining<0)return fail('work-limit');
    const token=tokens[index];
    if(index-nameIndex>MAX_ARGUMENT_SCAN_TOKENS||token.end-name.start>MAX_ARGUMENT_SCAN_UNITS)
      return fail('argument-limit');
    if(token.kind==='string'||token.kind==='number'){
      if(!stack.length)hasValue=true;
      continue;
    }
    // Recognize bounded explicit type arguments as one suffix. A bare
    // comparison '<' never opens a generic frame.
    if(token.kind==='operator'&&token.text==='::'&&tokens[index+1]?.text==='<'){
      const generic=explicitTypeArguments(tokens,index);
      if(!generic)return fail('unsupported-shape');
      const consumed=generic.openIndex-index;
      budget.remaining-=consumed;
      if(budget.remaining<0)return fail('work-limit');
      if(generic.openIndex-nameIndex>MAX_ARGUMENT_SCAN_TOKENS)return fail('argument-limit');
      index=generic.openIndex-1;
      if(!stack.length)hasValue=true;
      continue;
    }
    if(token.kind==='delimiter'){
      if(Object.hasOwn(opens,token.text)){
        if(!stack.length)hasValue=true;
        stack.push(opens[token.text]);
        if(stack.length>MAX_ARGUMENT_NESTING)return fail('argument-limit');
        continue;
      }
      if(closes.has(token.text)){
        if(stack.length){
          if(stack.pop()!==token.text)return fail('unbalanced-delimiter');
          continue;
        }
        if(token.text!==')')return fail('unbalanced-delimiter');
        if(!hasValue&&hadComma)return fail('empty-argument');
        if(hasValue)count++;
        if(count>MAX_OBSERVED_ARGUMENTS)return fail('argument-limit');
        return Object.freeze({ok:true,count,explicitTypeCount:explicit?.count??null});
      }
      if(!stack.length&&token.text===','){
        if(!hasValue)return fail('empty-argument');
        count++;hadComma=true;hasValue=false;
        if(count>=MAX_OBSERVED_ARGUMENTS)return fail('argument-limit');
        continue;
      }
      if(!stack.length&&token.text===';')return fail('unsupported-shape');
    }
    // Named arguments, spreads and unfamiliar top-level separators must
    // not be described as ordinary positional argument observations.
    if(!stack.length&&token.kind==='operator'&&[':', '...', '=>'].includes(token.text))
      return fail('unsupported-shape');
    if(!stack.length)hasValue=true;
  }
  return fail('unbalanced-delimiter');
}

/** Counts lexical comma-separated positions only. Nested calls, tuples,
 * arrays, blocks and atomic literals cannot contribute outer commas.
 * No argument expression, source text, or decoded literal is retained.
 */
export function captureScarpCallArguments(content:string,calls:readonly WorkspaceCall[]):readonly IndexedCallArguments[]{
  if(!calls.length)return Object.freeze([]);
  const lexical=scanScarpSource(content);
  if(!lexical.complete||lexical.issues.length)return Object.freeze(calls.map(call=>Object.freeze({
    offset:call.offset,evidence:fail('lexical-incomplete'),
  })));
  const tokens=lexical.tokens.filter(token=>token.kind!=='comment');
  const byOffset=new Map(tokens.map((token,index)=>[token.start,index]));
  const budget={remaining:MAX_ARGUMENT_WORK};
  return Object.freeze(calls.map(call=>Object.freeze({
    offset:call.offset,evidence:budget.remaining<0?fail('work-limit'):observe(tokens,byOffset.get(call.offset)??-1,call,budget),
  })));
}
