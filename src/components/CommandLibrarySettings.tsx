import { useMemo,useState } from 'react';
import { COMMAND_GROUPS,MAX_PINNED_COMMANDS,MAX_RECENT_COMMANDS,libraryCommandRows,commandCollectionEntries,
  type CommandPaletteLibrary,type CommandGroup,type LibraryClearReview } from '../model/commandPaletteLibrary';
import type { NavigationEntry } from '../model/navigation';
interface Props{
  library:CommandPaletteLibrary;
  commands:readonly NavigationEntry[];
  onTogglePin:(id:string)=>void;
  onMovePin:(id:string,direction:-1|1)=>void;
  onClear:(review:LibraryClearReview)=>void;
}
export function CommandLibrarySettings({library,commands,onTogglePin,onMovePin,onClear}:Props){
  const [expanded,setExpanded]=useState(false);
  const [query,setQuery]=useState('');
  const [group,setGroup]=useState<CommandGroup|'all'>('all');
  const [review,setReview]=useState<LibraryClearReview|null>(null);
  const rows=useMemo(()=>expanded?libraryCommandRows(commands,library,query,group):[],[expanded,commands,library,query,group]);
  const pinned=commandCollectionEntries(commands,library,'pinned');
  const recent=commandCollectionEntries(commands,library,'recent');
  return <section className="command-library-settings" aria-label="Command palette collections">
    <button id="studio-command-library" type="button" className="settings-reset" aria-expanded={expanded}
      onClick={()=>{setExpanded(value=>!value);setReview(null);}}>
      {expanded?'Hide command library':'Manage command palette collections'}</button>
    {expanded&&<>
      <p>Pin up to {MAX_PINNED_COMMANDS} built-in commands. The last {MAX_RECENT_COMMANDS} distinct built-in palette selections
        are remembered in this session only. No command is executed from this settings panel, and selections are not proof of successful execution.</p>
      <h4>Pinned order ({pinned.length}/{MAX_PINNED_COMMANDS})</h4>
      {!pinned.length&&<p>No commands pinned.</p>}
      <ol className="command-pin-list">{pinned.map((entry,index)=><li key={entry.id}>
        <span>{entry.label}</span>
        <button type="button" aria-label={'Move '+entry.label+' earlier'} disabled={index===0} onClick={()=>onMovePin(entry.id,-1)}>↑</button>
        <button type="button" aria-label={'Move '+entry.label+' later'} disabled={index===pinned.length-1} onClick={()=>onMovePin(entry.id,1)}>↓</button>
        <button type="button" aria-label={'Unpin '+entry.label} onClick={()=>onTogglePin(entry.id)}>Unpin</button>
      </li>)}</ol>
      <h4>Built-in command catalog</h4>
      <div className="activity-filters">
        <input type="search" maxLength={120} aria-label="Search built-in commands to pin" value={query}
          onChange={event=>setQuery(event.target.value)} placeholder="Command or shortcut"/>
        <select aria-label="Filter command catalog group" value={group} onChange={event=>{
          const value=event.target.value as CommandGroup|'all';
          if(value==='all'||COMMAND_GROUPS.includes(value))setGroup(value);
        }}>
          <option value="all">All groups</option>
          {COMMAND_GROUPS.filter(value=>value!=='Templates'&&value!=='Snippets').map(value=><option key={value} value={value}>{value}</option>)}
        </select>
      </div>
      <p role="status">{rows.length} matching built-in command(s)</p>
      <div className="command-catalog-list">{rows.map(row=><div className="activity-record" key={row.entry.id}>
        <div><strong>{row.entry.label}</strong><p>{row.group} · {row.entry.detail}</p></div>
        <button type="button" aria-label={(row.pinned?'Unpin ':'Pin ')+row.entry.label}
          aria-pressed={row.pinned} disabled={!row.pinned&&pinned.length>=MAX_PINNED_COMMANDS}
          onClick={()=>onTogglePin(row.entry.id)}>{row.pinned?'Unpin':'Pin'}</button>
      </div>)}</div>
      <details><summary>Recently selected ({recent.length})</summary>
        <ol>{recent.map(entry=><li key={entry.id}>{entry.label}</li>)}</ol>
        {!recent.length&&<p>No built-in commands selected from the palette yet.</p>}
      </details>
      <div className="activity-filters">
        <button type="button" disabled={!pinned.length} onClick={()=>setReview({kind:'pinned',library})}>Review clear pinned commands</button>
        <button type="button" disabled={!recent.length} onClick={()=>setReview({kind:'recent',library})}>Review clear recent commands</button>
      </div>
      {review&&<div className="transfer-review" role="group" aria-label="Review clearing command collection">
        <p>Clear {review.kind==='pinned'?'pinned commands':'recent selections'}? This does not change editor content, shortcuts or command execution.</p>
        <button type="button" disabled={review.library!==library} onClick={()=>{onClear(review);setReview(null);}}>Confirm clear</button>
        <button type="button" onClick={()=>setReview(null)}>Cancel</button>
        {review.library!==library&&<p role="status">The library changed. Review again.</p>}
      </div>}
    </>}
  </section>;
}
