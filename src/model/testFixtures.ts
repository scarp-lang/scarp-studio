import { sameFilePath } from './documents';
import { safeRelativeScarpDirectory } from './folderListing';
import { assertWellFormedUtf16,utf8ByteLength,unicodeSafePreviewBounds } from './utf8Text';
import { visibleDiagnosticText } from './diagnosticReport';
import type { TestSourceListing } from './projectTestNavigation';

export const FIXTURE_STREAMS=['stdin','stdout','stderr'] as const;
export type FixtureStream=typeof FIXTURE_STREAMS[number];
export const MAX_FIXTURE_BYTES=1024*1024;
export const MAX_FIXTURE_CREATE_BYTES=64*1024;
export const MAX_FIXTURE_TEXT_PREVIEW=4096;
export const MAX_FIXTURE_HEX_PREVIEW=256;
export const MAX_FIXTURE_DIRECTORY_ENTRIES=4096;
export const MAX_FIXTURE_TESTS=64;
export interface FixtureEntry{
  readonly name:string;
  readonly isFile:boolean;
  readonly isDirectory:boolean;
  readonly isSymlink:boolean;
}
export type FixtureStatus='absent'|'regular'|'unsafe'|'ambiguous';
export interface FixtureSlot{
  readonly stream:FixtureStream;
  readonly name:string;
  readonly status:FixtureStatus;
}
export interface FixtureTest{
  readonly name:string;
  readonly slots:readonly FixtureSlot[];
}
export interface FixtureInventory{
  readonly tests:readonly FixtureTest[];
  readonly unpaired:readonly string[];
  readonly ignoredUppercaseTests:number;
}
export interface FixtureProjectTarget{
  readonly workspace:string;
  readonly folder:string;
  readonly directory:string;
}
export type FixtureResult<T>={readonly ok:true;readonly value:T}|{readonly ok:false;readonly error:string};
const fail=(error:string):FixtureResult<never>=>({ok:false,error});
/** Resolve a discovered manifest root, not a compiler-supplied test label. */
export function fixtureProjectTarget(selection:TestSourceListing|null,folder:string|null):FixtureProjectTarget|null{
  if(!selection||!folder)return null;
  const roots=(selection.projectRoots??[]).filter(root=>sameFilePath(root.path,folder));
  if(roots.length!==1)return null;
  const directory=roots[0].directory;
  if(directory&&!safeRelativeScarpDirectory(directory))return null;
  if(!directory&&!sameFilePath(selection.path,folder))return null;
  return Object.freeze({workspace:selection.path,folder:roots[0].path,directory});
}
export function safeFixtureName(name:string):boolean{
  if(!name||name.length>255||/[\\/:<>"|?*\x00-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/.test(name)||
    name==='.'||name==='..'||name.endsWith(' ')||name.endsWith('.')||name.startsWith('.'))return false;
  if(/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))return false;
  try{assertWellFormedUtf16(name,'Fixture filename');}catch{return false;}
  return utf8ByteLength(name)<=255;
}
export function fixtureName(testName:string,stream:FixtureStream):string|null{
  if(!FIXTURE_STREAMS.includes(stream)||!safeFixtureName(testName)||!testName.endsWith('.srp')||testName.length<=4)return null;
  const name=testName.slice(0,-4)+'.'+stream;
  return safeFixtureName(name)?name:null;
}
function regular(entry:FixtureEntry){return entry.isFile&&!entry.isDirectory&&!entry.isSymlink;}
/** Direct tests, exact sibling names and conservative portable case collision
 * checks. Discovery mirrors the lowercase .srp compiler suffix. */
export function buildFixtureInventory(entries:readonly FixtureEntry[]):FixtureResult<FixtureInventory>{
  if(entries.length>MAX_FIXTURE_DIRECTORY_ENTRIES)return fail('Test directory exceeds the fixture review entry budget.');
  const candidates=entries.filter(entry=>entry.name.endsWith('.srp'));
  if(candidates.length>MAX_FIXTURE_TESTS)return fail('Test directory exceeds the compiler’s 64-test limit.');
  const byLower=new Map<string,FixtureEntry[]>();
  for(const entry of entries){
    const key=entry.name.toLowerCase();
    const bucket=byLower.get(key);
    if(bucket)bucket.push(entry);else byLower.set(key,[entry]);
  }
  const expected=new Set<string>();
  const tests:FixtureTest[]=[];
  for(const entry of candidates){
    if(!regular(entry)||!safeFixtureName(entry.name)||entry.name.length<=4||
      byLower.get(entry.name.toLowerCase())?.length!==1)return fail('A direct test source has an unsafe or ambiguous identity.');
    const slots:FixtureSlot[]=[];
    for(const stream of FIXTURE_STREAMS){
      const name=fixtureName(entry.name,stream);
      if(!name)return fail('A test fixture sibling name is not portable.');
      expected.add(name);
      const matches=byLower.get(name.toLowerCase())??[];
      const status:FixtureStatus=!matches.length?'absent':matches.length!==1||matches[0].name!==name?'ambiguous':
        regular(matches[0])?'regular':'unsafe';
      slots.push(Object.freeze({stream,name,status}));
    }
    tests.push(Object.freeze({name:entry.name,slots:Object.freeze(slots)}));
  }
  const unpaired=entries.filter(entry=>safeFixtureName(entry.name)&&FIXTURE_STREAMS.some(stream=>entry.name.endsWith('.'+stream))&&!expected.has(entry.name))
    .map(entry=>entry.name).sort();
  tests.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
  return {ok:true,value:Object.freeze({tests:Object.freeze(tests),unpaired:Object.freeze(unpaired),
    ignoredUppercaseTests:entries.filter(entry=>/\.srp$/i.test(entry.name)&&!entry.name.endsWith('.srp')).length})};
}
export function fixtureSlot(inventory:FixtureInventory,testName:string,stream:FixtureStream):FixtureSlot|null{
  return inventory.tests.find(test=>test.name===testName)?.slots.find(slot=>slot.stream===stream)??null;
}
export interface FixtureByteSummary{
  readonly bytes:number;
  readonly utf8Valid:boolean;
  readonly bom:boolean;
  readonly crlf:number;
  readonly lf:number;
  readonly cr:number;
  readonly nul:number;
  readonly finalEnding:'CRLF'|'LF'|'CR'|'none';
  readonly textPreview:string|null;
  readonly textTruncated:boolean;
  readonly hexPreview:string;
  readonly hexTruncated:boolean;
}
export function summarizeFixtureBytes(bytes:Uint8Array):FixtureResult<FixtureByteSummary>{
  if(bytes.byteLength>MAX_FIXTURE_BYTES)return fail('Fixture exceeds the compiler’s 1 MiB byte limit.');
  let crlf=0,lf=0,cr=0,nul=0;
  for(let i=0;i<bytes.length;i++){
    const value=bytes[i];
    if(value===0)nul++;
    if(value===13){if(bytes[i+1]===10){crlf++;i++;}else cr++;}
    else if(value===10)lf++;
  }
  let decoded:string|null=null;
  try{decoded=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{/* Hex remains available. */}
  const end=decoded===null?0:unicodeSafePreviewBounds(decoded,0,Math.min(decoded.length,MAX_FIXTURE_TEXT_PREVIEW)).end;
  const final=bytes.at(-1);
  return {ok:true,value:Object.freeze({
    bytes:bytes.length,utf8Valid:decoded!==null,bom:bytes[0]===0xef&&bytes[1]===0xbb&&bytes[2]===0xbf,
    crlf,lf,cr,nul,finalEnding:final===10?bytes.at(-2)===13?'CRLF':'LF':final===13?'CR':'none',
    textPreview:decoded===null?null:visibleDiagnosticText(JSON.stringify(decoded.slice(0,end))),
    textTruncated:decoded!==null&&end<decoded.length,
    hexPreview:Array.from(bytes.subarray(0,MAX_FIXTURE_HEX_PREVIEW),value=>value.toString(16).padStart(2,'0')).join(' '),
    hexTruncated:bytes.length>MAX_FIXTURE_HEX_PREVIEW,
  })};
}
export type FixtureLineEnding='LF'|'CRLF';
export interface FixtureCreateRequest{
  readonly testName:string;
  readonly stream:FixtureStream;
  readonly text:string;
  readonly lineEnding:FixtureLineEnding;
  readonly finalNewline:boolean;
}
export interface FixtureCreatePlan{
  readonly request:FixtureCreateRequest;
  readonly name:string;
  readonly content:string;
  readonly summary:FixtureByteSummary;
}
/** Keep all non-newline characters including trailing spaces. Empty
 * expected output is different from an absent fixture. */
export function planFixtureCreation(inventory:FixtureInventory,request:FixtureCreateRequest):FixtureResult<FixtureCreatePlan>{
  const slot=fixtureSlot(inventory,request.testName,request.stream);
  if(!slot||slot.status!=='absent')return fail('Choose an absent fixture for an observed regular test source.');
  if(request.lineEnding!=='LF'&&request.lineEnding!=='CRLF')return fail('Choose an explicit line ending.');
  if(typeof request.text!=='string'||request.text.length>MAX_FIXTURE_CREATE_BYTES||typeof request.finalNewline!=='boolean')
    return fail('Fixture text exceeds the creation budget or has invalid options.');
  try{assertWellFormedUtf16(request.text,'Fixture text');}catch{return fail('Fixture text contains malformed Unicode.');}
  const ending=request.lineEnding==='CRLF'?'\r\n':'\n';
  let content=request.text.replace(/\r\n|\r|\n/g,ending);
  if(request.finalNewline&&!content.endsWith(ending))content+=ending;
  const bytes=new TextEncoder().encode(content);
  if(bytes.length>MAX_FIXTURE_CREATE_BYTES)return fail('New fixture exceeds the 64 KiB UTF-8 creation limit.');
  const summary=summarizeFixtureBytes(bytes);
  if(!summary.ok)return summary;
  return {ok:true,value:Object.freeze({request:Object.freeze({...request}),name:slot.name,content,summary:summary.value})};
}
export function fixturePlanMatches(plan:FixtureCreatePlan,inventory:FixtureInventory):boolean{
  const current=planFixtureCreation(inventory,plan.request);
  return current.ok&&current.value.name===plan.name&&current.value.content===plan.content&&
    JSON.stringify(current.value.summary)===JSON.stringify(plan.summary);
}
