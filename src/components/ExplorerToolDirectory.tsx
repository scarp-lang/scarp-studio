import { createContext,useContext,useEffect,useMemo,useReducer,useRef,useState,type ReactNode } from 'react';
import { DEFAULT_TOOL_DIRECTORY,EXPLORER_TOOLS,filterExplorerTools,reduceToolDirectory,TOOL_CATEGORIES,
  TOOL_CATEGORY_LABELS,MAX_TOOL_QUERY,type ExplorerToolId } from '../model/explorerToolDirectory';

interface ToolContext {visible:ReadonlySet<ExplorerToolId>}
const DirectoryContext=createContext<ToolContext|null>(null);
export function ExplorerToolSlot({id,children}:{id:ExplorerToolId;children:ReactNode}){
  const context=useContext(DirectoryContext);
  const visible=context?.visible.has(id)??true;
  return <div id={'explorer-tool-'+id} className="explorer-tool-slot" hidden={!visible} tabIndex={-1}>{children}</div>;
}
export function ExplorerToolDirectory({children}:{children:ReactNode}){
  const [state,dispatch]=useReducer(reduceToolDirectory,DEFAULT_TOOL_DIRECTORY);
  const [expanded,setExpanded]=useState(false);
  const [pending,setPending]=useState<ExplorerToolId|null>(null);
  const root=useRef<HTMLDivElement|null>(null);
  const search=useRef<HTMLInputElement|null>(null);
  const matches=useMemo(()=>filterExplorerTools(state),[state]);
  const context=useMemo(()=>({visible:new Set(matches.map(tool=>tool.id))}),[matches]);
  function reveal(id:ExplorerToolId){dispatch({type:'reveal',id});setPending(id);}
  useEffect(()=>{
    if(!pending)return;
    const slot=root.current?.querySelector<HTMLElement>('#explorer-tool-'+pending);
    if(slot&&!slot.hidden){
      const controls=Array.from(slot.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled])'));
      const control=controls.find(item=>item.getClientRects().length>0);
      (control??slot).focus({preventScroll:true});
      slot.scrollIntoView({block:'nearest'});
    }
    setPending(null);
  },[pending,context]);
  const pinned=EXPLORER_TOOLS.filter(tool=>state.pinned.includes(tool.id));
  const recent=state.recent.flatMap(id=>EXPLORER_TOOLS.filter(tool=>tool.id===id));
  return <DirectoryContext.Provider value={context}>
    <div className="explorer-tool-directory" ref={root}>
      <section className="sidebar-section tool-directory-controls" aria-label="Explorer tool directory">
        <div className="sidebar-heading">DEVELOPER TOOLS</div>
        <label>Find a tool<input type="search" ref={search} aria-label="Search Explorer tools" maxLength={MAX_TOOL_QUERY}
          value={state.query} placeholder="Find tools by name or purpose…" onChange={event=>dispatch({type:'query',value:event.target.value})}
          onKeyDown={event=>{if(event.key==='Enter'&&matches.length===1){event.preventDefault();reveal(matches[0].id);}
            if(event.key==='Escape'){dispatch({type:'clear-filters'});}}}/></label>
        <select aria-label="Explorer tool category" value={state.filter} onChange={event=>dispatch({type:'filter',value:event.target.value})}>
          <option value="all">All developer tools</option><option value="pinned">Pinned tools ({pinned.length})</option>
          {TOOL_CATEGORIES.map(category=><option key={category} value={category}>{TOOL_CATEGORY_LABELS[category]}</option>)}
        </select>
        <div className="tool-directory-actions">
          <button type="button" onClick={()=>{dispatch({type:'clear-filters'});search.current?.focus();}}>Show all tools</button>
          <button type="button" aria-expanded={expanded} aria-controls="explorer-tool-directory-index" onClick={()=>setExpanded(v=>!v)}>
            {expanded?'Hide tool index':'Browse tool index'}
          </button>
        </div>
        <p role="status">{matches.length} of {EXPLORER_TOOLS.length} tools shown. Open editor tabs and files remain available above.</p>
        {pinned.length>0&&<div className="tool-directory-shortcuts" aria-label="Pinned Explorer tools">
          <strong>Pinned</strong>{pinned.map(tool=><button key={tool.id} type="button" onClick={()=>reveal(tool.id)}>{tool.label}</button>)}
        </div>}
        {recent.length>0&&<div className="tool-directory-shortcuts" aria-label="Recently revealed Explorer tools">
          <strong>Recent</strong>{recent.map(tool=><button key={tool.id} type="button" onClick={()=>reveal(tool.id)}>{tool.label}</button>)}
        </div>}
        <div id="explorer-tool-directory-index" hidden={!expanded}>
          {expanded&&<>
            <p>Filter or jump to a mounted tool. Pins and recent selections last for this session.
              Hidden tools keep their current state; filtering does not execute actions or discard reviewed edits.</p>
            {matches.map(tool=><div className="tool-directory-entry" key={tool.id}>
              <button type="button" onClick={()=>reveal(tool.id)} className="tool-directory-reveal">
                <strong>{tool.label}</strong><span>{tool.description}</span>
              </button>
              <button type="button" aria-pressed={state.pinned.includes(tool.id)}
                aria-label={(state.pinned.includes(tool.id)?'Unpin ':'Pin ')+tool.label}
                onClick={()=>dispatch({type:'toggle-pin',id:tool.id})}>{state.pinned.includes(tool.id)?'Pinned':'Pin'}</button>
            </div>)}
            <button type="button" disabled={!pinned.length&&!recent.length&&state.filter==='all'&&!state.query}
              onClick={()=>dispatch({type:'clear-session'})}>Reset tool directory view</button>
          </>}
        </div>
        {!matches.length&&<p>No tools match. Clear the query or choose another category.</p>}
      </section>
      {children}
    </div>
  </DirectoryContext.Provider>;
}
