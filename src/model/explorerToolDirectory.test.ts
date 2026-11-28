import { describe,expect,it } from 'vitest';
import { DEFAULT_TOOL_DIRECTORY,EXPLORER_TOOLS,MAX_TOOL_QUERY,MAX_TOOL_RECENT,filterExplorerTools,
  reduceToolDirectory,TOOL_CATEGORIES,type ToolDirectoryState } from './explorerToolDirectory';
const ids=(state:ToolDirectoryState)=>filterExplorerTools(state).map(tool=>tool.id);
describe('Explorer tool directory',()=>{
  it('exposes all registered tools by default with unique stable identities',()=>{
    expect(ids(DEFAULT_TOOL_DIRECTORY)).toHaveLength(21);
    expect(new Set(ids(DEFAULT_TOOL_DIRECTORY)).size).toBe(EXPLORER_TOOLS.length);
    expect(new Set(EXPLORER_TOOLS.map(tool=>tool.category))).toEqual(new Set(TOOL_CATEGORIES));
  });
  it('combines case-insensitive keyword terms and category filters',()=>{
    let state=reduceToolDirectory(DEFAULT_TOOL_DIRECTORY,{type:'query',value:'  DIFF transfer '});
    expect(ids(state)).toEqual(['compare-buffers']);
    state=reduceToolDirectory(state,{type:'filter',value:'editing'});
    expect(ids(state)).toEqual([]);
    state=reduceToolDirectory(state,{type:'filter',value:'changes'});
    expect(ids(state)).toEqual(['compare-buffers']);
  });
  it('bounds search text and ignores invalid category or identity values',()=>{
    const state=reduceToolDirectory(DEFAULT_TOOL_DIRECTORY,{type:'query',value:'x'.repeat(MAX_TOOL_QUERY+1)});
    expect(state.query).toHaveLength(MAX_TOOL_QUERY);
    expect(reduceToolDirectory(state,{type:'filter',value:'unknown'})).toBe(state);
    expect(reduceToolDirectory(state,{type:'toggle-pin',id:'unknown'})).toBe(state);
    expect(reduceToolDirectory(state,{type:'reveal',id:'unknown'})).toBe(state);
  });
  it('pins and unpins independently of filters without mutating previous state',()=>{
    const a=reduceToolDirectory(DEFAULT_TOOL_DIRECTORY,{type:'toggle-pin',id:'imports'});
    const b=reduceToolDirectory(a,{type:'toggle-pin',id:'checkpoints'});
    const c=reduceToolDirectory(b,{type:'filter',value:'pinned'});
    expect(ids(c)).toEqual(['imports','checkpoints']);
    expect(ids(reduceToolDirectory(c,{type:'toggle-pin',id:'imports'}))).toEqual(['checkpoints']);
    expect(a.pinned).toEqual(['imports']);
    expect(DEFAULT_TOOL_DIRECTORY.pinned).toEqual([]);
  });
  it('reveals a hidden tool by clearing filters but preserves pins',()=>{
    let state=reduceToolDirectory(DEFAULT_TOOL_DIRECTORY,{type:'toggle-pin',id:'imports'});
    state=reduceToolDirectory(state,{type:'filter',value:'editing'});
    state=reduceToolDirectory(state,{type:'query',value:'line'});
    const next=reduceToolDirectory(state,{type:'reveal',id:'imports'});
    expect(next.filter).toBe('all');
    expect(next.query).toBe('');
    expect(next.pinned).toEqual(['imports']);
    expect(next.recent).toEqual(['imports']);
  });
  it('preserves matching filters on reveal and keeps unique bounded recency',()=>{
    let state=reduceToolDirectory(DEFAULT_TOOL_DIRECTORY,{type:'filter',value:'navigation'});
    state=reduceToolDirectory(state,{type:'reveal',id:'trail'});
    expect(state.filter).toBe('navigation');
    for(const tool of EXPLORER_TOOLS)state=reduceToolDirectory(state,{type:'reveal',id:tool.id});
    expect(state.recent).toHaveLength(MAX_TOOL_RECENT);
    const last=state.recent.at(-1)!;
    state=reduceToolDirectory(state,{type:'reveal',id:last});
    expect(state.recent[0]).toBe(last);
    expect(new Set(state.recent).size).toBe(MAX_TOOL_RECENT);
  });
  it('clears only filters or the entire session view explicitly',()=>{
    let state=reduceToolDirectory(DEFAULT_TOOL_DIRECTORY,{type:'toggle-pin',id:'line-tools'});
    state=reduceToolDirectory(state,{type:'reveal',id:'line-tools'});
    state=reduceToolDirectory(state,{type:'query',value:'sort'});
    const clear=reduceToolDirectory(state,{type:'clear-filters'});
    expect(clear.pinned).toEqual(['line-tools']);
    expect(clear.recent).toEqual(['line-tools']);
    expect(clear.query).toBe('');
    expect(reduceToolDirectory(clear,{type:'clear-session'})).toBe(DEFAULT_TOOL_DIRECTORY);
  });
});
