import { describe,expect,it } from 'vitest';
import { EMPTY_COMMAND_LIBRARY,COMMAND_GROUPS,MAX_PINNED_COMMANDS,MAX_RECENT_COMMANDS,
  commandGroup,isCommandCollection,isLibraryCommand,recordCommandSelection,togglePinnedCommand,movePinnedCommand,
  clearPinnedCommands,clearRecentCommands,commandCollectionEntries,searchCommandCollection,libraryCommandRows,confirmLibraryClear,
  type CommandPaletteLibrary } from './commandPaletteLibrary';
const entries=[
  {id:'new',label:'New file',detail:'Ctrl+N'},{id:'save',label:'Save file',detail:'Ctrl+S'},
  {id:'verify-scarp',label:'Verify current source',detail:'Ctrl+F5'},
  {id:'run-scarp',label:'Run current source',detail:'F5'},{id:'go-to-line',label:'Go to line',detail:'Ctrl+G'},
  {id:'template:hello',label:'Hello template'},{id:'user-snippet:private',label:'Private snippet'},
  {id:'other',label:'Unexpected item'},
];
function pin(library:CommandPaletteLibrary,id:string){
  const result=togglePinnedCommand(library,id);
  if(!result.ok)throw Error(result.error);
  return result.value;
}
describe('command collection library',()=>{
  it('classifies only known commands, templates and snippets',()=>{
    expect(entries.map(entry=>commandGroup(entry.id))).toEqual(['Files','Files','Compiler','Compiler','Navigation','Templates','Snippets',null]);
    for(const group of COMMAND_GROUPS)expect(isCommandCollection(group)).toBe(true);
    expect(isCommandCollection('arbitrary')).toBe(false);
    expect(isLibraryCommand('template:hello')).toBe(false);
    expect(isLibraryCommand('user-snippet:private')).toBe(false);
  });
  it('keeps pinned ordering and refuses unsupported IDs',()=>{
    let state=pin(pin(EMPTY_COMMAND_LIBRARY,'save'),'new');
    expect(state.pinned).toEqual(['save','new']);
    state=movePinnedCommand(state,'new',-1);
    expect(state.pinned).toEqual(['new','save']);
    expect(movePinnedCommand(state,'new',-1)).toBe(state);
    expect(pin(state,'new').pinned).toEqual(['save']);
    expect(togglePinnedCommand(state,'user-snippet:private').ok).toBe(false);
    expect(togglePinnedCommand(state,'file:/private/path.srp').ok).toBe(false);
  });
  it('enforces the pin budget and keeps history distinct',()=>{
    const ids=['new','open','folder','refresh-folder','save','save-all','save-as','reload','compare-disk','close','reopen-closed','find-open-files','find-project'];
    let state=EMPTY_COMMAND_LIBRARY;
    for(const id of ids.slice(0,MAX_PINNED_COMMANDS))state=pin(state,id);
    expect(togglePinnedCommand(state,ids[MAX_PINNED_COMMANDS]).ok).toBe(false);
    expect(state.recent).toEqual([]);
    expect(Object.isFrozen(state.pinned)).toBe(true);
  });
  it('records most recent distinct selection without retaining private labels',()=>{
    let state=recordCommandSelection(EMPTY_COMMAND_LIBRARY,'save');
    state=recordCommandSelection(state,'new');
    state=recordCommandSelection(state,'save');
    expect(state.recent).toEqual(['save','new']);
    expect(recordCommandSelection(state,'save')).toBe(state);
    for(const id of ['template:hello','user-snippet:private','file:/private','unknown'])
      expect(recordCommandSelection(state,id)).toBe(state);
    const ids=['new','open','folder','refresh-folder','save','save-all','save-as','reload','compare-disk','close','reopen-closed','find-open-files','find-project'];
    for(const id of ids)state=recordCommandSelection(state,id);
    expect(state.recent).toHaveLength(MAX_RECENT_COMMANDS);
    expect(state.recent[0]).toBe('find-project');
    expect(state.recent).not.toContain('new');
  });
  it('filters existing entry objects without synthesizing executable commands',()=>{
    const state=pin(pin(EMPTY_COMMAND_LIBRARY,'save'),'new');
    expect(commandCollectionEntries(entries,state,'pinned')).toEqual([entries[1],entries[0]]);
    expect(commandCollectionEntries(entries,state,'Compiler')).toEqual([entries[2],entries[3]]);
    expect(commandCollectionEntries(entries,state,'Snippets')).toEqual([entries[6]]);
    expect(commandCollectionEntries(entries,{...state,pinned:['save','unavailable','user-snippet:private']},'pinned')).toEqual([entries[1]]);
    expect(searchCommandCollection(entries,state,'pinned','ctrl+s')).toEqual([entries[1]]);
    expect(searchCommandCollection(entries,state,'Compiler','current',1)).toEqual([entries[2]]);
  });
  it('catalog metadata does not promote private entries or expose action arguments',()=>{
    let state=pin(EMPTY_COMMAND_LIBRARY,'save');
    state=recordCommandSelection(state,'save');
    expect(libraryCommandRows(entries,state,'save','all')).toEqual([{entry:entries[1],group:'Files',pinned:true,recentIndex:0}]);
    expect(libraryCommandRows(entries,state,'private','all')).toEqual([]);
  });
  it('requires exact current confirmation for clearing either collection',()=>{
    let state=pin(EMPTY_COMMAND_LIBRARY,'save');
    state=recordCommandSelection(state,'new');
    expect(clearPinnedCommands(state).recent).toEqual(['new']);
    expect(clearRecentCommands(state).pinned).toEqual(['save']);
    const result=confirmLibraryClear({kind:'recent',library:state},state);
    expect(result.ok&&result.value.recent).toEqual([]);
    expect(confirmLibraryClear({kind:'recent',library:state},recordCommandSelection(state,'save')).ok).toBe(false);
  });
});
