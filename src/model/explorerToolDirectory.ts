/** Stable UI metadata, not executable commands or permission grants. */
export const TOOL_CATEGORIES=['workspace','navigation','analysis','editing','changes'] as const;
export type ToolCategory=typeof TOOL_CATEGORIES[number];
export const TOOL_CATEGORY_LABELS:Readonly<Record<ToolCategory,string>>=Object.freeze({
  workspace:'Workspace and tabs',navigation:'Navigation',analysis:'Source analysis',
  editing:'Reviewed editing',changes:'Changes and snapshots',
});
export const EXPLORER_TOOLS=[
  {id:'sessions',category:'workspace',label:'Remembered workspace',description:'Remember and restore listed open tabs',keywords:'session reopen remember workspace'},
  {id:'manage-tabs',category:'workspace',label:'Open editor manager',description:'Review and close selected clean tabs',keywords:'close select tabs files'},
  {id:'recently-closed',category:'workspace',label:'Recently closed',description:'Reopen previously closed source tabs',keywords:'reopen restore tabs history'},
  {id:'outline',category:'navigation',label:'Declaration outline',description:'Find functions, records and variants in the active file',keywords:'symbol function declaration goto'},
  {id:'bookmarks',category:'navigation',label:'Source bookmarks',description:'Keep marked source positions',keywords:'mark location line'},
  {id:'symbols',category:'navigation',label:'Workspace symbols',description:'Index declaration and call sites in open tabs',keywords:'function call binding variable symbol search'},
  {id:'listed-symbols',category:'navigation',label:'Listed project symbols',description:'Index declarations and call candidates across reviewed listed sources',keywords:'project lexical declaration function call symbol index'},
  {id:'trail',category:'navigation',label:'Navigation trail',description:'Replay reviewed editor jumps and marked positions',keywords:'back forward cursor history location'},
  {id:'references',category:'navigation',label:'Code references',description:'Find literal code-token occurrences',keywords:'find usage identifier references'},
  {id:'listed-references',category:'navigation',label:'Listed code references',description:'Find lexical code identifier sites across reviewed listed sources',keywords:'project references identifier token usages declaration find'},
  {id:'insights',category:'analysis',label:'Source insights',description:'Inspect active-buffer lexical structure',keywords:'metrics source outline lexical'},
  {id:'quality',category:'analysis',label:'Source quality',description:'Inspect whitespace, delimiters and lexical hints',keywords:'lint cleanup quality warnings'},
  {id:'imports',category:'analysis',label:'Imports and dependencies',description:'Inspect listed imports, paths and observed cycles',keywords:'module graph cycle alias dependents'},
  {id:'workspace-insights',category:'analysis',label:'Workspace insights',description:'Review open-buffer and Explorer inventory',keywords:'metrics file project workspace'},
  {id:'tasks',category:'analysis',label:'Comment task board',description:'Review TODO and FIXME markers in open source',keywords:'todo fixme bug review comments'},
  {id:'listed-inspection',category:'analysis',label:'Listed source inspection',description:'Review project comment tasks and lexical quality across listed sources',keywords:'audit project files todo quality inspection'},
  {id:'project-verification',category:'analysis',label:'Literal source verification',description:'Check reviewed required or forbidden literal patterns across listed sources',keywords:'verify rule literal pattern audit project files'},
  {id:'identifier-edit',category:'editing',label:'Identifier edit',description:'Select literal code tokens for reviewed replacement',keywords:'rename replace identifier refactor'},
  {id:'line-tools',category:'editing',label:'Line tools',description:'Sort, reverse, indent or transform selected lines',keywords:'sort prefix suffix trim duplicate indentation'},
  {id:'selection-edit',category:'editing',label:'Selection editing',description:'Review literal transformations across editor selections',keywords:'multi cursor surround unwrap duplicate replace case delete'},
  {id:'working-changes',category:'changes',label:'Working changes',description:'Compare working text to its last saved snapshot',keywords:'diff unsaved saved changes'},
  {id:'compare-buffers',category:'changes',label:'Compare buffers',description:'Compare two open snapshots and transfer reviewed blocks',keywords:'diff compare transfer patch'},
  {id:'checkpoints',category:'changes',label:'Source checkpoints',description:'Capture and restore named in-memory snapshots',keywords:'backup snapshot restore undo'},
] as const satisfies readonly {id:string;category:ToolCategory;label:string;description:string;keywords:string}[];
export type ExplorerToolId=typeof EXPLORER_TOOLS[number]['id'];
export type ExplorerTool=typeof EXPLORER_TOOLS[number];
export type ToolFilter='all'|'pinned'|ToolCategory;
export const MAX_TOOL_QUERY=120;
export const MAX_TOOL_RECENT=5;
export interface ToolDirectoryState {
  readonly filter:ToolFilter;
  readonly query:string;
  readonly pinned:readonly ExplorerToolId[];
  readonly recent:readonly ExplorerToolId[];
}
export const DEFAULT_TOOL_DIRECTORY:ToolDirectoryState=Object.freeze({
  filter:'all',query:'',pinned:Object.freeze([]),recent:Object.freeze([]),
});
export function isExplorerToolId(value:string):value is ExplorerToolId {
  return EXPLORER_TOOLS.some(tool=>tool.id===value);
}
export function isToolFilter(value:string):value is ToolFilter {
  return value==='all'||value==='pinned'||TOOL_CATEGORIES.some(category=>category===value);
}
export function filterExplorerTools(state:ToolDirectoryState):ExplorerTool[]{
  const terms=state.query.slice(0,MAX_TOOL_QUERY).trim().toLowerCase().split(/\s+/).filter(Boolean);
  return EXPLORER_TOOLS.filter(tool=>{
    if(state.filter==='pinned'&&!state.pinned.includes(tool.id))return false;
    if(state.filter!=='all'&&state.filter!=='pinned'&&tool.category!==state.filter)return false;
    const haystack=[tool.label,tool.description,tool.keywords,TOOL_CATEGORY_LABELS[tool.category]].join(' ').toLowerCase();
    return terms.every(term=>haystack.includes(term));
  });
}
export type ToolDirectoryAction=
  | {type:'filter';value:string}
  | {type:'query';value:string}
  | {type:'toggle-pin';id:string}
  | {type:'reveal';id:string}
  | {type:'clear-filters'}
  | {type:'clear-session'};
export function reduceToolDirectory(state:ToolDirectoryState,action:ToolDirectoryAction):ToolDirectoryState{
  switch(action.type){
    case 'filter':
      return isToolFilter(action.value)&&action.value!==state.filter?{...state,filter:action.value}:state;
    case 'query':{
      const query=action.value.slice(0,MAX_TOOL_QUERY);
      return query===state.query?state:{...state,query};
    }
    case 'toggle-pin':{
      const id=action.id;
      if(!isExplorerToolId(id))return state;
      return {...state,pinned:state.pinned.includes(id)?state.pinned.filter(value=>value!==id):[...state.pinned,id]};
    }
    case 'reveal':{
      const id=action.id;
      if(!isExplorerToolId(id))return state;
      const visible=filterExplorerTools(state).some(tool=>tool.id===id);
      return {...state,filter:visible?state.filter:'all',query:visible?state.query:'',
        recent:[id,...state.recent.filter(value=>value!==id)].slice(0,MAX_TOOL_RECENT)};
    }
    case 'clear-filters':
      return state.filter==='all'&&!state.query?state:{...state,filter:'all',query:''};
    case 'clear-session':
      return DEFAULT_TOOL_DIRECTORY;
  }
}
