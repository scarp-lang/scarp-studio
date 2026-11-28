import {describe,expect,it,vi} from 'vitest';
import {createUntitled} from './documents';
import {editorReducer,initialEditorState} from './editorState';
import {DEFAULT_PROJECT_SEARCH_SCOPE} from './projectSearchScope';
import {MAX_SEARCH_CANDIDATES} from './openFileSearch';
import {DEFAULT_LITERAL_REPLACE,validateLiteralReplaceSettings,scanLiteralReplacementFile,applyLiteralReplacementSites,
  MAX_LITERAL_REPLACEMENT_SITES,type LiteralReplaceSettings,type LiteralReplaceSite} from './literalSourceReplacement';
import {prepareProjectLiteralReplacement,confirmProjectLiteralReplacement,scanProjectLiteralReplacement,
  planProjectLiteralReplacement,prepareLiteralReplacementApply,filterLiteralSites,summarizeLiteralInventory,
  literalInventoryReport,pageLiteralSites,DEFAULT_LITERAL_SELECTION_FILTER,type ProjectLiteralInventory} from './projectLiteralReplacement';
import {createReviewedStageUndo} from './reviewedSourceStage';

const source='src/main.srp';
const settings:LiteralReplaceSettings={...DEFAULT_LITERAL_REPLACE,query:'old',replacement:'new'};
function sites(text:string,config=settings):readonly LiteralReplaceSite[]{
  const result=scanLiteralReplacementFile(source,text,config);
  if(!result.ok)throw Error(result.error);
  return result.value.sites;
}
function apply(text:string,config=settings,selected=sites(text,config)){
  return applyLiteralReplacementSites(source,text,config,selected);
}
describe('literal replacement configuration',()=>{
  it('rejects empty, multiline, malformed UTF-16 and oversized values',()=>{
    for(const query of ['', 'a\nb','a\rb','\u0000','\ud800','a'.repeat(121)])
      expect(validateLiteralReplaceSettings({...settings,query}).ok).toBe(false);
    for(const replacement of ['a\nb','\udfff','x'.repeat(513)])
      expect(validateLiteralReplaceSettings({...settings,replacement}).ok).toBe(false);
    expect(validateLiteralReplaceSettings({...settings,replacement:''}).ok).toBe(true);
    expect(validateLiteralReplaceSettings({...settings,replacement:'old'}).ok).toBe(false);
    expect(validateLiteralReplaceSettings({...settings,replacement:'old',caseSensitive:false}).ok).toBe(true);
  });
  it('treats matching and replacement syntax literally',()=>{
    const text='bind x = 1 + 2;';
    const config={...settings,query:'+',replacement:'$&'};
    expect(apply(text,config)).toEqual({ok:true,value:'bind x = 1 $& 2;'});
    expect(sites('abc def',{...settings,query:'.*'})).toHaveLength(0);
  });
});
describe('region-aware matching',()=>{
  const text='bind oldName = "old"; // old\r\nbind raw = r"old";\rbind multi = """old\nold""";\nold();';
  it('matches code outside protected spans and counts exclusions',()=>{
    const result=scanLiteralReplacementFile(source,text,settings);
    if(!result.ok)throw Error(result.error);
    expect(result.value.sites.map(site=>[site.line,site.region])).toEqual([[1,'code'],[5,'code']]);
    expect(result.value.excluded).toBe(5);
    expect(result.value.candidates).toBe(7);
    expect(apply(text,settings)).toEqual({ok:true,value:text.replace('oldName','newName').replace('old();','new();')});
  });
  it('isolates comments and all three literal types',()=>{
    const comments={...settings,domain:'comment' as const};
    expect(sites(text,comments)).toHaveLength(1);
    expect(apply(text,comments)).toEqual({ok:true,value:text.replace('// old','// new')});
    const strings={...settings,domain:'string' as const};
    expect(sites(text,strings).map(site=>site.line)).toEqual([1,2,3,4]);
    expect(apply(text,strings)).toEqual({ok:true,value:text.replace('"old"','"new"').replace('r"old"','r"new"').replace('"""old\nold"""','"""new\nnew"""')});
  });
  it('classifies delimiter crossings separately',()=>{
    const text='bind x = "old"; // old';
    for(const query of ['"old"','// old','= "old']){
      const result=sites(text,{...settings,query,domain:'all'});
      expect(result).toHaveLength(1);
      expect(result[0].region).toBe('boundary');
      expect(sites(text,{...settings,query,domain:'code'})).toHaveLength(0);
      expect(sites(text,{...settings,query,domain:'string'})).toHaveLength(0);
      expect(sites(text,{...settings,query,domain:'comment'})).toHaveLength(0);
    }
  });
  it('uses Unicode-aware whole-word boundaries and preserves UTF-16 coordinates',()=>{
    const text='old old_name old\u0301 😀old old𐐀 old';
    const result=sites(text,{...settings,wholeWord:true});
    expect(result.map(site=>site.start)).toEqual([0,text.indexOf('old',text.indexOf('😀')),text.lastIndexOf('old')]);
    expect(result.map(site=>site.column)).toEqual(result.map(site=>site.start+1));
    const preview=sites('😀'.repeat(20)+'old'+'😀'.repeat(20),settings)[0];
    expect(preview.original).toBe('old');
    expect(preview.prefix).toBe('😀'.repeat(18));
    expect(preview.suffix).toBe('😀'.repeat(18));
    expect(preview.clippedBefore).toBe(true);
    expect(preview.clippedAfter).toBe(true);
  });
  it('counts unchanged case-insensitive matches separately from actionable sites',()=>{
    const config={...settings,query:'old',replacement:'old',caseSensitive:false};
    const result=scanLiteralReplacementFile(source,'OLD Old old',config);
    if(!result.ok)throw Error(result.error);
    expect(result.value).toMatchObject({candidates:3,unchanged:1,excluded:0});
    expect(result.value.sites.map(site=>site.original)).toEqual(['OLD','Old']);
    expect(apply('OLD Old old',config)).toEqual({ok:true,value:'old old old'});
  });
  it('never publishes an inventory for malformed lexical sources or exceeded limits',()=>{
    expect(scanLiteralReplacementFile(source,'bind x = "old',settings).ok).toBe(false);
    expect(scanLiteralReplacementFile(source,'old;'.repeat(MAX_LITERAL_REPLACEMENT_SITES+1),settings).ok).toBe(false);
    expect(scanLiteralReplacementFile(source,'// old '.repeat(6),settings,MAX_LITERAL_REPLACEMENT_SITES,5).ok).toBe(false);
    expect(scanLiteralReplacementFile(source,'old',settings,0).ok).toBe(false);
    expect(scanLiteralReplacementFile(source,'different',settings,0,0).ok).toBe(true);
    expect(scanLiteralReplacementFile(source,'old',settings,1,MAX_SEARCH_CANDIDATES+1).ok).toBe(false);
  });
});
describe('exact protected-layout replacement',()=>{
  it('allows selected changes of different lengths before and within protected spans',()=>{
    const original='old(); // old\r\nbind x = "old";\r\nold();';
    const config={...settings,replacement:'expanded'};
    const matches=sites(original,config);
    expect(apply(original,config,[matches[1],matches[0]])).toEqual({ok:true,value:'expanded(); // old\r\nbind x = "old";\r\nexpanded();'});
    const comment={...config,domain:'comment' as const};
    expect(apply(original,comment)).toEqual({ok:true,value:original.replace('// old','// expanded')});
  });
  it('rejects restricted edits that introduce or absorb protected tokens',()=>{
    expect(apply('old code;', {...settings,replacement:'//'}).ok).toBe(false);
    expect(apply('old; "safe";', {...settings,replacement:'"'}).ok).toBe(false);
    const string={...settings,domain:'string' as const,replacement:'" + "'};
    expect(apply('bind x = "old";',string).ok).toBe(false);
    expect(apply('bind x = "old";',{...string,replacement:'\\'}).ok).toBe(false);
  });
  it('requires exact site evidence and rejects duplicate or modified selections',()=>{
    const text='old old';
    const matches=sites(text);
    expect(apply(text,settings,[matches[0],matches[0]]).ok).toBe(false);
    expect(apply(text,settings,[{...matches[0],end:2}]).ok).toBe(false);
    expect(apply(text,settings,[{...matches[0],region:'comment'}]).ok).toBe(false);
    expect(apply(text,settings,[{...matches[0],prefix:'fake'}]).ok).toBe(false);
    expect(apply(text,settings,[]).ok).toBe(false);
    expect(apply(text,settings,[matches[1]])).toEqual({ok:true,value:'old new'});
  });
  it('supports explicit all-text boundary changes but still rejects malformed output',()=>{
    const text='bind x = "old";';
    const config={...settings,query:'"old"',replacement:'3',domain:'all' as const};
    expect(apply(text,config)).toEqual({ok:true,value:'bind x = 3;'});
    expect(apply(text,{...config,replacement:'"'}).ok).toBe(false);
  });
});

const listed=['src/a.srp','src/b.srp','src/c.srp'].map(name=>({name,path:'C:/workspace/'+name}));
const scope=DEFAULT_PROJECT_SEARCH_SCOPE;
const control={isCurrent:()=>true,isCancelled:()=>false};
const doc={...createUntitled(1),name:'a.srp',path:listed[0].path,content:'old(); // old',savedContent:'old();'};
const editor={...initialEditorState,documents:[doc],activeId:doc.id};
const content=['old();','old(); "old";','// unchanged'];
function prepare(config=settings){
  const result=prepareProjectLiteralReplacement(listed,scope,false,config);
  if(!result.ok)throw Error(result.error);
  return result.value;
}
async function inventory(config=settings):Promise<ProjectLiteralInventory>{
  const result=await scanProjectLiteralReplacement(prepare(config),editor,
    async path=>content[listed.findIndex(file=>file.path===path)],control);
  if(result.kind!=='ready')throw Error('No inventory');
  return result.value;
}
describe('project literal transaction',()=>{
  it('revalidates settings, exact membership and complete source coverage',()=>{
    const review=prepare();
    expect(confirmProjectLiteralReplacement(review,listed,scope,false,settings).ok).toBe(true);
    expect(confirmProjectLiteralReplacement(review,listed,scope,false,{...settings,wholeWord:true}).ok).toBe(false);
    expect(confirmProjectLiteralReplacement(review,listed.slice(1),scope,false,settings).ok).toBe(false);
    expect(prepareProjectLiteralReplacement(listed,scope,true,settings).ok).toBe(false);
  });
  it('reads closed files only, stages selected matches and restores original dirty state',async()=>{
    const inv=await inventory();
    expect(inv.sites).toHaveLength(2);
    expect(summarizeLiteralInventory(inv,[])).toMatchObject({sources:3,sites:2,candidates:4,excluded:2,selected:0});
    const plan=planProjectLiteralReplacement(inv,inv.sites.map(site=>site.id),editor,false);
    if(!plan.ok)throw Error(plan.error);
    const read=vi.fn(async path=>content[listed.findIndex(file=>file.path===path)]);
    const applied=await prepareLiteralReplacementApply(plan.value,listed,false,editor,read,control);
    if(applied.kind!=='ready')throw Error('No apply plan');
    expect(read).toHaveBeenCalledTimes(2);
    const after=editorReducer(editor,applied.value.action);
    expect(after.documents.map(item=>item.content)).toEqual(['new(); // old','new(); "old";']);
    expect(after.documents.map(item=>item.savedContent)).toEqual(['old();','old(); "old";']);
    const undo=createReviewedStageUndo(applied.value.staged.changes,after);
    if(!undo)throw Error('No undo');
    const restored=editorReducer(after,{type:'replace-open-files',changes:undo.changes,allSnapshots:undo.after});
    expect(restored.documents.map(item=>item.content)).toEqual(['old(); // old','old(); "old";']);
  });
  it('rejects forged inventories, selections, editor changes and unreviewed all-text edits',async()=>{
    const inv=await inventory();
    const selected=[inv.sites[0].id];
    expect(planProjectLiteralReplacement(inv,['forged'],editor,false).ok).toBe(false);
    expect(planProjectLiteralReplacement({...inv,candidates:99},selected,editor,false).ok).toBe(false);
    expect(planProjectLiteralReplacement(inv,selected,{...editor,sessionRevision:editor.sessionRevision+1},false).ok).toBe(false);
    const all=await inventory({...settings,domain:'all'});
    expect(planProjectLiteralReplacement(all,[all.sites[0].id],editor,false).ok).toBe(false);
    expect(planProjectLiteralReplacement(all,[all.sites[0].id],editor,true).ok).toBe(true);
  });
  it('rejects changed unselected disk text and cancels without producing partial actions',async()=>{
    const inv=await inventory();
    const plan=planProjectLiteralReplacement(inv,[inv.sites[0].id],editor,false);
    if(!plan.ok)throw Error(plan.error);
    const changed=await prepareLiteralReplacementApply(plan.value,listed,false,editor,
      async path=>path===listed[2].path?'changed':content[1],control);
    expect(changed.kind).toBe('failed');
    let cancelled=false;
    const stopped=await prepareLiteralReplacementApply(plan.value,listed,false,editor,
      async()=>{cancelled=true;return content[1];},{...control,isCancelled:()=>cancelled});
    expect(stopped).toEqual({kind:'cancelled'});
  });
  it('does not publish an inventory after any selected source read fails',async()=>{
    const result=await scanProjectLiteralReplacement(prepare(),editor,async()=>{throw Error('private failure');},control);
    expect(result.kind).toBe('failed');
    expect(JSON.stringify(result)).not.toContain('private failure');
  });
  it('filters stable selections and keeps report disclosures independent',async()=>{
    const inv=await inventory();
    const chosen=[inv.sites[0].id];
    expect(filterLiteralSites(inv,{...DEFAULT_LITERAL_SELECTION_FILTER,selectedOnly:true},chosen)).toEqual([inv.sites[0]]);
    expect(filterLiteralSites(inv,{...DEFAULT_LITERAL_SELECTION_FILTER,source:listed[1].name},chosen)).toHaveLength(1);
    expect(pageLiteralSites(inv.sites,9).page).toBe(1);
    const raw=literalInventoryReport(inv,chosen);
    expect(raw).not.toContain('src/a.srp');
    expect(raw).not.toContain('old');
    expect(raw).not.toContain('C:/');
    expect(literalInventoryReport(inv,chosen,true,false)).toContain('src/a.srp');
    expect(literalInventoryReport(inv,chosen,false,true)).toContain('Query: "old"');
    expect(literalInventoryReport(inv,chosen,false,true)).not.toContain('src/a.srp');
  });
});
