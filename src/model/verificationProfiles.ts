import { normalizeSearchPresetName } from './projectSearchPresets';
import { validateVerificationRules, MAX_VERIFICATION_RULES, type VerificationRule } from './projectVerification';
import { DEFAULT_PROJECT_SEARCH_SCOPE } from './projectSearchScope';

export const MAX_VERIFICATION_PROFILES = 12;
export const MAX_VERIFICATION_BACKUP_UNITS = 64 * 1024;
export const VERIFICATION_PROFILE_FORMAT = 'scarp-studio.verification-profiles';
type Result<T> = {readonly ok:true;readonly value:T}|{readonly ok:false;readonly error:string};
const fail=(error:string):Result<never>=>({ok:false,error});
const neutralSettings = {scope:DEFAULT_PROJECT_SEARCH_SCOPE,mode:'working' as const,listingLimited:false};
export interface VerificationProfile {
  readonly id:number;
  readonly name:string;
  readonly rules:readonly VerificationRule[];
}
export interface VerificationProfileLibrary {
  readonly revision:number;
  readonly nextId:number;
  readonly profiles:readonly VerificationProfile[];
}
export function createVerificationProfileLibrary():VerificationProfileLibrary {
  return Object.freeze({revision:0,nextId:1,profiles:Object.freeze([])});
}
function sameRule(a:VerificationRule,b:VerificationRule):boolean {
  return a.name===b.name&&a.query===b.query&&a.expectation===b.expectation&&
    a.options.caseSensitive===b.options.caseSensitive&&a.options.wholeWord===b.options.wholeWord;
}
export function sameVerificationRules(a:readonly VerificationRule[],b:readonly VerificationRule[]):boolean{
  return a.length===b.length&&a.every((rule,index)=>sameRule(rule,b[index]));
}
function copyRules(rules:readonly VerificationRule[]):readonly VerificationRule[]{
  return Object.freeze(rules.map(rule=>Object.freeze({
    name:rule.name,query:rule.query,expectation:rule.expectation,
    options:Object.freeze({caseSensitive:rule.options.caseSensitive,wholeWord:rule.options.wholeWord}),
  })));
}
function duplicate(library:VerificationProfileLibrary,name:string,except?:number):boolean{
  return library.profiles.some(profile=>profile.id!==except&&profile.name.toLowerCase()===name.toLowerCase());
}
function update(library:VerificationProfileLibrary,profiles:readonly VerificationProfile[],nextId=library.nextId):VerificationProfileLibrary{
  return Object.freeze({revision:library.revision+1,nextId,profiles:Object.freeze([...profiles])});
}
function profile(id:number,name:string,rules:readonly VerificationRule[]):VerificationProfile{
  return Object.freeze({id,name,rules:copyRules(rules)});
}
function validateRules(rules:readonly VerificationRule[]){
  return validateVerificationRules(rules,neutralSettings);
}
export function addVerificationProfile(library:VerificationProfileLibrary,name:unknown,rules:readonly VerificationRule[]):Result<VerificationProfileLibrary>{
  if(library.profiles.length>=MAX_VERIFICATION_PROFILES)return fail('Verification profile capacity reached.');
  const normalized=normalizeSearchPresetName(name);
  if(!normalized.ok)return normalized;
  if(duplicate(library,normalized.value))return fail('A verification profile with this name already exists.');
  const checked=validateRules(rules);
  if(!checked.ok)return checked;
  return {ok:true,value:update(library,[...library.profiles,profile(library.nextId,normalized.value,checked.value)],library.nextId+1)};
}
export function renameVerificationProfile(library:VerificationProfileLibrary,id:number,name:unknown):Result<VerificationProfileLibrary>{
  const selected=library.profiles.find(item=>item.id===id);
  if(!selected)return fail('The verification profile no longer exists.');
  const normalized=normalizeSearchPresetName(name);
  if(!normalized.ok)return normalized;
  if(duplicate(library,normalized.value,id))return fail('A verification profile with this name already exists.');
  if(selected.name===normalized.value)return {ok:true,value:library};
  return {ok:true,value:update(library,library.profiles.map(item=>item.id===id?profile(id,normalized.value,item.rules):item))};
}
export function removeVerificationProfile(library:VerificationProfileLibrary,id:number):Result<VerificationProfileLibrary>{
  if(!library.profiles.some(item=>item.id===id))return fail('The verification profile no longer exists.');
  return {ok:true,value:update(library,library.profiles.filter(item=>item.id!==id))};
}
export function clearVerificationProfiles(library:VerificationProfileLibrary):VerificationProfileLibrary{
  return library.profiles.length?update(library,[]):library;
}
export interface VerificationProfileReview {
  readonly library:VerificationProfileLibrary;
  readonly profile:VerificationProfile;
  /** Current editor drafts may be incomplete; preserve exact proposed state. */
  readonly current:readonly VerificationRule[];
  readonly action:'apply'|'replace';
}
export function prepareVerificationProfileReview(library:VerificationProfileLibrary,id:number,current:readonly VerificationRule[],
  action:VerificationProfileReview['action']):Result<VerificationProfileReview>{
  const chosen=library.profiles.find(item=>item.id===id);
  if(!chosen)return fail('The verification profile no longer exists.');
  if(action!=='apply'&&action!=='replace')return fail('Unknown profile action.');
  if(action==='replace'){
    const checked=validateRules(current);
    if(!checked.ok)return checked;
  }
  return {ok:true,value:Object.freeze({library,profile:chosen,current:copyRules(current),action})};
}
function reviewCurrent(library:VerificationProfileLibrary,review:VerificationProfileReview,current:readonly VerificationRule[]):boolean{
  return review.library===library&&library.profiles.includes(review.profile)&&sameVerificationRules(review.current,current);
}
export function confirmVerificationProfileApply(library:VerificationProfileLibrary,review:VerificationProfileReview,
  current:readonly VerificationRule[]):Result<readonly VerificationRule[]>{
  if(review.action!=='apply'||!reviewCurrent(library,review,current))return fail('Profile or current rule drafts changed. Review again.');
  return {ok:true,value:copyRules(review.profile.rules)};
}
export function confirmVerificationProfileReplace(library:VerificationProfileLibrary,review:VerificationProfileReview,
  current:readonly VerificationRule[]):Result<VerificationProfileLibrary>{
  if(review.action!=='replace'||!reviewCurrent(library,review,current))return fail('Profile or proposed rule drafts changed. Review again.');
  const checked=validateRules(current);
  if(!checked.ok)return checked;
  if(sameVerificationRules(review.profile.rules,checked.value))return {ok:true,value:library};
  return {ok:true,value:update(library,library.profiles.map(item=>item===review.profile?profile(item.id,item.name,checked.value):item))};
}

interface PortableProfile {readonly name:string;readonly rules:readonly VerificationRule[]}
function object(value:unknown):value is Record<string,unknown>{
  return !!value&&typeof value==='object'&&!Array.isArray(value);
}
function exact(value:Record<string,unknown>,keys:readonly string[]):boolean{
  return Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
}
function parseRule(value:unknown):VerificationRule|null{
  if(!object(value)||!exact(value,['name','query','expectation','options'])||
    typeof value.name!=='string'||typeof value.query!=='string'||
    (value.expectation!=='present'&&value.expectation!=='absent'&&value.expectation!=='observe')||
    !object(value.options)||!exact(value.options,['caseSensitive','wholeWord'])||
    typeof value.options.caseSensitive!=='boolean'||typeof value.options.wholeWord!=='boolean')return null;
  return {name:value.name,query:value.query,expectation:value.expectation,
    options:{caseSensitive:value.options.caseSensitive,wholeWord:value.options.wholeWord}};
}
/** Export includes private literal queries. The UI requires explicit opt-in.
 * Profiles are rule sets only; no directory, native path or execution rights.
 */
export function exportVerificationProfiles(library:VerificationProfileLibrary):Result<string>{
  const text=JSON.stringify({format:VERIFICATION_PROFILE_FORMAT,version:1,
    profiles:library.profiles.map(item=>({name:item.name,rules:copyRules(item.rules)}))},null,2);
  return text.length<=MAX_VERIFICATION_BACKUP_UNITS?{ok:true,value:text}:fail('Verification backup exceeds its size limit.');
}
export function parseVerificationProfiles(text:string):Result<readonly PortableProfile[]>{
  if(typeof text!=='string'||text.length>MAX_VERIFICATION_BACKUP_UNITS)return fail('Verification backup exceeds its size limit.');
  let raw:unknown;
  try{raw=JSON.parse(text);}catch{return fail('Verification backup is not valid JSON.');}
  if(!object(raw)||!exact(raw,['format','version','profiles'])||raw.format!==VERIFICATION_PROFILE_FORMAT||
    raw.version!==1||!Array.isArray(raw.profiles)||raw.profiles.length>MAX_VERIFICATION_PROFILES)
    return fail('Unsupported verification profile backup format or count.');
  const names=new Set<string>(),items:PortableProfile[]=[];
  for(const item of raw.profiles){
    if(!object(item)||!exact(item,['name','rules'])||!Array.isArray(item.rules)||
      item.rules.length>MAX_VERIFICATION_RULES)return fail('Unsupported verification profile record.');
    const name=normalizeSearchPresetName(item.name);
    if(!name.ok)return name;
    if(names.has(name.value.toLowerCase()))return fail('Verification backup contains duplicate profile names.');
    names.add(name.value.toLowerCase());
    const rules:VerificationRule[]=[];
    for(const rawRule of item.rules){
      const rule=parseRule(rawRule);
      if(!rule)return fail('Verification backup contains an unsupported rule.');
      rules.push(rule);
    }
    const checked=validateRules(rules);
    if(!checked.ok)return checked;
    items.push(Object.freeze({name:name.value,rules:checked.value}));
  }
  return {ok:true,value:Object.freeze(items)};
}
export type VerificationImportStatus='new'|'identical'|'conflict';
export interface VerificationImportRow {
  readonly index:number;
  readonly name:string;
  readonly rules:readonly VerificationRule[];
  readonly status:VerificationImportStatus;
}
export interface VerificationImportReview {
  readonly library:VerificationProfileLibrary;
  readonly text:string;
  readonly capacity:number;
  readonly rows:readonly VerificationImportRow[];
}
export function reviewVerificationImport(library:VerificationProfileLibrary,text:string):Result<VerificationImportReview>{
  const parsed=parseVerificationProfiles(text);
  if(!parsed.ok)return parsed;
  const rows=parsed.value.map((item,index):VerificationImportRow=>{
    const existing=library.profiles.find(p=>p.name.toLowerCase()===item.name.toLowerCase());
    return Object.freeze({index,name:item.name,rules:item.rules,status:!existing?'new':
      sameVerificationRules(existing.rules,item.rules)?'identical':'conflict'});
  });
  return {ok:true,value:Object.freeze({library,text,capacity:MAX_VERIFICATION_PROFILES-library.profiles.length,
    rows:Object.freeze(rows)})};
}
/** Reparse and compare the reviewed rows. Only explicitly selected new
 * profiles are merged, atomically; conflicting names are never overwritten.
 */
export function confirmVerificationImport(library:VerificationProfileLibrary,review:VerificationImportReview,
  selected:readonly number[]):Result<VerificationProfileLibrary>{
  if(review.library!==library)return fail('Verification profile library changed. Review the backup again.');
  const checked=reviewVerificationImport(library,review.text);
  if(!checked.ok)return checked;
  const expected=checked.value;
  if(expected.capacity!==review.capacity||expected.rows.length!==review.rows.length||
    review.rows.some((row,index)=>{
      const target=expected.rows[index];
      return row.index!==target.index||row.name!==target.name||row.status!==target.status||
        !sameVerificationRules(row.rules,target.rules);
    }))return fail('Verification import evidence changed. Review the backup again.');
  if(!selected.length||selected.length>expected.capacity||new Set(selected).size!==selected.length||
    selected.some(index=>!Number.isSafeInteger(index)||index<0||expected.rows[index]?.status!=='new'))
    return fail('Select distinct new profiles within the remaining capacity.');
  const additions=[...selected].sort((a,b)=>a-b).map((index,offset)=>{
    const row=expected.rows[index];
    return profile(library.nextId+offset,row.name,row.rules);
  });
  return {ok:true,value:update(library,[...library.profiles,...additions],library.nextId+additions.length)};
}
