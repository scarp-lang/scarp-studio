import { MAX_SCARP_FOLDER_DEPTH, safeRelativeScarpDirectory, safeRelativeScarpSourceName } from './folderListing';
import { workspaceItemNameError } from './workspaceCreate';
import { scaffoldManifest, scaffoldTemplate } from './projectScaffoldTemplates';
import { assertWellFormedUtf16,utf8ByteLength } from './utf8Text';
export const MAX_SCAFFOLD_FILES=12;
export const MAX_SCAFFOLD_FILE_BYTES=32*1024;
export const MAX_SCAFFOLD_TOTAL_BYTES=96*1024;
export const MAX_SCAFFOLD_PROJECT_NAME=120;
export const MAX_SCAFFOLD_VERSION=80;
export interface ProjectScaffoldRequest {
  readonly parent:string;
  readonly folderName:string;
  readonly projectName:string;
  readonly version:string;
  readonly template:string;
  readonly includeTests:boolean;
}
export interface ScaffoldFile {
  readonly path:string;
  readonly content:string;
  readonly bytes:number;
  readonly kind:'manifest'|'source'|'test';
}
export interface ProjectScaffoldPlan {
  readonly request:ProjectScaffoldRequest;
  readonly directory:string;
  readonly directories:readonly string[];
  readonly files:readonly ScaffoldFile[];
  readonly bytes:number;
}
export type ScaffoldResult<T>={readonly ok:true;readonly value:T}|{readonly ok:false;readonly error:string};
const fail=(error:string):ScaffoldResult<never>=>({ok:false,error});
export function scaffoldVersionValid(version:string):boolean{
  if(version.length>MAX_SCAFFOLD_VERSION)return false;
  const match=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(version);
  return !!match&&(!match[4]||match[4].split('.').every(part=>!/^\d+$/.test(part)||part==='0'||!part.startsWith('0')));
}
function validProjectName(name:string):boolean{
  if(!name||name.length>MAX_SCAFFOLD_PROJECT_NAME||name!==name.trim()||
    /[\x00-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/.test(name))return false;
  try{assertWellFormedUtf16(name,'Project name');return true;}catch{return false;}
}
/** New child directory of an observed workspace target. All source paths
 * are fixed by the catalog, not user-entered arbitrary paths. */
export function planProjectScaffold(request:ProjectScaffoldRequest,targets:readonly string[]):ScaffoldResult<ProjectScaffoldPlan>{
  if(!targets.includes(request.parent)||(request.parent!==''&&!safeRelativeScarpDirectory(request.parent))){
    return fail('Choose a currently available workspace parent.');
  }
  const segments=request.parent?request.parent.split('/'):[];
  if(segments.some(segment=>workspaceItemNameError(segment)!==null))return fail('The selected parent is not a portable visible folder.');
  const nameError=workspaceItemNameError(request.folderName);
  if(nameError)return fail(nameError);
  if(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/.test(request.folderName))return fail('Folder name contains invisible directional formatting.');
  if(!validProjectName(request.projectName))return fail('Enter a visible project name of 1–120 characters.');
  if(!scaffoldVersionValid(request.version))return fail('Enter a semantic version, such as 0.1.0.');
  const template=scaffoldTemplate(request.template);
  if(!template||typeof request.includeTests!=='boolean')return fail('Choose a supported template.');
  const directory=[...segments,request.folderName].join('/');
  if(!safeRelativeScarpDirectory(directory)||segments.length+2>MAX_SCARP_FOLDER_DEPTH){
    return fail('The new project and src/tests folders must fit the bounded Explorer depth.');
  }
  const raw=[
    {path:'scarp.project',content:scaffoldManifest(request.projectName,request.version),kind:'manifest' as const},
    ...template.sourceFiles.map(item=>({...item,kind:'source' as const})),
    ...(request.includeTests?template.testFiles.map(item=>({...item,kind:'test' as const})):[]),
  ];
  if(raw.length>MAX_SCAFFOLD_FILES)return fail('Template exceeds the project file budget.');
  const names=new Set<string>(),dirs=new Set<string>();
  let bytes=0;
  const files:ScaffoldFile[]=[];
  for(const item of raw){
    const key=item.path.toLowerCase();
    if(names.has(key))return fail('Template contains a duplicate destination.');
    names.add(key);
    if(item.kind==='manifest'){
      if(item.path!=='scarp.project')return fail('Unexpected manifest destination.');
    }else{
      if(!safeRelativeScarpSourceName(directory+'/'+item.path)||item.path.split('/').length!==2||
        !item.path.startsWith(item.kind==='test'?'tests/':'src/'))return fail('Unsupported template source path.');
      const [parent,basename]=item.path.split('/');
      if(workspaceItemNameError(basename)!==null)return fail('Unsupported template filename.');
      dirs.add(parent);
    }
    try{assertWellFormedUtf16(item.content,'Template source');}catch{return fail('Template contains unsupported text.');}
    const size=utf8ByteLength(item.content);bytes+=size;
    if(size<1||size>MAX_SCAFFOLD_FILE_BYTES||bytes>MAX_SCAFFOLD_TOTAL_BYTES)return fail('Template exceeds the byte budget.');
    files.push(Object.freeze({...item,bytes:size}));
  }
  if(!files.some(file=>file.path==='src/main.srp'))return fail('Template lacks an entry source.');
  return {ok:true,value:Object.freeze({
    request:Object.freeze({...request}),directory,directories:Object.freeze([...dirs]),files:Object.freeze(files),bytes,
  })};
}
export function scaffoldPlanIsCurrent(plan:ProjectScaffoldPlan,targets:readonly string[]):boolean{
  const fresh=planProjectScaffold(plan.request,targets);
  return fresh.ok&&JSON.stringify(fresh.value)===JSON.stringify(plan);
}
export type ScaffoldStepKind='directory'|'file';
export interface ScaffoldStep {readonly kind:ScaffoldStepKind;readonly relativePath:string}
export interface ScaffoldCompletion {
  readonly status:'complete'|'blocked'|'partial';
  readonly directory:string;
  readonly created:readonly ScaffoldStep[];
  readonly uncertain:readonly ScaffoldStep[];
  readonly error:string|null;
}
export function summarizeScaffoldResult(result:ScaffoldCompletion):string{
  const dirs=result.created.filter(step=>step.kind==='directory').length;
  const files=result.created.length-dirs;
  const summary=dirs+' confirmed director'+(dirs===1?'y':'ies')+' and '+files+' confirmed file(s)';
  if(result.status==='complete')return 'Created project '+result.directory+' — '+summary+'.';
  if(result.status==='blocked')return 'Project creation blocked before a confirmed write. '+(result.error??'');
  return 'Project creation stopped with '+summary+
    (result.uncertain.length?' and '+result.uncertain.length+' uncertain destination(s)':'')+
    '. Inspect the folder before retrying; nothing was rolled back. '+(result.error??'');
}
