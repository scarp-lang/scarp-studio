import { scarpInsightIdentifier,scanScarpSource,type InsightToken } from './sourceLex';

export const MAX_GENERIC_HEADER_UNITS=2048;
export const MAX_GENERIC_PARAMETERS=64;
export const MAX_GENERIC_TYPE_DEPTH=24;
export const MAX_GENERIC_TOKENS=512;
export interface GenericParameterHeader {
  readonly labels:readonly string[];
  readonly openIndex:number;
}
const identifier=(token:InsightToken|undefined):token is InsightToken=>
  !!token&&token.kind==='identifier'&&!token.previewTruncated&&scarpInsightIdentifier(token.text);
const symbol=(token:InsightToken|undefined,text:string)=>!!token&&!token.previewTruncated&&token.text===text;

/** Tokens here contain comments removed, but strings remain atomic.
 * Only the published declaration forms T, T: Numeric, T: Comparable
 * are recognized. This is lexical assistance, not type validation. */
export function genericParameterHeader(tokens:readonly InsightToken[],start:number):GenericParameterHeader|null{
  if(!symbol(tokens[start],'<'))return null;
  const origin=tokens[start].start;
  const labels:string[]=[],names=new Set<string>();
  let index=start+1;
  const within=()=>index-start<=MAX_GENERIC_TOKENS&&!!tokens[index]&&tokens[index].end-origin<=MAX_GENERIC_HEADER_UNITS;
  while(within()){
    const name=tokens[index];
    if(!identifier(name)||names.has(name.text)||labels.length>=MAX_GENERIC_PARAMETERS)return null;
    names.add(name.text);index++;
    let label=name.text;
    if(symbol(tokens[index],':')){
      const constraint=tokens[++index];
      if(!identifier(constraint)||(constraint.text!=='Numeric'&&constraint.text!=='Comparable'))return null;
      label+=': '+constraint.text;index++;
    }
    labels.push(label);
    if(!within())return null;
    if(symbol(tokens[index],'>')){
      index++;
      if(!within()||!symbol(tokens[index],'('))return null;
      return {labels:Object.freeze(labels),openIndex:index};
    }
    if(!symbol(tokens[index],','))return null;
    index++;
  }
  return null;
}

export interface ExplicitTypeArguments {
  readonly openIndex:number;
  readonly endOffset:number;
  readonly count:number;
}

/** Scarp explicit generic calls use ::<...>(...). Do not treat bare
 * comparison operators as call syntax. Type grammar here is deliberately
 * conservative: ASCII type names, optional module qualifier, nested
 * angle applications, and numeric array lengths. No expression parsing.
 * The editor lexer combines adjacent closing > characters into >>;
 * split only in this bounded type argument context, not in source code. */
export function explicitTypeArguments(tokens:readonly InsightToken[],colonIndex:number):ExplicitTypeArguments|null{
  if(!symbol(tokens[colonIndex],'::')||!symbol(tokens[colonIndex+1],'<'))return null;
  const origin=tokens[colonIndex].start;
  let index=colonIndex+2;
  let pendingClose=0;
  let count=0;
  const inBudget=()=>index-colonIndex<=MAX_GENERIC_TOKENS&&!!tokens[index]&&
    tokens[index].end-origin<=MAX_GENERIC_HEADER_UNITS;
  function peek():string|null{
    if(pendingClose)return '>';
    if(!inBudget()||tokens[index].previewTruncated)return null;
    return tokens[index].text==='>>'?'>':tokens[index].text;
  }
  function take(text:string):boolean{
    if(peek()!==text)return false;
    if(pendingClose){pendingClose--;return true;}
    if(text==='>'&&tokens[index].text==='>>')pendingClose=1;
    index++;return true;
  }
  function type(depth:number,allowLength=false):boolean{
    if(depth>MAX_GENERIC_TYPE_DEPTH||!inBudget()||pendingClose)return false;
    if(allowLength&&tokens[index].kind==='number'&&/^[0-9]+$/.test(tokens[index].text)){
      index++;return true;
    }
    if(!identifier(tokens[index]))return false;
    const name=tokens[index++].text;
    if(take('.')){
      if(!inBudget()||!identifier(tokens[index]))return false;
      index++;
    }
    if(!take('<'))return true;
    let nested=0;
    do{
      if(!type(depth+1,name==='array'&&nested===1))return false;
      if(++nested>MAX_GENERIC_PARAMETERS)return false;
    }while(take(','));
    return take('>');
  }
  do{
    if(!type(0)||++count>MAX_GENERIC_PARAMETERS)return null;
  }while(take(','));
  if(!take('>')||pendingClose||!inBudget()||!symbol(tokens[index],'('))return null;
  return {openIndex:index,endOffset:tokens[index].start,count};
}

/** Resolve only the suffix following a known identifier. A failed
 * parse is not evidence of a call, and never skips arbitrary source. */
export function functionCallOpenIndex(tokens:readonly InsightToken[],nameIndex:number):number|null{
  if(symbol(tokens[nameIndex+1],'('))return nameIndex+1;
  return explicitTypeArguments(tokens,nameIndex+1)?.openIndex??null;
}
export function functionHeaderOpenIndex(tokens:readonly InsightToken[],nameIndex:number):number|null{
  if(symbol(tokens[nameIndex+1],'('))return nameIndex+1;
  return genericParameterHeader(tokens,nameIndex+1)?.openIndex??null;
}
/** Prefix signature help needs a bounded recognition pass over the exact
 * ::< suffix, before the caret. The opening parenthesis must be present.
 * No text after that parenthesis affects the result. */
export function explicitCallOpenOffset(source:string,start:number,limit:number):number|null{
  if(!source.startsWith('::',start)||start<0||limit>source.length||start>=limit)return null;
  const chunk=source.slice(start,Math.min(limit,start+MAX_GENERIC_HEADER_UNITS));
  const lex=scanScarpSource(chunk);
  const tokens=lex.tokens.filter(token=>token.kind!=='comment');
  const result=explicitTypeArguments(tokens,0);
  if(!result)return null;
  // Reject lexer issues inside the recognized suffix; trailing unfinished
  // value arguments are handled by the signature scanner itself.
  if(lex.issues.some(issue=>issue.offset<result.endOffset))return null;
  return start+result.endOffset;
}
export function formatLocalFunctionName(name:string,parameters?:readonly string[]):string{
  return parameters?.length?name+'<'+parameters.join(', ')+'>':name;
}
