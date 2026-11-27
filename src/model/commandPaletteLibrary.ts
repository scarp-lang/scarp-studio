import { filterNavigationEntries,type NavigationEntry } from './navigation';
export const COMMAND_GROUPS=['Files','Search','Navigation','Compiler','Workspace','Templates','Snippets'] as const;
export type CommandGroup=typeof COMMAND_GROUPS[number];
export type CommandCollection='all'|'pinned'|'recent'|CommandGroup;
export const MAX_PINNED_COMMANDS=12;
export const MAX_RECENT_COMMANDS=12;
const groupIds:Readonly<Record<Exclude<CommandGroup,'Templates'|'Snippets'>,readonly string[]>>={
  Files:['new','open','folder','refresh-folder','save','save-all','save-as','reload','compare-disk','close','reopen-closed'],
  Search:['find-open-files','find-project','replace-open-files','undo-replace-open-files'],
  Navigation:['quick-open','go-to-line','go-to-symbol','next-tab','previous-tab'],
  Compiler:['select-compiler','scan-compiler','download-compiler','run-scarp','verify-scarp','stop-scarp'],
  Workspace:['theme','settings','explorer','toggle-output','expand-output','toggle-focus','show-problems','compiler-controls'],
};
const groups=new Map<string,CommandGroup>();
for(const [group,ids] of Object.entries(groupIds))for(const id of ids)groups.set(id,group as CommandGroup);
export function commandGroup(id:string):CommandGroup|null{
  if(id.startsWith('template:'))return 'Templates';
  if(id.startsWith('snippet:'))return 'Snippets';
  return groups.get(id)??null;
}
/** Only built-in IDs are retained. No source, filename, query, snippet,
 * command argument or user-defined label can enter recent/pinned state. */
export function isLibraryCommand(id:string):boolean{return groups.has(id);}
export interface CommandPaletteLibrary{
  readonly revision:number;
  readonly pinned:readonly string[];
  readonly recent:readonly string[];
}
export const EMPTY_COMMAND_LIBRARY:CommandPaletteLibrary=Object.freeze({revision:0,pinned:Object.freeze([]),recent:Object.freeze([])});
function updated(library:CommandPaletteLibrary,pinned:readonly string[],recent:readonly string[]):CommandPaletteLibrary{
  return Object.freeze({revision:library.revision+1,pinned:Object.freeze([...pinned]),recent:Object.freeze([...recent])});
}
export type LibraryResult={readonly ok:true;readonly value:CommandPaletteLibrary}|{readonly ok:false;readonly error:string};
export function recordCommandSelection(library:CommandPaletteLibrary,id:string):CommandPaletteLibrary{
  if(!isLibraryCommand(id)||library.recent[0]===id)return library;
  return updated(library,library.pinned,[id,...library.recent.filter(other=>other!==id)].slice(0,MAX_RECENT_COMMANDS));
}
export function togglePinnedCommand(library:CommandPaletteLibrary,id:string):LibraryResult{
  if(!isLibraryCommand(id))return {ok:false,error:'Only built-in commands can be pinned.'};
  if(library.pinned.includes(id))return {ok:true,value:updated(library,library.pinned.filter(other=>other!==id),library.recent)};
  if(library.pinned.length>=MAX_PINNED_COMMANDS)return {ok:false,error:'Pinned command limit reached. Unpin a command first.'};
  return {ok:true,value:updated(library,[...library.pinned,id],library.recent)};
}
export function movePinnedCommand(library:CommandPaletteLibrary,id:string,direction:-1|1):CommandPaletteLibrary{
  const index=library.pinned.indexOf(id),target=index+direction;
  if(index<0||target<0||target>=library.pinned.length)return library;
  const pinned=[...library.pinned];[pinned[index],pinned[target]]=[pinned[target],pinned[index]];
  return updated(library,pinned,library.recent);
}
export function clearRecentCommands(library:CommandPaletteLibrary):CommandPaletteLibrary{
  return library.recent.length?updated(library,library.pinned,[]):library;
}
export function clearPinnedCommands(library:CommandPaletteLibrary):CommandPaletteLibrary{
  return library.pinned.length?updated(library,[],library.recent):library;
}
export function collectionLabel(collection:CommandCollection):string{
  if(collection==='all')return 'All commands';
  if(collection==='pinned')return 'Pinned';
  if(collection==='recent')return 'Recently selected';
  return collection;
}
export function isCommandCollection(value:string):value is CommandCollection{
  return value==='all'||value==='pinned'||value==='recent'||COMMAND_GROUPS.includes(value as CommandGroup);
}
/** Preserve original entries and their provenance. Only order/filter them;
 * never synthesize executable IDs from preferences or typed query text. */
export function commandCollectionEntries<T extends NavigationEntry>(entries:readonly T[],library:CommandPaletteLibrary,collection:CommandCollection):T[]{
  const byId=new Map(entries.map(entry=>[entry.id,entry]));
  if(collection==='pinned'||collection==='recent'){
    return library[collection].flatMap(id=>{
      const entry=byId.get(id);return entry&&isLibraryCommand(id)?[entry]:[];
    });
  }
  if(collection!=='all')return entries.filter(entry=>commandGroup(entry.id)===collection);
  return [...entries];
}
export function searchCommandCollection<T extends NavigationEntry>(entries:readonly T[],library:CommandPaletteLibrary,collection:CommandCollection,query:string,limit=40):T[]{
  return filterNavigationEntries(commandCollectionEntries(entries,library,collection),query,limit);
}
export interface LibraryCommandRow{
  readonly entry:NavigationEntry;
  readonly group:CommandGroup;
  readonly pinned:boolean;
  readonly recentIndex:number|null;
}
export function libraryCommandRows(entries:readonly NavigationEntry[],library:CommandPaletteLibrary,query:string,group:CommandGroup|'all'):LibraryCommandRow[]{
  const catalog=entries.filter(entry=>isLibraryCommand(entry.id)&&(group==='all'||commandGroup(entry.id)===group));
  return filterNavigationEntries(catalog,query,catalog.length).map(entry=>{
    const recentIndex=library.recent.indexOf(entry.id);
    return {entry,group:commandGroup(entry.id)!,pinned:library.pinned.includes(entry.id),recentIndex:recentIndex<0?null:recentIndex};
  });
}
/** Library settings are session-local. Confirm a clear action against the
 * exact current library object, so stale review cannot clear newer choices. */
export interface LibraryClearReview{
  readonly kind:'pinned'|'recent';
  readonly library:CommandPaletteLibrary;
}
export function confirmLibraryClear(review:LibraryClearReview,current:CommandPaletteLibrary):LibraryResult{
  if(review.library!==current)return {ok:false,error:'The command library changed. Review the clear action again.'};
  return {ok:true,value:review.kind==='pinned'?clearPinnedCommands(current):clearRecentCommands(current)};
}
