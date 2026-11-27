import { useMemo,useState } from 'react';
import { PROJECT_SCAFFOLD_TEMPLATES,scaffoldTemplate } from '../model/projectScaffoldTemplates';
import { planProjectScaffold,scaffoldPlanIsCurrent,summarizeScaffoldResult,MAX_SCAFFOLD_PROJECT_NAME,MAX_SCAFFOLD_VERSION,
  type ProjectScaffoldRequest,type ProjectScaffoldPlan,type ScaffoldCompletion } from '../model/projectScaffold';
import { workspaceCreationTargets,MAX_WORKSPACE_ITEM_NAME } from '../model/workspaceCreate';
interface Props{
  directories:readonly string[];
  unavailable:readonly string[];
  busy:boolean;
  onCreate:(plan:ProjectScaffoldPlan)=>Promise<ScaffoldCompletion>;
}
const initial:ProjectScaffoldRequest={parent:'',folderName:'',projectName:'',version:'0.1.0',template:'hello',includeTests:true};
export function ProjectScaffoldPanel({directories,unavailable,busy,onCreate}:Props){
  const [expanded,setExpanded]=useState(false);
  const [request,setRequest]=useState<ProjectScaffoldRequest>(initial);
  const [review,setReview]=useState<ProjectScaffoldPlan|null>(null);
  const [activeFile,setActiveFile]=useState('scarp.project');
  const [ack,setAck]=useState(false);
  const [pending,setPending]=useState(false);
  const [completion,setCompletion]=useState<ScaffoldCompletion|null>(null);
  const targets=useMemo(()=>workspaceCreationTargets(directories,unavailable),[directories,unavailable]);
  const validation=planProjectScaffold(request,targets);
  const template=scaffoldTemplate(request.template);
  const current=review!==null&&scaffoldPlanIsCurrent(review,targets);
  const locked=busy||pending;
  function change(patch:Partial<ProjectScaffoldRequest>){
    setRequest(previous=>({...previous,...patch}));setReview(null);setAck(false);setCompletion(null);
  }
  function preview(){
    if(!validation.ok)return;
    setReview(validation.value);setAck(false);setActiveFile('scarp.project');setCompletion(null);
  }
  async function create(){
    if(!review||!current||!ack||locked)return;
    setPending(true);
    try{setCompletion(await onCreate(review));}
    catch(error){setCompletion({status:'partial',directory:review.directory,created:[],uncertain:[],
      error:'Creation outcome unavailable: '+(error instanceof Error?error.message:String(error))});}
    finally{setReview(null);setAck(false);setPending(false);}
  }
  return <section className="workspace-create-panel project-scaffold" aria-label="New Scarp project wizard">
    <button type="button" className="insights-toggle" aria-expanded={expanded} aria-controls="studio-project-scaffold"
      disabled={pending} onClick={()=>{setExpanded(v=>!v);setReview(null);setAck(false);}}>
      <span aria-hidden="true">{expanded?'▾':'▸'}</span><span>{expanded?'Hide project wizard':'New Scarp project'}</span>
    </button>
    <div id="studio-project-scaffold" hidden={!expanded}>
      {expanded&&<div className="workspace-create-form">
        <p>Create a new child project folder containing a modern manifest, entry source and optional tests.
          Nothing executes automatically. Existing items are never intentionally overwritten.</p>
        <label>Parent folder<select aria-label="New project parent" value={request.parent} disabled={locked||!!review} onChange={event=>change({parent:event.target.value})}>
          {!targets.includes(request.parent)&&<option value={request.parent} disabled>Previous parent unavailable</option>}
          {targets.map(target=><option key={target} value={target}>{target||'Workspace root'}</option>)}
        </select></label>
        <label>Folder name<input aria-label="New project folder name" maxLength={MAX_WORKSPACE_ITEM_NAME} value={request.folderName} disabled={locked||!!review}
          onChange={event=>{const folderName=event.target.value;change({folderName,...(!request.projectName||request.projectName===request.folderName?{projectName:folderName}:{})});}}/></label>
        <label>Project name<input aria-label="New project display name" maxLength={MAX_SCAFFOLD_PROJECT_NAME} value={request.projectName} disabled={locked||!!review}
          onChange={event=>change({projectName:event.target.value})}/></label>
        <label>Version<input aria-label="New project version" maxLength={MAX_SCAFFOLD_VERSION} value={request.version} disabled={locked||!!review}
          onChange={event=>change({version:event.target.value})}/></label>
        <label>Template<select aria-label="New project template" value={request.template} disabled={locked||!!review} onChange={event=>change({template:event.target.value})}>
          {PROJECT_SCAFFOLD_TEMPLATES.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}
        </select></label>
        {template&&<p>{template.description}</p>}
        <label><input type="checkbox" checked={request.includeTests} disabled={locked||!!review} onChange={event=>change({includeTests:event.target.checked})}/> Include starter tests</label>
        {validation.ok?<p role="status">Destination: {validation.value.directory} · {validation.value.files.length} files · {validation.value.bytes} UTF-8 bytes</p>:
          request.folderName&&<p role="status">{validation.error}</p>}
        <button type="button" disabled={locked||!!review||!validation.ok} onClick={preview}>Review new project</button>
        {review&&<div className="transfer-review" role="group" aria-label="Confirm new Scarp project">
          <strong>{review.directory}</strong>
          <p>Review every file. The manifest is created last. If creation fails, confirmed and uncertain new items are reported;
            no cleanup deletion or rollback is performed.</p>
          <ul>{review.files.map(file=><li key={file.path}>{file.path} · {file.bytes} bytes</li>)}</ul>
          <select aria-label="Project preview file" value={activeFile} onChange={event=>setActiveFile(event.target.value)}>
            {review.files.map(file=><option key={file.path} value={file.path}>{file.path}</option>)}
          </select>
          <textarea aria-label="New project file preview" readOnly rows={10} value={review.files.find(file=>file.path===activeFile)?.content??''}/>
          {!current&&<p role="alert">Parent or preview changed. Cancel and review again.</p>}
          <label><input type="checkbox" checked={ack} disabled={locked||!current} onChange={event=>setAck(event.target.checked)}/>
            I reviewed the new destinations and understand that creation can leave a partial new folder.</label>
          <button type="button" disabled={locked||!ack||!current} onClick={()=>void create()}>{pending?'Creating project…':'Confirm create project'}</button>
          <button type="button" disabled={pending} onClick={()=>{setReview(null);setAck(false);}}>Cancel project preview</button>
        </div>}
        {completion&&<div className="transfer-review" role={completion.status==='complete'?'status':'alert'}>
          <strong>{completion.status==='complete'?'Project created':completion.status==='blocked'?'Creation blocked':'Partial or uncertain creation'}</strong>
          <p>{summarizeScaffoldResult(completion)}</p>
          {completion.created.length>0&&<details><summary>Confirmed created items</summary>
            <ul>{completion.created.map(step=><li key={step.relativePath}>{step.kind}: {step.relativePath}</li>)}</ul></details>}
          {completion.uncertain.length>0&&<details><summary>Inspect these uncertain items</summary>
            <ul>{completion.uncertain.map(step=><li key={step.relativePath}>{step.kind}: {step.relativePath}</li>)}</ul></details>}
          <p>Refresh Explorer and explicitly select the new project target before running commands.</p>
        </div>}
      </div>}
    </div>
  </section>;
}
