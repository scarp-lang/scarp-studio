import type {ProjectMigrationPlan,MigrationChange} from './projectIdentifierMigration';
import {migrationFailure,replaceMigrationSites,type MigrationResult,type MigrationRule,type MigrationSite} from './migrationRules';
import {splitSnapshotLines,type SnapshotLine,type DiffLineEnding} from './sourceDiff';
import {unicodeSafePreviewBounds,utf8ByteLength} from './utf8Text';
import {MAX_SCOPE_REPORT_UNITS} from './projectSearchScope';

export const MAX_IMPACT_WINDOW_UNITS=512;
export const IMPACT_CONTEXT=24;
export const IMPACT_PAGE_SIZE=12;
export interface ImpactFragment{
  readonly text:string;
  readonly changed:boolean;
  readonly rule:number|null;
}
export interface ImpactWindow{
  readonly id:string;
  readonly line:number;
  readonly beforeColumn:number;
  readonly afterColumn:number;
  readonly prefixClipped:boolean;
  readonly suffixClipped:boolean;
  readonly ending:DiffLineEnding;
  readonly sites:number;
  readonly before:readonly ImpactFragment[];
  readonly after:readonly ImpactFragment[];
}
export interface MigrationFileImpact{
  readonly source:string;
  readonly origin:'open-buffer'|'disk';
  readonly edits:number;
  readonly changedLines:number;
  readonly bytesBefore:number;
  readonly bytesAfter:number;
  readonly ruleCounts:readonly number[];
  readonly windows:readonly ImpactWindow[];
}
export interface MigrationImpact{
  readonly files:readonly MigrationFileImpact[];
  readonly edits:number;
  readonly changedLines:number;
  readonly bytesBefore:number;
  readonly bytesAfter:number;
  readonly ruleCounts:readonly number[];
}
interface SitePosition{
  readonly site:MigrationSite;
  readonly start:number;
  readonly end:number;
  readonly afterStart:number;
  readonly afterEnd:number;
}
function positionsForLine(line:SnapshotLine,sites:readonly MigrationSite[],rules:readonly MigrationRule[]):MigrationResult<readonly SitePosition[]>{
  let previous=0,delta=0;
  const positions:SitePosition[]=[];
  for(const site of sites){
    const start=site.offset-line.start,end=site.end-line.start,rule=rules[site.rule];
    if(!rule||start<previous||end>line.text.length||line.text.slice(start,end)!==rule.from||
      site.line!==line.index||site.column!==start+1)
      return migrationFailure('Reviewed line coordinates no longer match.');
    const afterStart=start+delta,afterEnd=afterStart+rule.to.length;
    positions.push({site,start,end,afterStart,afterEnd});
    delta+=rule.to.length-(end-start);previous=end;
  }
  return {ok:true,value:positions};
}
function windowBounds(line:SnapshotLine,positions:readonly SitePosition[]){
  return unicodeSafePreviewBounds(line.text,Math.max(0,positions[0].start-IMPACT_CONTEXT),
    Math.min(line.text.length,positions.at(-1)!.end+IMPACT_CONTEXT));
}
function buildWindow(source:string,line:SnapshotLine,positions:readonly SitePosition[],rules:readonly MigrationRule[],
  ordinal:number,previousEnd:number,nextStart:number):MigrationResult<ImpactWindow>{
  const candidate=windowBounds(line,positions);
  const bounds={start:Math.max(candidate.start,previousEnd),end:Math.min(candidate.end,nextStart)};
  const before:ImpactFragment[]=[],after:ImpactFragment[]=[];
  let cursor=bounds.start;
  const plain=(text:string)=>{
    if(!text)return;
    before.push(Object.freeze({text,changed:false,rule:null}));after.push(Object.freeze({text,changed:false,rule:null}));
  };
  for(const position of positions){
    if(position.start<cursor||position.end>bounds.end)return migrationFailure('Migration context is inconsistent.');
    plain(line.text.slice(cursor,position.start));
    const rule=rules[position.site.rule];
    before.push(Object.freeze({text:rule.from,changed:true,rule:position.site.rule}));
    after.push(Object.freeze({text:rule.to,changed:true,rule:position.site.rule}));
    cursor=position.end;
  }
  plain(line.text.slice(cursor,bounds.end));
  const beforeUnits=before.reduce((sum,part)=>sum+part.text.length,0);
  const afterUnits=after.reduce((sum,part)=>sum+part.text.length,0);
  if(beforeUnits>MAX_IMPACT_WINDOW_UNITS||afterUnits>MAX_IMPACT_WINDOW_UNITS)
    return migrationFailure('Migration line preview exceeded its window budget.');
  return {ok:true,value:Object.freeze({
    id:JSON.stringify([source,line.index,ordinal]),line:line.index,
    beforeColumn:bounds.start+1,
    afterColumn:bounds.start+positions[0].afterStart-positions[0].start+1,
    prefixClipped:bounds.start>0,suffixClipped:bounds.end<line.text.length,
    ending:line.ending,sites:positions.length,before:Object.freeze(before),after:Object.freeze(after),
  })};
}
/** Group nearby selected edits into bounded context windows. A gap between
 * windows is never implied to be edited. Context stops before selected
 * tokens belonging to adjacent windows; each edit is represented once. */
function lineWindows(source:string,line:SnapshotLine,positions:readonly SitePosition[],rules:readonly MigrationRule[]):MigrationResult<readonly ImpactWindow[]>{
  const groups:SitePosition[][]=[];
  for(const position of positions){
    const current=groups.at(-1);
    if(!current){groups.push([position]);continue;}
    const candidate=[...current,position],bounds=windowBounds(line,candidate);
    const units=bounds.end-bounds.start;
    const delta=candidate.reduce((sum,item)=>sum+rules[item.site.rule].to.length-(item.end-item.start),0);
    if(position.start-current.at(-1)!.end<=IMPACT_CONTEXT*2&&
      units<=MAX_IMPACT_WINDOW_UNITS&&units+delta<=MAX_IMPACT_WINDOW_UNITS)current.push(position);
    else groups.push([position]);
  }
  const windows:ImpactWindow[]=[];
  for(const [index,group] of groups.entries()){
    const previousEnd=groups[index-1]?.at(-1)?.end??0;
    const nextStart=groups[index+1]?.[0].start??line.text.length;
    const result=buildWindow(source,line,group,rules,index,previousEnd,nextStart);
    if(!result.ok)return result;
    windows.push(result.value);
  }
  return {ok:true,value:Object.freeze(windows)};
}
export function migrationFileImpact(change:MigrationChange,rules:readonly MigrationRule[]):MigrationResult<MigrationFileImpact>{
  // Reconstruct the exact planned output before deriving display metadata.
  // The preview is not authority for a subsequent edit.
  const reconstructed=replaceMigrationSites(change.before,rules,change.sites);
  if(!reconstructed.ok||reconstructed.value!==change.after)
    return migrationFailure('Reviewed migration output no longer matches.');
  const before=splitSnapshotLines(change.before),after=splitSnapshotLines(change.after);
  if(before.length!==after.length)return migrationFailure('Identifier migration must preserve line count.');
  const byLine=new Map<number,MigrationSite[]>();
  for(const site of [...change.sites].sort((a,b)=>a.offset-b.offset)){
    if(site.source!==change.source||!Number.isSafeInteger(site.line)||site.line<1||site.line>before.length)
      return migrationFailure('Reviewed migration source or line changed.');
    const group=byLine.get(site.line)??[];
    group.push(site);byLine.set(site.line,group);
  }
  const counts=rules.map(()=>0),windows:ImpactWindow[]=[];
  for(const line of before){
    const current=after[line.index-1];
    if(line.ending!==current.ending)return migrationFailure('Identifier migration must preserve line endings.');
    const sites=byLine.get(line.index)??[];
    if(!sites.length){
      if(line.text!==current.text)return migrationFailure('An unselected line changed.');
      continue;
    }
    const positions=positionsForLine(line,sites,rules);
    if(!positions.ok)return positions;
    // Validate the output using actual post-edit positions, including
    // differing identifier lengths in earlier edits on the same line.
    for(const position of positions.value){
      if(current.text.slice(position.afterStart,position.afterEnd)!==rules[position.site.rule].to)
        return migrationFailure('Post-edit lexical coordinates no longer match.');
      counts[position.site.rule]++;
    }
    const result=lineWindows(change.source,line,positions.value,rules);
    if(!result.ok)return result;
    windows.push(...result.value);
  }
  if(windows.reduce((sum,window)=>sum+window.sites,0)!==change.sites.length)
    return migrationFailure('Migration window accounting failed.');
  return {ok:true,value:Object.freeze({
    source:change.source,origin:change.document?'open-buffer':'disk',edits:change.sites.length,
    changedLines:byLine.size,bytesBefore:utf8ByteLength(change.before),bytesAfter:utf8ByteLength(change.after),
    ruleCounts:Object.freeze(counts),windows:Object.freeze(windows),
  })};
}
export function buildMigrationImpact(plan:ProjectMigrationPlan):MigrationResult<MigrationImpact>{
  const files:MigrationFileImpact[]=[];
  const rules=plan.inventory.review.rules,counts=rules.map(()=>0);
  let edits=0,changedLines=0,bytesBefore=0,bytesAfter=0;
  const seen=new Set<string>();
  for(const change of plan.changes){
    if(seen.has(change.source))return migrationFailure('Repeated migration source.');
    seen.add(change.source);
    const file=migrationFileImpact(change,rules);
    if(!file.ok)return file;
    files.push(file.value);edits+=file.value.edits;changedLines+=file.value.changedLines;
    bytesBefore+=file.value.bytesBefore;bytesAfter+=file.value.bytesAfter;
    file.value.ruleCounts.forEach((count,index)=>{counts[index]+=count;});
  }
  if(edits!==plan.replacements)return migrationFailure('Migration replacement counts disagree.');
  return {ok:true,value:Object.freeze({files:Object.freeze(files),edits,changedLines,bytesBefore,bytesAfter,ruleCounts:Object.freeze(counts)})};
}
export function pageImpact<T>(rows:readonly T[],requested:number){
  const pages=Math.max(1,Math.ceil(rows.length/IMPACT_PAGE_SIZE));
  const page=Math.min(pages,Math.max(1,Number.isSafeInteger(requested)?requested:1));
  return {page,pages,rows:rows.slice((page-1)*IMPACT_PAGE_SIZE,page*IMPACT_PAGE_SIZE)};
}
export function impactReport(impact:MigrationImpact,includeLabels=false):string{
  const lines=['Scarp Studio — reviewed migration impact',
    'Counts describe selected lexical edits, not semantic compatibility.',
    'Changed files: '+impact.files.length,'Selected substitutions: '+impact.edits,
    'Changed lines: '+impact.changedLines,'Original UTF-8 bytes: '+impact.bytesBefore,
    'Staged UTF-8 bytes: '+impact.bytesAfter,
    ...impact.ruleCounts.map((count,index)=>'Mapping '+(index+1)+': '+count+' selected sites'),
    'No source text, identifiers, paths or context fragments exported.'];
  let units=lines.join('\n').length;
  if(includeLabels)for(const file of impact.files){
    const line=JSON.stringify(file.source)+'; '+file.origin+'; '+file.edits+' sites; '+file.changedLines+' lines';
    if(units+line.length+1>MAX_SCOPE_REPORT_UNITS-100){lines.push('Additional labels omitted.');break;}
    lines.push(line);units+=line.length+1;
  }
  return lines.join('\n');
}
