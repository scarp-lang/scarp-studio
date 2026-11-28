import { useMemo, useState } from 'react';
import { VERIFICATION_EXPECTATION_LABELS, type VerificationRule } from '../model/projectVerification';
import {
  createVerificationProfileLibrary, addVerificationProfile, renameVerificationProfile,
  removeVerificationProfile, clearVerificationProfiles, prepareVerificationProfileReview,
  confirmVerificationProfileApply, confirmVerificationProfileReplace,
  exportVerificationProfiles, reviewVerificationImport, confirmVerificationImport,
  MAX_VERIFICATION_PROFILES, MAX_VERIFICATION_BACKUP_UNITS,
  type VerificationProfileReview, type VerificationImportReview, type VerificationProfileLibrary,
} from '../model/verificationProfiles';

interface Props {
  current: readonly VerificationRule[];
  busy: boolean;
  onApply: (rules: readonly VerificationRule[]) => boolean;
}
function RuleList({rules}:{rules:readonly VerificationRule[]}){
  return <ol>{rules.map((rule,index)=><li key={index}>
    <strong>{rule.name}</strong> · {VERIFICATION_EXPECTATION_LABELS[rule.expectation]}
    <p><code dir="auto">{JSON.stringify(rule.query)}</code> · {rule.options.caseSensitive?'Case sensitive':'Ignore case'}
      {' · '}{rule.options.wholeWord?'Whole word':'Substring'}</p>
  </li>)}</ol>;
}

export function VerificationProfilesPanel({current,busy,onApply}:Props){
  const [expanded,setExpanded]=useState(false);
  const [library,setLibrary]=useState(createVerificationProfileLibrary);
  const [name,setName]=useState('');
  const [selected,setSelected]=useState<number|null>(null);
  const [review,setReview]=useState<VerificationProfileReview|null>(null);
  const [showBackup,setShowBackup]=useState(false);
  const [importText,setImportText]=useState('');
  const [importReview,setImportReview]=useState<VerificationImportReview|null>(null);
  const [importSelection,setImportSelection]=useState<readonly number[]>([]);
  const [showRules,setShowRules]=useState(false);
  const [showImportRules,setShowImportRules]=useState<number|null>(null);
  const [clearReview,setClearReview]=useState<VerificationProfileLibrary|null>(null);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  const chosen=library.profiles.find(item=>item.id===selected);
  const backup=useMemo(()=>showBackup?exportVerificationProfiles(library):null,[showBackup,library]);
  function commit(next:VerificationProfileLibrary,message:string){
    setLibrary(next);setReview(null);setImportReview(null);setImportSelection([]);
    setClearReview(null);setNotice(message);setError('');
    if(!next.profiles.some(item=>item.id===selected))setSelected(null);
  }
  function fail(message:string){setError(message);setNotice('');}
  function save(){
    if(busy)return;
    const result=addVerificationProfile(library,name,current);
    if(!result.ok){fail(result.error);return;}
    commit(result.value,'Saved verification profile.');
    setSelected(result.value.profiles.at(-1)?.id??null);
    setName('');
  }
  function rename(){
    if(busy||!chosen)return;
    const result=renameVerificationProfile(library,chosen.id,name);
    if(!result.ok){fail(result.error);return;}
    commit(result.value,'Renamed verification profile.');
    setName('');
  }
  function remove(){
    if(busy||!chosen)return;
    const result=removeVerificationProfile(library,chosen.id);
    if(!result.ok){fail(result.error);return;}
    commit(result.value,'Removed verification profile.');
  }
  function prepare(action:'apply'|'replace'){
    if(busy||!chosen)return;
    const result=prepareVerificationProfileReview(library,chosen.id,current,action);
    if(!result.ok){fail(result.error);return;}
    setReview(result.value);setImportReview(null);setClearReview(null);setNotice('');setError('');
  }
  function confirm(){
    if(busy||!review)return;
    if(review.action==='apply'){
      const result=confirmVerificationProfileApply(library,review,current);
      if(!result.ok){setReview(null);fail(result.error);return;}
      if(!onApply(result.value)){fail('Rule editor rejected the profile. Review again.');return;}
      setReview(null);setNotice('Applied profile to rule editor. No source read or verification run.');setError('');
    }else{
      const result=confirmVerificationProfileReplace(library,review,current);
      if(!result.ok){setReview(null);fail(result.error);return;}
      commit(result.value,'Replaced saved profile rules.');
    }
  }
  function previewImport(){
    if(busy)return;
    const result=reviewVerificationImport(library,importText);
    if(!result.ok){setImportReview(null);setImportSelection([]);fail(result.error);return;}
    setImportReview(result.value);setImportSelection([]);setShowImportRules(null);
    setReview(null);setClearReview(null);setError('');setNotice('');
  }
  function toggleImport(index:number){
    if(busy||!importReview||importReview.rows[index]?.status!=='new')return;
    setImportSelection(previous=>previous.includes(index)?previous.filter(item=>item!==index):
      previous.length<importReview.capacity?[...previous,index]:previous);
  }
  function importProfiles(){
    if(busy||!importReview||importReview.text!==importText)return;
    const result=confirmVerificationImport(library,importReview,importSelection);
    if(!result.ok){fail(result.error);return;}
    commit(result.value,'Imported '+importSelection.length+' verification profile(s).');
    setImportText('');
  }
  return <section className="project-scope-coverage" aria-label="Verification profiles">
    <button type="button" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>
      {expanded?'Hide verification profiles':'Manage verification profiles'}
    </button>
    {expanded&&<>
      <p>Save named rule sets for this session. Applying a profile changes drafts only; scope,
        snapshot mode, source permissions and execution remain separate.</p>
      <p>{library.profiles.length} / {MAX_VERIFICATION_PROFILES} profiles saved.</p>
      <label>Profile name<input aria-label="Verification profile name" maxLength={64} disabled={busy}
        value={name} onChange={event=>setName(event.target.value)}/></label>
      <button type="button" disabled={busy||!name.trim()||library.profiles.length>=MAX_VERIFICATION_PROFILES}
        onClick={save}>Save current verification rules</button>
      <label>Saved profile<select aria-label="Saved verification profile" disabled={busy||!library.profiles.length}
        value={selected??''} onChange={event=>{
          setSelected(event.target.value?Number(event.target.value):null);
          setReview(null);setShowRules(false);setError('');setNotice('');
        }}>
        <option value="">Choose a profile</option>
        {library.profiles.map(item=><option key={item.id} value={item.id}>{item.name} ({item.rules.length} rules)</option>)}
      </select></label>
      {chosen&&<>
        <button type="button" aria-expanded={showRules} onClick={()=>setShowRules(value=>!value)}>
          {showRules?'Hide saved profile rules':'Review saved profile rules'}
        </button>
        {showRules&&<RuleList rules={chosen.rules}/>}
        <div className="project-scope-fields">
          <button type="button" disabled={busy} onClick={()=>prepare('apply')}>Review applying profile</button>
          <button type="button" disabled={busy} onClick={()=>prepare('replace')}>Review replacing profile</button>
          <button type="button" disabled={busy||!name.trim()} onClick={rename}>Rename verification profile</button>
          <button type="button" disabled={busy} onClick={remove}>Remove verification profile</button>
        </div>
      </>}
      {review&&<section aria-label="Review verification profile change">
        <h4>{review.action==='apply'?'Replace current drafts':'Replace saved profile rules'}</h4>
        <p>{review.profile.name} · {review.action==='apply'?'No source read will occur.':'Only this saved profile will change.'}</p>
        <p>Current drafts</p><RuleList rules={review.current}/>
        <p>Saved rules</p><RuleList rules={review.profile.rules}/>
        <button type="button" disabled={busy} onClick={confirm}>Confirm verification profile change</button>
        <button type="button" onClick={()=>setReview(null)}>Cancel profile change</button>
      </section>}
      <button type="button" disabled={busy||!library.profiles.length} onClick={()=>{
        setClearReview(library);setReview(null);setImportReview(null);
      }}>Review clearing verification profiles</button>
      {clearReview&&<div aria-label="Review clearing profiles">
        <p>Remove all {clearReview.profiles.length} saved profiles from this session? Current drafts are unchanged.</p>
        <button type="button" disabled={busy} onClick={()=>{
          if(clearReview!==library){setClearReview(null);fail('Library changed. Review clearing again.');return;}
          commit(clearVerificationProfiles(library),'Cleared saved verification profiles.');
        }}>Confirm clear verification profiles</button>
        <button type="button" onClick={()=>setClearReview(null)}>Cancel clearing profiles</button>
      </div>}
      <label><input type="checkbox" checked={showBackup} onChange={event=>setShowBackup(event.target.checked)}/>
        Reveal private verification backup including literal queries</label>
      {showBackup&&backup&&<>{backup.ok?<label>Copyable profile backup<textarea aria-label="Verification profile backup"
        readOnly rows={8} value={backup.value}/></label>:<p role="alert">{backup.error}</p>}</>}
      <label>Import profile backup<textarea aria-label="Import verification profile backup" rows={6} disabled={busy}
        maxLength={MAX_VERIFICATION_BACKUP_UNITS+1} value={importText} onChange={event=>{
          setImportText(event.target.value);setImportReview(null);setImportSelection([]);setError('');
        }}/></label>
      <button type="button" disabled={busy||!importText.trim()} onClick={previewImport}>Review verification profile import</button>
      {importReview&&<section aria-label="Review verification profile import">
        <p>{importReview.capacity} spaces available. Existing names are never overwritten.</p>
        <ul>{importReview.rows.map(row=><li key={row.index}>
          <label><input type="checkbox" checked={importSelection.includes(row.index)}
            disabled={busy||row.status!=='new'||(!importSelection.includes(row.index)&&importSelection.length>=importReview.capacity)}
            onChange={()=>toggleImport(row.index)}/>{row.name} · {row.status}</label>
          <button type="button" aria-expanded={showImportRules===row.index} onClick={()=>setShowImportRules(
            value=>value===row.index?null:row.index)}>Review imported rules for {row.name}</button>
          {showImportRules===row.index&&<RuleList rules={row.rules}/>}
        </li>)}</ul>
        <button type="button" disabled={busy||!importSelection.length} onClick={importProfiles}>Import selected verification profiles</button>
        <button type="button" onClick={()=>{setImportReview(null);setImportSelection([]);}}>Cancel profile import</button>
      </section>}
      {notice&&<p role="status">{notice}</p>}
      {error&&<p role="alert">{error}</p>}
    </>}
  </section>;
}
