import { scanScarpSource, type InsightToken } from '../language/sourceLex';
import { functionHeaderOpenIndex } from '../language/genericSyntax';
import { indexSymbolFile, type WorkspaceSymbol } from './workspaceSymbols';
import { nextLineBreak, lineBreakWidth } from './sourceLines';
import type { StudioDocument } from './documents';

export type BreadcrumbKind = 'function' | 'record' | 'variant';
export interface SourceBreadcrumb {
  readonly id: string;
  readonly name: string;
  readonly kind: BreadcrumbKind;
  readonly start: number;
  readonly end: number;
  readonly line: number;
  readonly column: number;
  readonly bodyStart: number;
}
export interface SourceBreadcrumbIndex {
  readonly documentId: string;
  readonly revision: number;
  readonly source: string;
  readonly ranges: readonly SourceBreadcrumb[];
  readonly complete: boolean;
}
export interface BreadcrumbTarget {
  readonly documentId: string;
  readonly revision: number;
  readonly source: string;
  readonly line: number;
  readonly column: number;
}

const MAX_HEADER_TOKENS = 512;
const MAX_HEADER_UNITS = 8192;
const MAX_DELIMITER_DEPTH = 128;
const declarationKeywords = new Set(['funcra','record','variant','bind','var','import']);
const closeFor = new Map([['(',')'],['[',']'],['{','}']]);
const closing = new Set(closeFor.values());

function isDeclaration(symbol: WorkspaceSymbol): symbol is WorkspaceSymbol & {kind:BreadcrumbKind} {
  return symbol.kind==='function'||symbol.kind==='record'||symbol.kind==='variant';
}

/** Header recognition is deliberately conservative: find a body opening
 * at the declaration's own delimiter depth, never a later declaration's
 * body. This does not infer semantic scopes or compiler validity. */
function bodyOpening(tokens: readonly InsightToken[], nameIndex: number, kind: BreadcrumbKind): number | null {
  const name = tokens[nameIndex];
  let start = nameIndex + 1;
  if (kind==='function') {
    const parameterOpen = functionHeaderOpenIndex(tokens,nameIndex);
    if (parameterOpen===null) return null;
    start=parameterOpen;
  } else if (tokens[start]?.text !== '{') return null;
  const stack: string[] = [];
  for (let i=start;i<tokens.length&&i-start<MAX_HEADER_TOKENS;i++) {
    const token=tokens[i];
    if (token.end-name.start>MAX_HEADER_UNITS) return null;
    if (token.kind==='string') continue;
    const value=token.text;
    if (!stack.length) {
      if (value==='{') return i;
      if (value===';'||closing.has(value)||declarationKeywords.has(value)) return null;
    }
    if (closeFor.has(value)) {
      if (stack.length>=MAX_DELIMITER_DEPTH) return null;
      stack.push(closeFor.get(value)!);
    } else if (closing.has(value)) {
      if (stack.pop()!==value) return null;
    }
  }
  return null;
}

export function buildSourceBreadcrumbIndex(document: StudioDocument): SourceBreadcrumbIndex {
  const source=document.content;
  const ranges:SourceBreadcrumb[]=[];
  const finish=(complete:boolean):SourceBreadcrumbIndex=>Object.freeze({
    documentId:document.id,revision:document.revision,source,
    ranges:Object.freeze(ranges.sort((a,b)=>a.start-b.start||b.end-a.end)),complete,
  });
  const scan=scanScarpSource(source);
  if (!scan.complete||scan.issues.some(issue=>issue.kind==='unterminated-string'||issue.kind==='invalid-control')) {
    return finish(false);
  }
  const tokens=scan.tokens.filter(token=>token.kind!=='comment');
  const inventory=indexSymbolFile(document);
  const names=new Map(tokens.map((token,index)=>[token.start,index]));
  const openings=new Map<number,WorkspaceSymbol & {kind:BreadcrumbKind}>();
  let complete=inventory.complete;
  for (const symbol of inventory.symbols) {
    if (!isDeclaration(symbol)) continue;
    const nameIndex=names.get(symbol.offset);
    const open=nameIndex===undefined?null:bodyOpening(tokens,nameIndex,symbol.kind);
    if (open===null||openings.has(open)) {complete=false;continue;}
    openings.set(open,symbol);
  }
  const frames:{index:number;close:string}[]=[];
  for (let i=0;i<tokens.length;i++) {
    const token=tokens[i];
    if (token.kind!=='delimiter') continue;
    if (closeFor.has(token.text)) {
      if (frames.length>=MAX_DELIMITER_DEPTH) return finish(false);
      frames.push({index:i,close:closeFor.get(token.text)!});
    } else if (closing.has(token.text)) {
      const frame=frames.pop();
      if (!frame||frame.close!==token.text) return finish(false);
      const declaration=openings.get(frame.index);
      if (declaration) {
        ranges.push(Object.freeze({
          id:declaration.id,name:declaration.name,kind:declaration.kind,
          start:declaration.offset,end:token.end,bodyStart:tokens[frame.index].start,
          line:declaration.line,column:declaration.column,
        }));
      }
    }
  }
  return finish(complete&&frames.length===0&&ranges.length===openings.size);
}

export function breadcrumbOffset(source:string,line:number,column:number):number|null {
  if (!Number.isSafeInteger(line)||line<1||!Number.isSafeInteger(column)||column<1) return null;
  let start=0;
  for(let i=1;i<line;i++){
    const end=nextLineBreak(source,start);
    if(end<0)return null;
    start=end+lineBreakWidth(source,end);
  }
  const end=nextLineBreak(source,start);
  const limit=end<0?source.length:end;
  const offset=start+column-1;
  return offset<=limit?offset:null;
}

export function activeSourceBreadcrumbs(index:SourceBreadcrumbIndex,line:number,column:number):readonly SourceBreadcrumb[] {
  const offset=breadcrumbOffset(index.source,line,column);
  if(offset===null)return [];
  return index.ranges.filter(range=>range.start<=offset&&offset<range.end);
}

export function currentBreadcrumbTarget(index:SourceBreadcrumbIndex,document:StudioDocument,entry:SourceBreadcrumb):BreadcrumbTarget|null {
  if(index.documentId!==document.id||index.revision!==document.revision||index.source!==document.content||
      !index.ranges.some(item=>item===entry))return null;
  return {documentId:document.id,revision:document.revision,source:document.content,line:entry.line,column:entry.column};
}
