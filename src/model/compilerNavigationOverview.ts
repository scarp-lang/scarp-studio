import { REFERENCE_KINDS, SYMBOL_KINDS, type CompilerNavigationReport, type CompilerReferenceKind,
  type CompilerSymbolKind, type CompilerSymbol } from './compilerNavigation';

export const MAX_OVERVIEW_REPORT_UNITS = 64 * 1024;
export const OVERVIEW_PAGE_SIZE = 15;
type KindCounts<K extends string> = Readonly<Record<K, number>>;
export interface SymbolUsage {
  readonly symbolId: number;
  readonly references: number | null;
  readonly local: number | null;
  readonly external: number | null;
  readonly unknownDefinition: number | null;
  readonly byKind: KindCounts<CompilerReferenceKind> | null;
  readonly sourceIds: readonly number[];
}
export interface FileOverview {
  readonly sourceId: number;
  readonly symbols: number;
  readonly publicSymbols: number;
  readonly mutableSymbols: number;
  readonly bySymbolKind: KindCounts<CompilerSymbolKind>;
  readonly referencesFrom: number | null;
  readonly referencesTo: number | null;
  readonly crossFileFrom: number | null;
  readonly crossFileTo: number | null;
  readonly implicitTargetReferences: number | null;
}
export interface CrossFileLink {
  readonly from: number;
  readonly to: number;
  readonly references: number;
  readonly distinctTargets: readonly number[];
  readonly byKind: KindCounts<CompilerReferenceKind>;
}
export interface NavigationOverview {
  readonly includesReferences: boolean;
  readonly files: readonly FileOverview[];
  readonly implicitSymbols: number;
  readonly usage: readonly SymbolUsage[];
  readonly links: readonly CrossFileLink[];
  readonly localReferences: number | null;
  readonly crossFileReferences: number | null;
  readonly implicitTargetReferences: number | null;
}
function counts<K extends string>(keys: readonly K[]): Record<K,number> {
  return Object.fromEntries(keys.map(key => [key,0])) as Record<K,number>;
}
function freezeCounts<K extends string>(value: Record<K, number>): KindCounts<K> {
  return Object.freeze(value);
}
/** Summarize compiler-owned occurrences without inventing use sites,
 * inferred dependencies, unused-code findings, or cross-snapshot IDs.
 * "Local" compares the source of a reference with its definition site.
 * An implicit or builtin definition has no source location and therefore
 * remains separate rather than being assigned to an owner's file.
 */
export function summarizeCompilerNavigation(report: CompilerNavigationReport): NavigationOverview {
  const include = report.kind === 'references';
  const files = report.files.map(file => ({
    sourceId: file.id, symbols: 0, publicSymbols: 0, mutableSymbols: 0,
    bySymbolKind: counts(SYMBOL_KINDS), referencesFrom: 0, referencesTo: 0,
    crossFileFrom: 0, crossFileTo: 0, implicitTargetReferences: 0,
  }));
  const usage = report.symbols.map(symbol => ({
    symbolId: symbol.id, references: 0, local: 0, external: 0,
    unknownDefinition: 0, byKind: counts(REFERENCE_KINDS), sources: new Set<number>(),
  }));
  let implicitSymbols = 0;
  for (const symbol of report.symbols) {
    if (symbol.location === null) { implicitSymbols++; continue; }
    const row = files[symbol.location.source];
    row.symbols++;
    row.bySymbolKind[symbol.kind]++;
    if (symbol.public) row.publicSymbols++;
    if (symbol.mutable) row.mutableSymbols++;
  }
  const links = new Map<string, { from:number; to:number; references:number;
    distinctTargets:Set<number>; byKind:Record<CompilerReferenceKind,number> }>();
  let local = 0, external = 0, implicit = 0;
  if (include) for (const reference of report.references) {
    const source = reference.location.source;
    const target = report.symbols[reference.target];
    const item = usage[target.id];
    item.references++;
    item.byKind[reference.kind]++;
    item.sources.add(source);
    files[source].referencesFrom++;
    if (!target.location) {
      item.unknownDefinition++;
      files[source].implicitTargetReferences++;
      implicit++;
      continue;
    }
    const destination = target.location.source;
    files[destination].referencesTo++;
    if (source === destination) {
      item.local++;
      local++;
      continue;
    }
    item.external++;
    external++;
    files[source].crossFileFrom++;
    files[destination].crossFileTo++;
    const key = source + ':' + destination;
    let link = links.get(key);
    if (!link) {
      link = { from:source, to:destination, references:0,
        distinctTargets:new Set(), byKind:counts(REFERENCE_KINDS) };
      links.set(key,link);
    }
    link.references++;
    link.distinctTargets.add(target.id);
    link.byKind[reference.kind]++;
  }
  const number = (value:number) => include ? value : null;
  return Object.freeze({
    includesReferences: include,
    implicitSymbols,
    files: Object.freeze(files.map(row => Object.freeze({
      ...row, bySymbolKind:freezeCounts(row.bySymbolKind),
      referencesFrom:number(row.referencesFrom), referencesTo:number(row.referencesTo),
      crossFileFrom:number(row.crossFileFrom), crossFileTo:number(row.crossFileTo),
      implicitTargetReferences:number(row.implicitTargetReferences),
    }))),
    usage: Object.freeze(usage.map(row => Object.freeze({
      symbolId:row.symbolId, references:number(row.references), local:number(row.local),
      external:number(row.external), unknownDefinition:number(row.unknownDefinition),
      byKind:include ? freezeCounts(row.byKind) : null,
      sourceIds:Object.freeze([...row.sources].sort((a,b)=>a-b)),
    }))),
    links: Object.freeze([...links.values()].sort((a,b)=>b.references-a.references||a.from-b.from||a.to-b.to)
      .map(link=>Object.freeze({
        from:link.from,to:link.to,references:link.references,byKind:freezeCounts(link.byKind),
        distinctTargets:Object.freeze([...link.distinctTargets].sort((a,b)=>a-b)),
      }))),
    localReferences:number(local),crossFileReferences:number(external),implicitTargetReferences:number(implicit),
  });
}

export type UsageFilter = 'all' | 'has-references' | 'no-observed-references' | 'cross-file' | 'writes';
export type UsageOrder = 'source' | 'references' | 'cross-file' | 'name';
export interface UsageQuery {
  readonly filter: UsageFilter;
  readonly order: UsageOrder;
  readonly sourceId: number | 'all' | 'implicit';
  readonly query: string;
}
export const DEFAULT_USAGE_QUERY: UsageQuery = Object.freeze({
  filter:'all',order:'source',sourceId:'all',query:'',
});
export interface UsageRow {
  readonly symbol: CompilerSymbol;
  readonly usage: SymbolUsage;
}
export function querySymbolUsage(report:CompilerNavigationReport, overview:NavigationOverview, query:UsageQuery):UsageRow[]{
  const terms=query.query.slice(0,120).trim().toLowerCase().split(/\s+/).filter(Boolean);
  const rows:UsageRow[]=[];
  for(const symbol of report.symbols){
    const use=overview.usage[symbol.id];
    if(!use)continue;
    if(query.sourceId==='implicit'&&symbol.location!==null)continue;
    if(typeof query.sourceId==='number'&&symbol.location?.source!==query.sourceId)continue;
    // Missing references are not equivalent to zero references.
    if(query.filter!=='all'&&use.references===null)continue;
    if(query.filter==='has-references'&&!use.references)continue;
    if(query.filter==='no-observed-references'&&use.references!==0)continue;
    if(query.filter==='cross-file'&&!use.external)continue;
    if(query.filter==='writes'&&(!use.byKind||use.byKind.write+use.byKind.read_write===0))continue;
    const haystack=(symbol.name+' '+symbol.kind+' '+(symbol.location===null?'implicit':report.files[symbol.location.source].path)).toLowerCase();
    if(!terms.every(term=>haystack.includes(term)))continue;
    rows.push({symbol,usage:use});
  }
  const compare=(a:string,b:string)=>a<b?-1:a>b?1:0;
  if(query.order==='name')rows.sort((a,b)=>compare(a.symbol.name,b.symbol.name)||a.symbol.id-b.symbol.id);
  if(query.order==='references')rows.sort((a,b)=>(b.usage.references??-1)-(a.usage.references??-1)||a.symbol.id-b.symbol.id);
  if(query.order==='cross-file')rows.sort((a,b)=>(b.usage.external??-1)-(a.usage.external??-1)||a.symbol.id-b.symbol.id);
  return rows;
}

export interface OwnershipNode {
  readonly symbol: CompilerSymbol;
  readonly childIds: readonly number[];
  readonly descendantCount: number;
}
export interface OwnershipOverview {
  readonly roots: readonly number[];
  readonly nodes: readonly OwnershipNode[];
}
/** The validated report has acyclic owner links. Count descendants with
 * an iterative leaf-to-root pass so deep compiler nesting never exhausts
 * the JS call stack. Ownership is not a lexical scope or call graph. */
export function buildOwnershipOverview(report:CompilerNavigationReport):OwnershipOverview{
  const children=report.symbols.map(()=>[] as number[]);
  const roots:number[]=[];
  for(const symbol of report.symbols){
    if(symbol.owner===null)roots.push(symbol.id);
    else children[symbol.owner].push(symbol.id);
  }
  const remaining=children.map(list=>list.length);
  const queue=remaining.flatMap((count,id)=>count===0?[id]:[]);
  const descendants=remaining.map(()=>0);
  for(let i=0;i<queue.length;i++){
    const id=queue[i], parent=report.symbols[id].owner;
    if(parent===null)continue;
    descendants[parent]+=descendants[id]+1;
    if(--remaining[parent]===0)queue.push(parent);
  }
  return Object.freeze({
    roots:Object.freeze(roots),
    nodes:Object.freeze(report.symbols.map(symbol=>Object.freeze({
      symbol,childIds:Object.freeze(children[symbol.id]),descendantCount:descendants[symbol.id],
    }))),
  });
}
export interface OwnershipRow {
  readonly id:number;
  readonly depth:number;
}
export function visibleOwnershipRows(tree:OwnershipOverview,expanded:ReadonlySet<number>):readonly OwnershipRow[]{
  const queue=tree.roots.map(id=>({id,depth:0})).reverse();
  const result:OwnershipRow[]=[];
  while(queue.length){
    const row=queue.pop()!;
    result.push(row);
    if(expanded.has(row.id)){
      const children=tree.nodes[row.id].childIds;
      for(let i=children.length-1;i>=0;i--)queue.push({id:children[i],depth:row.depth+1});
    }
  }
  return result;
}
export function overviewPage<T>(items:readonly T[],requested:number){
  const pages=Math.max(1,Math.ceil(items.length/OVERVIEW_PAGE_SIZE));
  const page=Number.isSafeInteger(requested)?Math.max(1,Math.min(pages,requested)):1;
  return {page,pages,items:items.slice((page-1)*OVERVIEW_PAGE_SIZE,page*OVERVIEW_PAGE_SIZE)};
}
export function buildNavigationOverviewReport(report:CompilerNavigationReport,overview:NavigationOverview,includeLabels=false){
  const lines=[
    'Scarp Studio — historical compiler inspection overview',
    'Snapshot-local IDs; not a live index, call graph, dependency proof or unused-code analysis.',
    'Files: '+report.files.length+'; symbols: '+report.symbols.length+'; implicit definitions: '+overview.implicitSymbols,
    'References: '+(overview.includesReferences?report.references.length:'not requested'),
    'Local: '+(overview.localReferences??'not requested')+'; cross-file: '+(overview.crossFileReferences??'not requested')+
      '; implicit target: '+(overview.implicitTargetReferences??'not requested'),
    includeLabels?'File and symbol labels included; review for private paths/names.':'IDs and counts only; no paths or symbol names.',
  ];
  let used=lines.join('\n').length,omitted=0;
  const append=(line:string)=>{
    if(used+line.length+1>MAX_OVERVIEW_REPORT_UNITS-100){omitted++;return;}
    lines.push(line);used+=line.length+1;
  };
  for(const file of overview.files){
    append('File #'+file.sourceId+(includeLabels?' '+JSON.stringify(report.files[file.sourceId].path):'')+
      ' | definitions '+file.symbols+' | public '+file.publicSymbols+' | mutable '+file.mutableSymbols+
      ' | references from '+(file.referencesFrom??'not requested')+' | references to '+(file.referencesTo??'not requested'));
  }
  for(const link of overview.links){
    append('Cross-file #'+link.from+' → #'+link.to+' | references '+link.references+' | distinct targets '+link.distinctTargets.length);
  }
  for(const use of overview.usage){
    const symbol=report.symbols[use.symbolId];
    append('Symbol #'+use.symbolId+(includeLabels?' '+JSON.stringify(symbol.name):'')+
      ' | '+symbol.kind+' | references '+(use.references??'not requested')+
      ' | cross-file '+(use.external??'not requested'));
  }
  if(omitted)lines.push(omitted+' row(s) omitted by report limit.');
  return {text:lines.join('\n'),omitted};
}
