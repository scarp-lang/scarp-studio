import {useEffect,useMemo,useState} from 'react';
import type {MigrationRule} from '../model/migrationRules';
import {emptyMigrationRecipes,addMigrationRecipe,renameMigrationRecipe,removeMigrationRecipe,clearMigrationRecipes,
  prepareMigrationRecipeReview,confirmMigrationRecipeApply,confirmMigrationRecipeReplace,exportMigrationRecipes,
  reviewMigrationRecipeImport,confirmMigrationRecipeImport,MAX_MIGRATION_RECIPES,MAX_RECIPE_BACKUP_UNITS,
  type MigrationRecipeLibrary,type MigrationRecipeReview,type RecipeImportReview} from '../model/migrationRecipes';
function Mappings({rules}:{rules:readonly MigrationRule[]}){
  return <ol>{rules.map((rule,index)=><li key={index}><code>{rule.from||'(empty original)'}</code> → <code>{rule.to||'(empty replacement)'}</code></li>)}</ol>;
}
export function MigrationRecipesPanel({drafts,busy,visible,onApply}:{
  drafts:readonly MigrationRule[];busy:boolean;visible:boolean;onApply:(rules:readonly MigrationRule[])=>void;
}){
  const [library,setLibrary]=useState(emptyMigrationRecipes);
  const [expanded,setExpanded]=useState(false);
  const [name,setName]=useState('');
  const [selected,setSelected]=useState<number|null>(null);
  const [review,setReview]=useState<MigrationRecipeReview|null>(null);
  const [showRules,setShowRules]=useState(false);
  const [showBackup,setShowBackup]=useState(false);
  const [raw,setRaw]=useState('');
  const [importReview,setImportReview]=useState<RecipeImportReview|null>(null);
  const [selection,setSelection]=useState<readonly number[]>([]);
  const [detail,setDetail]=useState<number|null>(null);
  const [clearReview,setClearReview]=useState<MigrationRecipeLibrary|null>(null);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  const chosen=library.recipes.find(item=>item.id===selected);
  const backup=useMemo(()=>showBackup?exportMigrationRecipes(library):null,[library,showBackup]);
  function close(){
    setExpanded(false);setReview(null);setShowRules(false);setShowBackup(false);setRaw('');
    setImportReview(null);setSelection([]);setDetail(null);setClearReview(null);setName('');setNotice('');setError('');
  }
  useEffect(()=>{if(!visible){setExpanded(false);setReview(null);setShowRules(false);setShowBackup(false);setRaw('');
    setImportReview(null);setSelection([]);setDetail(null);setClearReview(null);setName('');setNotice('');setError('');}},[visible]);
  function fail(message:string){setError(message);setNotice('');}
  function commit(next:MigrationRecipeLibrary,message:string){
    setLibrary(next);setReview(null);setImportReview(null);setSelection([]);setClearReview(null);
    setNotice(message);setError('');setDetail(null);
    if(!next.recipes.some(item=>item.id===selected))setSelected(null);
  }
  function save(){
    if(busy)return;
    const result=addMigrationRecipe(library,name,drafts);
    if(!result.ok){fail(result.error);return;}
    commit(result.value,'Saved mapping recipe. No source scan or edit.');setSelected(result.value.recipes.at(-1)?.id??null);setName('');
  }
  function rename(){
    if(busy||!chosen)return;
    const result=renameMigrationRecipe(library,chosen.id,name);
    if(!result.ok){fail(result.error);return;}
    commit(result.value,'Renamed mapping recipe.');setName('');
  }
  function remove(){
    if(busy||!chosen)return;
    const result=removeMigrationRecipe(library,chosen.id);
    if(!result.ok){fail(result.error);return;}
    commit(result.value,'Removed mapping recipe.');
  }
  function prepare(action:'apply'|'replace'){
    if(busy||!chosen)return;
    const result=prepareMigrationRecipeReview(library,chosen.id,drafts,action);
    if(!result.ok){fail(result.error);return;}
    setReview(result.value);setImportReview(null);setClearReview(null);setNotice('');setError('');
  }
  function confirm(){
    if(busy||!review)return;
    if(review.action==='apply'){
      const result=confirmMigrationRecipeApply(library,review,drafts);
      if(!result.ok){setReview(null);fail(result.error);return;}
      onApply(result.value);setReview(null);setNotice('Loaded recipe into mapping drafts. Review source scope separately.');setError('');
    }else{
      const result=confirmMigrationRecipeReplace(library,review,drafts);
      if(!result.ok){setReview(null);fail(result.error);return;}
      commit(result.value,'Replaced saved recipe mappings.');
    }
  }
  function previewImport(){
    if(busy)return;
    const result=reviewMigrationRecipeImport(library,raw);
    if(!result.ok){setImportReview(null);setSelection([]);fail(result.error);return;}
    setImportReview(result.value);setSelection([]);setReview(null);setClearReview(null);setDetail(null);setError('');setNotice('');
  }
  function importSelected(){
    if(busy||!importReview||importReview.raw!==raw)return;
    const result=confirmMigrationRecipeImport(library,importReview,selection);
    if(!result.ok){fail(result.error);return;}
    commit(result.value,'Imported '+selection.length+' new mapping recipe(s).');setRaw('');
  }
  if(!visible)return null;
  return <section className="project-scope-coverage" aria-label="Migration mapping recipes">
    <button type="button" aria-expanded={expanded} onClick={()=>expanded?close():setExpanded(true)}>
      {expanded?'Hide mapping recipes':'Manage mapping recipes'}
    </button>
    {expanded&&<>
      <p>Save reusable ordered mappings for this workspace session. Recipes contain no paths, source text, scope,
        selected sites, warnings acknowledgement or execution authority. Loading a recipe only changes mapping drafts.</p>
      <p>{library.recipes.length} / {MAX_MIGRATION_RECIPES} recipes saved.</p>
      <label>Recipe name<input aria-label="Migration recipe name" maxLength={64} value={name} disabled={busy}
        onChange={event=>setName(event.target.value)}/></label>
      <button type="button" disabled={busy||!name.trim()||library.recipes.length>=MAX_MIGRATION_RECIPES}
        onClick={save}>Save current mappings as recipe</button>
      <label>Saved recipe<select aria-label="Saved migration recipe" value={selected??''} disabled={busy}
        onChange={event=>{setSelected(event.target.value?Number(event.target.value):null);setReview(null);setShowRules(false);setClearReview(null);}}>
        <option value="">Choose a recipe</option>{library.recipes.map(item=>
          <option key={item.id} value={item.id}>{item.name} ({item.rules.length} mappings)</option>)}
      </select></label>
      <button type="button" disabled={!chosen} aria-expanded={showRules} onClick={()=>setShowRules(!showRules)}>
        {showRules?'Hide saved recipe mappings':'Review saved recipe mappings'}
      </button>
      {showRules&&chosen&&<Mappings rules={chosen.rules}/>}
      <button type="button" disabled={busy||!chosen} onClick={()=>prepare('apply')}>Review loading migration recipe</button>
      <button type="button" disabled={busy||!chosen} onClick={()=>prepare('replace')}>Review replacing saved recipe</button>
      <button type="button" disabled={busy||!chosen||!name.trim()} onClick={rename}>Rename selected migration recipe</button>
      <button type="button" disabled={busy||!chosen} onClick={remove}>Remove selected migration recipe</button>
      {review&&<section aria-label="Review migration recipe change">
        <p>{review.action==='apply'?'Load mappings into drafts':'Replace the saved mapping recipe'}: {review.selected.name}</p>
        <h5>Current drafts</h5><Mappings rules={review.drafts}/>
        <h5>Saved mapping recipe</h5><Mappings rules={review.selected.rules}/>
        <p>This does not scan or edit source files.</p>
        <button type="button" disabled={busy} onClick={confirm}>Confirm migration recipe change</button>
        <button type="button" onClick={()=>setReview(null)}>Cancel migration recipe change</button>
      </section>}
      <button type="button" disabled={busy||!library.recipes.length} onClick={()=>setClearReview(library)}>Review clearing mapping recipes</button>
      {clearReview&&<div><p>Remove {clearReview.recipes.length} saved mapping recipes? Current drafts remain unchanged.</p>
        <button type="button" disabled={busy||clearReview!==library} onClick={()=>commit(clearMigrationRecipes(library),'Cleared saved recipes.')}>Confirm clear mapping recipes</button>
        <button type="button" onClick={()=>setClearReview(null)}>Cancel clearing mapping recipes</button>
      </div>}
      <h4>Portable recipe backup</h4>
      <label><input type="checkbox" checked={showBackup} onChange={event=>setShowBackup(event.target.checked)}/>
        Reveal private migration backup containing identifier names</label>
      {backup?.ok&&<textarea aria-label="Migration recipe backup" rows={9} readOnly value={backup.value}/>}
      {backup&&!backup.ok&&<p role="alert">{backup.error}</p>}
      <label>Import backup<textarea aria-label="Import migration recipe backup" rows={6} maxLength={MAX_RECIPE_BACKUP_UNITS}
        disabled={busy} value={raw} onChange={event=>{setRaw(event.target.value);setImportReview(null);setSelection([]);setDetail(null);}}/></label>
      <button type="button" disabled={busy||!raw} onClick={previewImport}>Review importing migration recipes</button>
      {importReview&&<section aria-label="Review migration recipe import">
        <p>{importReview.capacity} remaining recipe slots. Identical and conflicting names are never overwritten.</p>
        <ul>{importReview.rows.map((row,index)=><li key={index}>
          <label><input type="checkbox" checked={selection.includes(index)}
            disabled={busy||row.status!=='new'||(!selection.includes(index)&&selection.length>=importReview.capacity)}
            onChange={()=>setSelection(previous=>previous.includes(index)?previous.filter(value=>value!==index):[...previous,index])}/>
            {row.incoming.name} · {row.status}</label>
          <button type="button" aria-expanded={detail===index} onClick={()=>setDetail(detail===index?null:index)}>
            Review imported mappings for {row.incoming.name}
          </button>
          {detail===index&&<><Mappings rules={row.incoming.rules}/>
            {row.existing&&<><h5>Existing recipe</h5><Mappings rules={row.existing.rules}/></>}</>}
        </li>)}</ul>
        <button type="button" disabled={busy||!selection.length} onClick={importSelected}>Import selected migration recipes</button>
        <button type="button" onClick={()=>{setImportReview(null);setSelection([]);setDetail(null);}}>Cancel migration recipe import</button>
      </section>}
      {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
    </>}
  </section>;
}
