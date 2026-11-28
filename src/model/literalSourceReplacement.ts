import {scanScarpSource,scanScarpLiteral,type InsightToken} from '../language/sourceLex';
import {assertScarpSourceText} from './sourceLimits';
import {assertWellFormedUtf16,unicodeSafePreviewBounds} from './utf8Text';
import {nextLineBreak,lineBreakWidth} from './sourceLines';
import {MAX_SEARCH_QUERY_UNITS,MAX_SEARCH_CANDIDATES} from './openFileSearch';
import {reviewedFailure,type ReviewedResult} from './reviewedSourceStage';

export const MAX_LITERAL_REPLACEMENT_UNITS=512;
export const MAX_LITERAL_REPLACEMENT_SITES=240;
export const LITERAL_DOMAINS=['code','comment','string','all'] as const;
export type LiteralDomain=typeof LITERAL_DOMAINS[number];
export type LiteralRegion=Exclude<LiteralDomain,'all'>|'boundary';
export const LITERAL_REGION_LABELS:Readonly<Record<LiteralRegion,string>>=Object.freeze({
  code:'Outside comments and strings',comment:'Comment body',string:'String body',boundary:'Crosses a protected boundary',
});
export const LITERAL_DOMAIN_LABELS:Readonly<Record<LiteralDomain,string>>=Object.freeze({
  code:'Outside comments and strings',comment:'Comment bodies only',string:'String bodies only',all:'All text including boundaries',
});
export interface LiteralReplaceSettings{
  readonly query:string;
  readonly replacement:string;
  readonly caseSensitive:boolean;
  readonly wholeWord:boolean;
  readonly domain:LiteralDomain;
}
export const DEFAULT_LITERAL_REPLACE:LiteralReplaceSettings=Object.freeze({
  query:'',replacement:'',caseSensitive:true,wholeWord:false,domain:'code',
});
export interface LiteralReplaceSite{
  readonly id:string;
  readonly source:string;
  readonly start:number;
  readonly end:number;
  readonly line:number;
  readonly column:number;
  readonly region:LiteralRegion;
  readonly original:string;
  readonly prefix:string;
  readonly suffix:string;
  readonly clippedBefore:boolean;
  readonly clippedAfter:boolean;
}
export interface LiteralFileScan{
  readonly sites:readonly LiteralReplaceSite[];
  readonly excluded:number;
  readonly unchanged:number;
  readonly candidates:number;
}
function singleLineText(text:unknown,max:number):text is string{
  if(typeof text!=='string'||text.length>max||/[\u0000-\u0008\u000a-\u001f\u007f]/.test(text))return false;
  try{assertWellFormedUtf16(text,'Literal replacement text');return true;}catch{return false;}
}
export function validateLiteralReplaceSettings(input:LiteralReplaceSettings):ReviewedResult<LiteralReplaceSettings>{
  if(!input||!singleLineText(input.query,MAX_SEARCH_QUERY_UNITS)||!input.query.length||
    !singleLineText(input.replacement,MAX_LITERAL_REPLACEMENT_UNITS)||
    typeof input.caseSensitive!=='boolean'||typeof input.wholeWord!=='boolean'||!LITERAL_DOMAINS.includes(input.domain))
    return reviewedFailure('Choose a nonempty single-line query, a bounded single-line replacement, and valid matching options.');
  if(input.caseSensitive&&input.query===input.replacement)return reviewedFailure('Query and replacement are identical.');
  return {ok:true,value:Object.freeze({query:input.query,replacement:input.replacement,
    caseSensitive:input.caseSensitive,wholeWord:input.wholeWord,domain:input.domain})};
}
interface ProtectedSpan{
  readonly token:InsightToken;
  readonly bodyStart:number;
  readonly bodyEnd:number;
}
function protectedSpans(content:string):ReviewedResult<readonly ProtectedSpan[]>{
  const lex=scanScarpSource(content);
  if(!lex.complete||lex.issues.length)return reviewedFailure('Lexical source is incomplete or malformed. No literal edit review was created.');
  const spans:ProtectedSpan[]=[];
  for(const token of lex.tokens){
    if(token.kind==='comment'){
      spans.push({token,bodyStart:token.start+2,bodyEnd:token.end});
    }else if(token.kind==='string'){
      const literal=scanScarpLiteral(content,token.start,token.end);
      if(!literal?.closed||literal.end!==token.end)return reviewedFailure('String delimiters could not be reviewed.');
      const opening=literal.kind==='raw'?2:literal.kind==='multiline'?3:1;
      const closing=literal.kind==='multiline'?3:1;
      spans.push({token,bodyStart:token.start+opening,bodyEnd:token.end-closing});
    }
  }
  return {ok:true,value:spans};
}
function firstIntersecting(spans:readonly ProtectedSpan[],start:number):number{
  let low=0,high=spans.length;
  while(low<high){
    const middle=(low+high)>>>1;
    if(spans[middle].token.end<=start)low=middle+1;else high=middle;
  }
  return low;
}
function classify(spans:readonly ProtectedSpan[],start:number,end:number):LiteralRegion{
  const span=spans[firstIntersecting(spans,start)];
  if(!span||span.token.start>=end)return 'code';
  if(start>=span.bodyStart&&end<=span.bodyEnd)return span.token.kind==='comment'?'comment':'string';
  return 'boundary';
}
function quote(text:string):string{return text.replace(/[\\^$.*+?()[\]{}|]/g,'\\$&');}
function previousCodePoint(text:string,index:number):string{
  if(!index)return '';
  const last=text.charCodeAt(index-1);
  return last>=0xdc00&&last<=0xdfff&&index>1?text.slice(index-2,index):text.slice(index-1,index);
}
function wholeWord(text:string,start:number,end:number):boolean{
  const preceding=previousCodePoint(text,start);
  const point=text.codePointAt(end);
  const following=point===undefined?'':String.fromCodePoint(point);
  return !/[\p{ID_Continue}]/u.test(preceding)&&!/[\p{ID_Continue}]/u.test(following);
}
function makeSite(source:string,content:string,start:number,end:number,line:number,lineStart:number,lineEnd:number,
  region:LiteralRegion):LiteralReplaceSite{
  const bounds=unicodeSafePreviewBounds(content,Math.max(lineStart,start-36),Math.min(lineEnd,end+36));
  return Object.freeze({id:JSON.stringify([source,start,end]),source,start,end,line,column:start-lineStart+1,
    region,original:content.slice(start,end),prefix:content.slice(bounds.start,start),suffix:content.slice(end,bounds.end),
    clippedBefore:bounds.start>lineStart,clippedAfter:bounds.end<lineEnd});
}
/** Matches are non-overlapping original UTF-16 spans. Candidate limits
 * include excluded and unchanged matches so a narrow region filter cannot
 * disguise a huge scan. A partial scan never authorizes edits. */
export function scanLiteralReplacementFile(source:string,content:string,input:LiteralReplaceSettings,
  siteBudget=MAX_LITERAL_REPLACEMENT_SITES,candidateBudget=MAX_SEARCH_CANDIDATES):ReviewedResult<LiteralFileScan>{
  const settings=validateLiteralReplaceSettings(input);
  if(!settings.ok)return settings;
  if(!Number.isSafeInteger(siteBudget)||siteBudget<0||siteBudget>MAX_LITERAL_REPLACEMENT_SITES||
    !Number.isSafeInteger(candidateBudget)||candidateBudget<0||candidateBudget>MAX_SEARCH_CANDIDATES)
    return reviewedFailure('Literal replacement scan budget is invalid.');
  try{assertScarpSourceText(content);}catch{return reviewedFailure('Unsupported source text.');}
  const spans=protectedSpans(content);
  if(!spans.ok)return spans;
  const config=settings.value;
  const pattern=new RegExp(quote(config.query),config.caseSensitive?'gu':'giu');
  const sites:LiteralReplaceSite[]=[];
  let excluded=0,unchanged=0,candidates=0,line=1,lineStart=0,lineEnd=nextLineBreak(content,0);
  for(const match of content.matchAll(pattern)){
    if(++candidates>candidateBudget)return reviewedFailure('Literal candidate budget reached. Narrow the query or source scope.');
    const start=match.index,end=start+match[0].length;
    if(config.wholeWord&&!wholeWord(content,start,end)){excluded++;continue;}
    const region=classify(spans.value,start,end);
    if(config.domain!=='all'&&config.domain!==region){excluded++;continue;}
    if(match[0]===config.replacement){unchanged++;continue;}
    if(sites.length>=siteBudget)return reviewedFailure('Literal replacement site budget reached. Narrow the query or source scope.');
    while(lineEnd>=0&&lineEnd<start){
      line++;lineStart=lineEnd+lineBreakWidth(content,lineEnd);lineEnd=nextLineBreak(content,lineStart);
    }
    sites.push(makeSite(source,content,start,end,line,lineStart,lineEnd<0?content.length:lineEnd,region));
  }
  return {ok:true,value:Object.freeze({sites:Object.freeze(sites),excluded,unchanged,candidates})};
}
function verifyProtectedLayout(before:string,after:string,sites:readonly LiteralReplaceSite[],replacement:string,
  domain:LiteralDomain):boolean{
  const old=protectedSpans(before),next=protectedSpans(after);
  if(!old.ok||!next.ok)return false;
  if(domain==='all')return true;
  if(old.value.length!==next.value.length)return false;
  let delta=0,siteIndex=0;
  for(const [index,span] of old.value.entries()){
    while(siteIndex<sites.length&&sites[siteIndex].end<=span.token.start){
      delta+=replacement.length-(sites[siteIndex].end-sites[siteIndex].start);
      siteIndex++;
    }
    const expectedStart=span.token.start+delta;
    let cursor=span.token.start;
    const fragments:string[]=[];
    while(siteIndex<sites.length&&sites[siteIndex].start<span.token.end){
      const site=sites[siteIndex++];
      if(site.start<span.bodyStart||site.end>span.bodyEnd||site.region!==domain)return false;
      fragments.push(before.slice(cursor,site.start),replacement);
      cursor=site.end;
      delta+=replacement.length-(site.end-site.start);
    }
    fragments.push(before.slice(cursor,span.token.end));
    const candidate=next.value[index];
    if(candidate.token.kind!==span.token.kind||candidate.token.start!==expectedStart||candidate.token.end!==span.token.end+delta||
      after.slice(candidate.token.start,candidate.token.end)!==fragments.join(''))return false;
  }
  return true;
}
/** Recompute exact selected offsets, preserve original order, and reject
 * changes that break the editor lexer. Restricted domains additionally
 * preserve the complete layout and expected contents of protected spans.
 * This remains lexical evidence, not a compiler correctness guarantee. */
export function applyLiteralReplacementSites(source:string,content:string,input:LiteralReplaceSettings,
  selected:readonly LiteralReplaceSite[]):ReviewedResult<string>{
  const scan=scanLiteralReplacementFile(source,content,input);
  if(!scan.ok)return scan;
  if(!selected.length||selected.length>scan.value.sites.length||
    new Set(selected.map(site=>site.id)).size!==selected.length)return reviewedFailure('Select distinct reviewed literal sites.');
  const byId=new Map(scan.value.sites.map(site=>[site.id,site]));
  const ordered=[...selected].sort((a,b)=>a.start-b.start);
  let cursor=0;
  const fragments:string[]=[];
  for(const site of ordered){
    const expected=byId.get(site.id);
    if(!expected||JSON.stringify(expected)!==JSON.stringify(site)||site.start<cursor)
      return reviewedFailure('Selected literal evidence changed. Scan again.');
    fragments.push(content.slice(cursor,site.start),input.replacement);
    cursor=site.end;
  }
  fragments.push(content.slice(cursor));
  const after=fragments.join('');
  try{assertScarpSourceText(after);}catch{return reviewedFailure('Literal replacement exceeds its source budget.');}
  if(!verifyProtectedLayout(content,after,ordered,input.replacement,input.domain))
    return reviewedFailure('Replacement would break lexical structure or change protected comment/string boundaries.');
  return {ok:true,value:after};
}
