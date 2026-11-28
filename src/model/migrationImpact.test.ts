import {describe,expect,it} from 'vitest';
import {scanMigrationFile,replaceMigrationSites,type MigrationRule} from './migrationRules';
import {migrationFileImpact,buildMigrationImpact,impactReport,pageImpact,MAX_IMPACT_WINDOW_UNITS} from './migrationImpact';
import {prepareProjectMigration,scanProjectMigration,planProjectMigration,type MigrationChange} from './projectIdentifierMigration';
import {initialEditorState} from './editorState';
import {DEFAULT_PROJECT_SEARCH_SCOPE} from './projectSearchScope';
import {splitSnapshotLines} from './sourceDiff';

const label='src/private-file.srp',path='/private-native/'+label;
const rules=[{from:'old_value',to:'longer_new_value'},{from:'helper_fn',to:'h'}];
function value<T>(result:{ok:true;value:T}|{ok:false;error:string}):T{
  if(!result.ok)throw Error(result.error);return result.value;
}
function change(before:string,mappings:readonly MigrationRule[]=rules,select?:readonly number[]):MigrationChange{
  const scan=value(scanMigrationFile(label,before,mappings));
  const sites=select?select.map(index=>scan.sites[index]):scan.sites;
  return {source:label,path,document:null,before,after:value(replaceMigrationSites(before,mappings,sites)),sites};
}
const text=(parts:readonly {text:string}[])=>parts.map(part=>part.text).join('');
describe('combined migration previews',()=>{
  it('combines all chosen edits on a line with accurate before and after columns',()=>{
    const source='bind old_value = helper_fn(old_value);\r\n// untouched\r\nhelper_fn();';
    const edited=change(source);
    const impact=value(migrationFileImpact(edited,rules));
    expect(impact.edits).toBe(4);
    expect(impact.changedLines).toBe(2);
    expect(impact.ruleCounts).toEqual([2,2]);
    expect(impact.windows).toHaveLength(2);
    expect(impact.windows[0]).toMatchObject({line:1,sites:3,beforeColumn:1,afterColumn:1,ending:'\r\n'});
    expect(text(impact.windows[0].before)).toBe('bind old_value = helper_fn(old_value);');
    expect(text(impact.windows[0].after)).toBe('bind longer_new_value = h(longer_new_value);');
    expect(impact.windows[0].before.filter(part=>part.changed).map(part=>part.text)).toEqual(['old_value','helper_fn','old_value']);
    expect(impact.windows[0].after.filter(part=>part.changed).map(part=>part.text)).toEqual(['longer_new_value','h','longer_new_value']);
    expect(impact.windows[1].ending).toBe('');
  });
  it('shows unselected original sites as unchanged context',()=>{
    const edited=change('old_value; helper_fn(); old_value;',rules,[1]);
    const impact=value(migrationFileImpact(edited,rules));
    expect(impact.ruleCounts).toEqual([0,1]);
    expect(text(impact.windows[0].after)).toBe('old_value; h(); old_value;');
    expect(impact.windows[0].after.filter(part=>part.changed)).toEqual([{text:'h',changed:true,rule:1}]);
  });
  it('keeps long-line windows bounded and maps later columns through prior substitutions',()=>{
    const source='old_value;'+ ' '.repeat(700)+'helper_fn();';
    const edited=change(source);
    const impact=value(migrationFileImpact(edited,rules));
    expect(impact.windows).toHaveLength(2);
    expect(impact.windows[0].suffixClipped).toBe(true);
    expect(impact.windows[1].prefixClipped).toBe(true);
    expect(impact.windows[1].afterColumn-impact.windows[1].beforeColumn).toBe(rules[0].to.length-rules[0].from.length);
    expect(impact.windows.every(window=>text(window.before).length<=MAX_IMPACT_WINDOW_UNITS&&text(window.after).length<=MAX_IMPACT_WINDOW_UNITS)).toBe(true);
  });
  it('clips context at neighboring selected sites when dense expanded output exceeds the preview budget',()=>{
    const mappings=[{from:'old_value',to:'n'.repeat(128)}];
    const edited=change('old_value; '.repeat(25),mappings);
    const impact=value(migrationFileImpact(edited,mappings));
    expect(impact.windows.length).toBeGreaterThan(1);
    expect(impact.windows.reduce((sum,window)=>sum+window.sites,0)).toBe(25);
    for(const window of impact.windows){
      expect(window.after.filter(part=>part.changed)).toHaveLength(window.sites);
      expect(window.after.filter(part=>!part.changed).every(part=>!part.text.includes('old_value'))).toBe(true);
      expect(text(window.after).length).toBeLessThanOrEqual(MAX_IMPACT_WINDOW_UNITS);
    }
  });
  it('preserves Unicode and mixed line-ending context without splitting surrogate pairs',()=>{
    const edited=change('😀 '.repeat(20)+'old_value;'+ ' 😀'.repeat(20)+'\rhelper_fn();\nold_value;\r\n');
    const impact=value(migrationFileImpact(edited,rules));
    expect(impact.windows.map(window=>window.ending)).toEqual(['\r','\n','\r\n']);
    for(const window of impact.windows){
      expect(text(window.before)).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/);
      expect(text(window.after)).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/);
    }
  });
  it('matches exact output slices at all shown pre/post columns across diverse gaps and lengths',()=>{
    for(const gap of [1,3,20,48,49,100,700]){
      const source=Array.from({length:20},(_,index)=>index%2?'helper_fn;':'old_value;').join(' '.repeat(gap));
      const edited=change(source);
      const impact=value(migrationFileImpact(edited,rules));
      const lineBefore=splitSnapshotLines(edited.before)[0].text;
      const lineAfter=splitSnapshotLines(edited.after)[0].text;
      for(const window of impact.windows){
        const original=text(window.before),next=text(window.after);
        expect(lineBefore.slice(window.beforeColumn-1,window.beforeColumn-1+original.length)).toBe(original);
        expect(lineAfter.slice(window.afterColumn-1,window.afterColumn-1+next.length)).toBe(next);
      }
    }
  });
  it('rejects stale output and invalid site coordinates',()=>{
    const edited=change('old_value; helper_fn();');
    expect(migrationFileImpact({...edited,after:edited.after+' '},rules).ok).toBe(false);
    expect(migrationFileImpact({...edited,sites:[{...edited.sites[0],line:2},...edited.sites.slice(1)]},rules).ok).toBe(false);
    expect(migrationFileImpact({...edited,sites:[{...edited.sites[0],column:99},...edited.sites.slice(1)]},rules).ok).toBe(false);
    expect(migrationFileImpact({...edited,sites:[{...edited.sites[0],source:'other.srp'},...edited.sites.slice(1)]},rules).ok).toBe(false);
  });
});
describe('migration impact summary',()=>{
  it('aggregates exact changed-source and selected-rule counts without exporting source text',async()=>{
    const listed=[{name:label,path},{name:'src/b.srp',path:'/private-native/src/b.srp'}];
    const review=value(prepareProjectMigration(listed,DEFAULT_PROJECT_SEARCH_SCOPE,false,rules));
    const result=await scanProjectMigration(review,initialEditorState,async source=>
      source===path?'old_value; helper_fn(); // private context':'helper_fn();',
      {isCurrent:()=>true,isCancelled:()=>false});
    if(result.kind!=='inventory')throw Error('Missing inventory');
    const plan=value(planProjectMigration(result.value,result.value.sites.map(site=>site.id),false,initialEditorState));
    const impact=value(buildMigrationImpact(plan));
    expect(impact.files).toHaveLength(2);
    expect(impact.edits).toBe(3);
    expect(impact.changedLines).toBe(2);
    expect(impact.ruleCounts).toEqual([1,2]);
    expect(impact.bytesAfter).toBeLessThan(impact.bytesBefore);
    const report=impactReport(impact);
    for(const secret of [label,'old_value','helper_fn','private context','/private-native/'])expect(report).not.toContain(secret);
    expect(impactReport(impact,true)).toContain(label);
    expect(impactReport(impact,true)).not.toContain('private context');
    expect(buildMigrationImpact({...plan,replacements:99}).ok).toBe(false);
    expect(buildMigrationImpact({...plan,changes:[plan.changes[0],plan.changes[0]]}).ok).toBe(false);
    expect(pageImpact([],NaN)).toEqual({page:1,pages:1,rows:[]});
  });
});
