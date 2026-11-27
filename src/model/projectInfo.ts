import { sameFilePath,isScarpPath,isDirty,type StudioDocument } from './documents';
import { safeRelativeScarpSourceName,safeRelativeScarpDirectory } from './folderListing';
import type { TestSourceListing } from './projectTestNavigation';

export const MAX_PROJECT_INFO_UNITS=16*1024;
export const MAX_PROJECT_NAME_UNITS=4096;
export interface ProjectInfo {
  readonly name:string;
  readonly version:string|null;
  readonly type:'application';
  readonly entry:string;
  readonly manifest:'scarp.project'|'Scarp.project';
  readonly format:'v2'|'legacy-v1';
}
export type ProjectInfoParse={readonly ok:true;readonly info:ProjectInfo}|{readonly ok:false;readonly reason:string};
function fail(reason:string):ProjectInfoParse{return {ok:false,reason};}
function validText(value:unknown,max:number):value is string{
  if(typeof value!=='string'||!value.length||value.length>max||/[\x00-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/.test(value))return false;
  // Reject malformed surrogate sequences rather than rendering replacement glyphs.
  for(let i=0;i<value.length;i++){
    const unit=value.charCodeAt(i);
    if(unit>=0xd800&&unit<=0xdbff){
      const next=value.charCodeAt(++i);
      if(!(next>=0xdc00&&next<=0xdfff))return false;
    }else if(unit>=0xdc00&&unit<=0xdfff)return false;
  }
  return true;
}
function validVersion(value:unknown):value is string{
  if(!validText(value,512))return false;
  const match=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(value);
  return !!match&&(!match[4]||match[4].split('.').every(part=>!/^\d+$/.test(part)||part==='0'||!part.startsWith('0')));
}
/** Separate compiler JSON response, never a parse of display stdout. Paths
 * are project-relative labels. Browsability is deliberately stricter than
 * the CLI's entry grammar and is checked separately for any opening action. */
export function parseProjectInfo(json:string):ProjectInfoParse{
  if(typeof json!=='string'||json.length>MAX_PROJECT_INFO_UNITS)return fail('Project metadata exceeds the response budget.');
  let data:unknown;try{data=JSON.parse(json);}catch{return fail('Project metadata is not complete JSON.');}
  if(!data||typeof data!=='object'||Array.isArray(data))return fail('Invalid project metadata envelope.');
  const obj=data as Record<string,unknown>;
  if(obj.schema_version!==1||obj.type!=='application'||!validText(obj.name,MAX_PROJECT_NAME_UNITS)||
    !validText(obj.entry,4096)||!isScarpPath(obj.entry))return fail('Unsupported project metadata schema, type or entry.');
  const format=obj.format;
  const manifest=obj.manifest;
  if(format!=='v2'&&format!=='legacy-v1')return fail('Unsupported manifest format.');
  // Both filename spellings are accepted by the official compiler. Format
  // describes content, not case; legacy content may have a lowercase name.
  if(manifest!=='scarp.project'&&manifest!=='Scarp.project')return fail('Unexpected manifest filename.');
  if(format==='legacy-v1'?obj.version!==null:!validVersion(obj.version))return fail('Invalid project version for manifest format.');
  if(/[:\\]/.test(obj.entry)||obj.entry.startsWith('/')||obj.entry.split('/').some(part=>!part||part==='.'||part==='..')){
    return fail('Project entry is not a normalized relative source label.');
  }
  return {ok:true,info:Object.freeze({name:obj.name,version:obj.version as string|null,type:'application',entry:obj.entry,manifest,format})};
}
export interface ProjectInfoSnapshot{
  readonly folder:string;
  readonly info:ProjectInfo;
}
export type EntryState =
  | { readonly kind:'not-listed'; readonly reason:string }
  | { readonly kind:'listed'; readonly path:string; readonly name:string; readonly open:boolean; readonly dirty:boolean };

/** No path construction from compiler text. Match exact relative labels
 * against the current native listing and reject ambiguous aliases. The
 * resolved path is still only a listing entry, not a new filesystem grant. */
export function projectInfoEntry(snapshot:ProjectInfoSnapshot,listing:TestSourceListing|null,
  documents:readonly StudioDocument[]):EntryState{
  const missing=(reason:string):EntryState=>({kind:'not-listed',reason});
  if(!listing)return missing('No selected Explorer listing.');
  if(!safeRelativeScarpSourceName(snapshot.info.entry))return missing('Entry is outside Studio’s bounded browsable source labels.');
  const roots=(listing.projectRoots??[]).filter(root=>sameFilePath(root.path,snapshot.folder));
  if(roots.length!==1)return missing('Project root is no longer uniquely present in Explorer.');
  const directory=roots[0].directory;
  if(directory&&!safeRelativeScarpDirectory(directory))return missing('Project root label is not browsable.');
  const name=directory?directory+'/'+snapshot.info.entry:snapshot.info.entry;
  const matches=listing.files.filter(file=>file.name===name);
  if(matches.length!==1||!safeRelativeScarpSourceName(name)||!isScarpPath(matches[0].path))return missing('Entry is not uniquely listed by the current Explorer scan.');
  const path=matches[0].path;
  if(listing.files.filter(file=>sameFilePath(file.path,path)).length!==1)return missing('Entry path has ambiguous Explorer aliases.');
  const open=documents.filter(doc=>doc.path!==null&&sameFilePath(doc.path,path));
  if(open.length>1)return missing('Entry has ambiguous open editor identities.');
  return {kind:'listed',path,name,open:open.length===1,dirty:open.some(isDirty)};
}
export const PROJECT_INFO_FIELDS=['name','version','type','entry','manifest','format'] as const;
export type ProjectInfoField=typeof PROJECT_INFO_FIELDS[number];
export const PROJECT_INFO_LABELS:Readonly<Record<ProjectInfoField,string>>=Object.freeze({
  name:'Project name',version:'Version',type:'Project type',entry:'Entry source',manifest:'Manifest filename',format:'Manifest format',
});
export interface ProjectInfoChange{
  readonly field:ProjectInfoField;
  readonly before:string|null;
  readonly after:string|null;
}
export function compareProjectInfo(baseline:ProjectInfoSnapshot,current:ProjectInfoSnapshot):readonly ProjectInfoChange[]|null{
  if(!sameFilePath(baseline.folder,current.folder))return null;
  return Object.freeze(PROJECT_INFO_FIELDS.filter(field=>baseline.info[field]!==current.info[field])
    .map(field=>Object.freeze({field,before:baseline.info[field],after:current.info[field]})));
}
export function projectInfoReport(snapshot:ProjectInfoSnapshot,baseline:ProjectInfoSnapshot|null,includeLabels=false):string{
  const changes=baseline?compareProjectInfo(baseline,snapshot):null;
  const lines=[
    'Scarp Studio — saved manifest metadata snapshot',
    'Read-only metadata, not verification or proof that the source executes.',
    'Type: '+snapshot.info.type,'Format: '+snapshot.info.format,
    'Manifest: '+snapshot.info.manifest,'Version: '+(snapshot.info.version??'unspecified'),
    includeLabels?'Project: '+JSON.stringify(snapshot.info.name):'Project name omitted',
    includeLabels?'Entry: '+JSON.stringify(snapshot.info.entry):'Entry label omitted',
    changes===null?'No comparable baseline':changes.length+' changed metadata field(s)',
  ];
  for(const change of changes??[]){
    const label=PROJECT_INFO_LABELS[change.field];
    const hidden=!includeLabels&&(change.field==='name'||change.field==='entry');
    lines.push(hidden?label+': changed (values omitted)':label+': '+JSON.stringify(change.before)+' → '+JSON.stringify(change.after));
  }
  return lines.join('\n');
}
