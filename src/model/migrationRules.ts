import {validEditIdentifier} from './identifierEdit';
import {scanScarpSource,type InsightToken} from '../language/sourceLex';
import {unicodeSafePreviewBounds} from './utf8Text';
import {assertScarpSourceText} from './sourceLimits';

export const MAX_MIGRATION_RULES=8;
export const MAX_MIGRATION_SITES=240;
export const MAX_MIGRATION_CONTEXT=48;
export interface MigrationRule { readonly from:string; readonly to:string }
export type MigrationResult<T>={readonly ok:true;readonly value:T}|{readonly ok:false;readonly error:string};
export const migrationFailure=(error:string):MigrationResult<never>=>({ok:false,error});
export function validateMigrationRules(input:readonly MigrationRule[]):MigrationResult<readonly MigrationRule[]>{
  if(!Array.isArray(input)||!input.length||input.length>MAX_MIGRATION_RULES)
    return migrationFailure('Choose one to eight identifier mappings.');
  const from=new Set<string>();
  const rules:MigrationRule[]=[];
  for(const item of input){
    if(!item||typeof item.from!=='string'||typeof item.to!=='string'||
      !validEditIdentifier(item.from)||!validEditIdentifier(item.to)||item.from===item.to)
      return migrationFailure('Each mapping needs two distinct non-keyword Scarp identifiers.');
    if(from.has(item.from))return migrationFailure('Each original identifier must occur in only one mapping.');
    from.add(item.from);rules.push(Object.freeze({from:item.from,to:item.to}));
  }
  return {ok:true,value:Object.freeze(rules)};
}
export type MigrationRole='declaration'|'qualified'|'other';
export const MIGRATION_ROLES=['declaration','qualified','other'] as const;
export const MIGRATION_ROLE_LABELS:Readonly<Record<MigrationRole,string>>=Object.freeze({
  declaration:'Declaration-like',qualified:'Qualified token',other:'Other code identifier',
});
export type MigrationWarningKind='existing-target'|'shared-target'|'mapped-target';
export const MIGRATION_WARNING_LABELS:Readonly<Record<MigrationWarningKind,string>>=Object.freeze({
  'existing-target':'Target spelling already appears in code',
  'shared-target':'Several mappings produce the same spelling',
  'mapped-target':'Target is also an original spelling (simultaneous mapping)',
});
export interface MigrationSite{
  readonly id:string;
  readonly source:string;
  readonly rule:number;
  readonly role:MigrationRole;
  readonly offset:number;
  readonly end:number;
  readonly line:number;
  readonly column:number;
  readonly before:string;
  readonly after:string;
  readonly clippedBefore:boolean;
  readonly clippedAfter:boolean;
}
export interface MigrationWarning{
  readonly source:string|null;
  readonly rule:number;
  readonly kind:MigrationWarningKind;
  readonly count:number;
}
export interface MigrationFileScan{
  readonly sites:readonly MigrationSite[];
  readonly warnings:readonly MigrationWarning[];
}
const declarations=new Set(['funcra','record','variant','bind','var','as']);
const members=new Set(['.','::','->','?.']);
function role(previous:InsightToken|undefined):MigrationRole{
  if(previous?.kind==='identifier'&&declarations.has(previous.text))return 'declaration';
  if(previous?.kind==='operator'&&members.has(previous.text))return 'qualified';
  return 'other';
}
function standalone(content:string,token:InsightToken):boolean{
  return !token.previewTruncated&&
    !(token.start>0&&/[^\x00-\x7f]/.test(content[token.start-1]))&&
    !(token.end<content.length&&/[^\x00-\x7f]/.test(content[token.end]));
}
function preview(content:string,token:InsightToken,replacement:string){
  let start=token.start,end=token.end;
  while(start>0&&token.start-start<MAX_MIGRATION_CONTEXT&&!/[\r\n]/.test(content[start-1]))start--;
  while(end<content.length&&end-token.end<MAX_MIGRATION_CONTEXT&&!/[\r\n]/.test(content[end]))end++;
  const bounds=unicodeSafePreviewBounds(content,start,end);
  const prefix=content.slice(bounds.start,token.start),suffix=content.slice(token.end,bounds.end);
  return {
    before:prefix+token.text+suffix,after:prefix+replacement+suffix,
    clippedBefore:bounds.start>0&&!/[\r\n]/.test(content[bounds.start-1]),
    clippedAfter:bounds.end<content.length&&!/[\r\n]/.test(content[bounds.end]),
  };
}
export function mappingWarnings(rules:readonly MigrationRule[]):readonly MigrationWarning[]{
  const originals=new Set(rules.map(rule=>rule.from));
  const counts=new Map<string,number>();
  for(const rule of rules)counts.set(rule.to,(counts.get(rule.to)??0)+1);
  return Object.freeze(rules.flatMap((rule,index)=>{
    const warnings:MigrationWarning[]=[];
    const count=counts.get(rule.to)??0;
    if(count>1)warnings.push(Object.freeze({source:null,rule:index,kind:'shared-target',count}));
    if(originals.has(rule.to))warnings.push(Object.freeze({source:null,rule:index,kind:'mapped-target',count:1}));
    return warnings;
  }));
}
/** One lexical pass. Rules are simultaneous, never sequential: a generated
 * target is not fed back into another rule. No strings/comments are edited.
 * Refuse incomplete scans and ambiguous boundaries rather than silently
 * proposing a partial replacement. Existing targets are warnings, not proof
 * of a semantic collision; users must acknowledge them separately. */
export function scanMigrationFile(source:string,content:string,input:readonly MigrationRule[],
  remaining=MAX_MIGRATION_SITES):MigrationResult<MigrationFileScan>{
  const checked=validateMigrationRules(input);
  if(!checked.ok)return checked;
  if(!Number.isSafeInteger(remaining)||remaining<0||remaining>MAX_MIGRATION_SITES)
    return migrationFailure('Invalid migration site budget.');
  try{assertScarpSourceText(content);}catch{return migrationFailure('Unsupported source text.');}
  const lex=scanScarpSource(content);
  if(!lex.complete||lex.issues.length)return migrationFailure('Lexical source is incomplete or malformed.');
  const rules=checked.value;
  const byFrom=new Map(rules.map((rule,index)=>[rule.from,index]));
  const targets=new Set(rules.map(rule=>rule.to));
  const existing=new Map<string,number>();
  const sites:MigrationSite[]=[];
  let previous:InsightToken|undefined;
  for(const token of lex.tokens){
    if(token.kind==='comment')continue;
    if(token.kind==='identifier'){
      const index=byFrom.get(token.text);
      if(index!==undefined||targets.has(token.text)){
        if(!standalone(content,token))return migrationFailure('An observed spelling has an uncertain non-ASCII boundary.');
        if(targets.has(token.text))existing.set(token.text,(existing.get(token.text)??0)+1);
        if(index!==undefined){
          if(sites.length>=remaining)return migrationFailure('Too many migration sites. Narrow the reviewed scope.');
          sites.push(Object.freeze({
            id:JSON.stringify([source,token.start]),source,rule:index,role:role(previous),
            offset:token.start,end:token.end,line:token.line,column:token.column,
            ...preview(content,token,rules[index].to),
          }));
        }
      }
    }
    previous=token;
  }
  const warnings=rules.flatMap((rule,index)=>{
    const count=existing.get(rule.to)??0;
    return count?[Object.freeze({source,rule:index,kind:'existing-target' as const,count})]:[];
  });
  return {ok:true,value:Object.freeze({sites:Object.freeze(sites),warnings:Object.freeze(warnings)})};
}
/** Apply selected original offsets in source order, never interpreting
 * replacement text as a subsequent match. This also supports cycles and
 * swaps without temporary names. */
export function replaceMigrationSites(content:string,rules:readonly MigrationRule[],
  sites:readonly MigrationSite[]):MigrationResult<string>{
  const checked=validateMigrationRules(rules);
  if(!checked.ok)return checked;
  if(!sites.length||sites.length>MAX_MIGRATION_SITES)return migrationFailure('Select reviewed sites.');
  let cursor=0;
  const chunks:string[]=[];
  const seen=new Set<string>();
  for(const site of [...sites].sort((a,b)=>a.offset-b.offset)){
    const rule=checked.value[site.rule];
    if(!rule||seen.has(site.id)||!Number.isSafeInteger(site.offset)||!Number.isSafeInteger(site.end)||
      site.offset<cursor||site.end!==site.offset+rule.from.length||
      content.slice(site.offset,site.end)!==rule.from)
      return migrationFailure('Selected identifier offsets no longer match.');
    seen.add(site.id);chunks.push(content.slice(cursor,site.offset),rule.to);cursor=site.end;
  }
  chunks.push(content.slice(cursor));
  const next=chunks.join('');
  try{assertScarpSourceText(next);}catch{return migrationFailure('Replacement exceeds the source text limit.');}
  return {ok:true,value:next};
}
