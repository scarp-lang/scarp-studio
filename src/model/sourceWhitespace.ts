import {scanScarpSource,type InsightToken} from '../language/sourceLex';
import {splitSnapshotLines,type DiffLineEnding} from './sourceDiff';
import {assertScarpSourceText} from './sourceLimits';
import {utf8ByteLength} from './utf8Text';

export const WHITESPACE_KINDS=['trailing','indentation','line-ending','final-newline'] as const;
export type WhitespaceKind=typeof WHITESPACE_KINDS[number];
export const WHITESPACE_LABELS:Readonly<Record<WhitespaceKind,string>>=Object.freeze({
  trailing:'Trim trailing spaces/tabs',indentation:'Normalize leading indentation',
  'line-ending':'Normalize unprotected line ending','final-newline':'Add final newline',
});
export const MAX_WHITESPACE_EDITS=1200;
export const MAX_WHITESPACE_EDIT_UNITS=4096;
export type WhitespaceOptions={
  readonly trimTrailing:boolean;
  readonly indentation:'preserve'|'spaces'|'tabs';
  readonly tabWidth:2|4|8;
  readonly endings:'preserve'|'lf'|'crlf';
  readonly finalNewline:boolean;
};
export const DEFAULT_WHITESPACE_OPTIONS:WhitespaceOptions=Object.freeze({
  trimTrailing:true,indentation:'preserve',tabWidth:4,endings:'preserve',finalNewline:true,
});
export type WhitespaceResult<T>={readonly ok:true;readonly value:T}|{readonly ok:false;readonly error:string};
export const whitespaceFailure=(error:string):WhitespaceResult<never>=>({ok:false,error});
export function validateWhitespaceOptions(value:WhitespaceOptions):WhitespaceResult<WhitespaceOptions>{
  if(!value||typeof value.trimTrailing!=='boolean'||typeof value.finalNewline!=='boolean'||
    !['preserve','spaces','tabs'].includes(value.indentation)||![2,4,8].includes(value.tabWidth)||
    !['preserve','lf','crlf'].includes(value.endings))
    return whitespaceFailure('Choose supported whitespace options.');
  if(!value.trimTrailing&&!value.finalNewline&&value.indentation==='preserve'&&value.endings==='preserve')
    return whitespaceFailure('Enable at least one whitespace transformation.');
  return {ok:true,value:Object.freeze({...value})};
}
export interface WhitespaceEdit{
  readonly id:string;
  readonly kind:WhitespaceKind;
  readonly line:number;
  readonly column:number;
  readonly start:number;
  readonly end:number;
  readonly original:string;
  readonly replacement:string;
}
export interface WhitespaceProtection{
  readonly literalTrailing:number;
  readonly literalIndentation:number;
  readonly literalEndings:number;
  readonly mixedFinalNewline:boolean;
}
export interface WhitespaceFileResult{
  readonly content:string;
  readonly edits:readonly WhitespaceEdit[];
  readonly counts:Readonly<Record<WhitespaceKind,number>>;
  readonly protected:WhitespaceProtection;
  readonly bytesBefore:number;
  readonly bytesAfter:number;
}
function intersects(strings:readonly InsightToken[],start:number,end:number):boolean{
  let low=0,high=strings.length;
  while(low<high){
    const mid=(low+high)>>>1;
    if(strings[mid].end<=start)low=mid+1;
    else high=mid;
  }
  return low<strings.length&&strings[low].start<end;
}
export function indentationColumns(indent:string,width:number):number{
  let column=0;
  for(const char of indent){
    if(char===' ')column++;
    else if(char==='\t')column+=width-(column%width);
    else throw Error('Indentation contains non-whitespace');
  }
  return column;
}
function normalizedIndent(indent:string,style:WhitespaceOptions['indentation'],width:number):string{
  if(style==='preserve')return indent;
  const columns=indentationColumns(indent,width);
  if(columns>MAX_WHITESPACE_EDIT_UNITS)throw Error('Indentation budget reached');
  return style==='spaces'?' '.repeat(columns):'\t'.repeat(Math.floor(columns/width))+' '.repeat(columns%width);
}
function endingFor(options:WhitespaceOptions):DiffLineEnding|null{
  return options.endings==='lf'?'\n':options.endings==='crlf'?'\r\n':null;
}
function counts():Record<WhitespaceKind,number>{
  return {trailing:0,indentation:0,'line-ending':0,'final-newline':0};
}
/** The editor lexer is not a compiler. Compare actual token slices, not
 * truncated previews. Comments may lose trailing space/tab units only
 * when selected; string tokens and all code tokens must be byte-identical.
 * A whitespace transform that changes a token boundary is rejected. */
export function sameWhitespaceTokenSequence(before:string,after:string,trimTrailing:boolean):boolean{
  const a=scanScarpSource(before),b=scanScarpSource(after);
  if(!a.complete||!b.complete||a.issues.length||b.issues.length||a.tokens.length!==b.tokens.length)return false;
  const commentText=(text:string)=>{
    if(!trimTrailing)return text;
    let end=text.length;
    while(end>0&&(text[end-1]===' '||text[end-1]==='\t'))end--;
    return text.slice(0,end);
  };
  return a.tokens.every((token,index)=>{
    const next=b.tokens[index];
    if(token.kind!==next.kind)return false;
    const left=before.slice(token.start,token.end),right=after.slice(next.start,next.end);
    return token.kind==='comment'?commentText(left)===commentText(right):left===right;
  });
}
export function applyWhitespaceEdits(content:string,edits:readonly WhitespaceEdit[]):WhitespaceResult<string>{
  if(edits.length>MAX_WHITESPACE_EDITS)return whitespaceFailure('Whitespace edit budget reached.');
  let cursor=0;
  const seen=new Set<string>(),chunks:string[]=[];
  for(const edit of [...edits].sort((a,b)=>a.start-b.start||a.end-b.end)){
    if(seen.has(edit.id)||!Number.isSafeInteger(edit.start)||!Number.isSafeInteger(edit.end)||
      edit.start<cursor||edit.end<edit.start||edit.end>content.length||
      content.slice(edit.start,edit.end)!==edit.original||edit.original===edit.replacement||
      edit.original.length>MAX_WHITESPACE_EDIT_UNITS||edit.replacement.length>MAX_WHITESPACE_EDIT_UNITS)
      return whitespaceFailure('Whitespace ranges overlap, changed or exceed the budget.');
    const valid=edit.kind==='trailing'?/^[ \t]+$/.test(edit.original)&&edit.replacement==='':
      edit.kind==='indentation'?/^[ \t]+$/.test(edit.original)&&/^[ \t]+$/.test(edit.replacement):
      edit.kind==='line-ending'?['\n','\r','\r\n'].includes(edit.original)&&['\n','\r\n'].includes(edit.replacement):
      edit.kind==='final-newline'?edit.start===content.length&&edit.original===''&&['\n','\r','\r\n'].includes(edit.replacement):false;
    if(!valid)return whitespaceFailure('Unsupported whitespace edit.');
    seen.add(edit.id);chunks.push(content.slice(cursor,edit.start),edit.replacement);cursor=edit.end;
  }
  chunks.push(content.slice(cursor));
  const result=chunks.join('');
  try{assertScarpSourceText(result);}catch{return whitespaceFailure('Formatted source exceeds the source limit.');}
  return {ok:true,value:result};
}
/** Whitespace-only transformation outside string literals. Newlines inside
 * raw/multiline literals and indentation/trailing spaces belonging to
 * string values are preserved even when the file remains mixed.
 * Never infer semantic formatting or parse compiler syntax. */
export function analyzeWhitespaceFile(content:string,input:WhitespaceOptions,
  remaining=MAX_WHITESPACE_EDITS):WhitespaceResult<WhitespaceFileResult>{
  const validated=validateWhitespaceOptions(input);
  if(!validated.ok)return validated;
  const options=validated.value;
  if(!Number.isSafeInteger(remaining)||remaining<0||remaining>MAX_WHITESPACE_EDITS)
    return whitespaceFailure('Invalid whitespace edit budget.');
  try{assertScarpSourceText(content);}catch{return whitespaceFailure('Unsupported source text.');}
  const lex=scanScarpSource(content);
  if(!lex.complete||lex.issues.length)return whitespaceFailure('Source has incomplete or malformed lexical content.');
  const strings=lex.tokens.filter(token=>token.kind==='string');
  const lines=splitSnapshotLines(content);
  const edits:WhitespaceEdit[]=[];
  const totals=counts();
  const protection={literalTrailing:0,literalIndentation:0,literalEndings:0,mixedFinalNewline:false};
  const requestedEnding=endingFor(options);
  const resultingEndings=new Set<DiffLineEnding>();
  let exceeded=false;
  function add(kind:WhitespaceKind,line:number,column:number,start:number,end:number,replacement:string){
    const original=content.slice(start,end);
    if(original===replacement)return;
    if(edits.length>=remaining||original.length>MAX_WHITESPACE_EDIT_UNITS||replacement.length>MAX_WHITESPACE_EDIT_UNITS){
      exceeded=true;return;
    }
    edits.push(Object.freeze({id:JSON.stringify([kind,start,end]),kind,line,column,start,end,original,replacement}));
    totals[kind]++;
  }
  try{
    for(const line of lines){
      const end=line.start+line.text.length;
      let trailing=line.text.length;
      while(trailing>0&&(line.text[trailing-1]===' '||line.text[trailing-1]==='\t'))trailing--;
      if(options.trimTrailing&&trailing<line.text.length){
        if(intersects(strings,line.start+trailing,end))protection.literalTrailing++;
        else add('trailing',line.index,trailing+1,line.start+trailing,end,'');
      }
      // Blank lines are handled by trailing trim alone; never overlap edits.
      if(options.indentation!=='preserve'&&trailing>0){
        const indent=/^[ \t]+/.exec(line.text)?.[0]??'';
        if(indent){
          if(intersects(strings,line.start,line.start+indent.length))protection.literalIndentation++;
          else add('indentation',line.index,1,line.start,line.start+indent.length,
            normalizedIndent(indent,options.indentation,options.tabWidth));
        }
      }
      if(line.ending){
        if(requestedEnding&&line.ending!==requestedEnding){
          if(intersects(strings,end,line.end)){
            protection.literalEndings++;resultingEndings.add(line.ending);
          }else{
            add('line-ending',line.index,line.text.length+1,end,line.end,requestedEnding);
            resultingEndings.add(requestedEnding);
          }
        }else resultingEndings.add(line.ending);
      }
      if(exceeded)return whitespaceFailure('Whitespace edit budget reached. Narrow the scope.');
    }
  }catch{return whitespaceFailure('Indentation or whitespace transformation exceeds its bound.');}
  if(options.finalNewline&&content.length&&!/[\r\n]$/.test(content)){
    const last=lines.at(-1)!;
    // When preserving EOL convention, do not invent a final EOL in an
    // already mixed source. Explicit normalization provides a choice.
    if(!requestedEnding&&resultingEndings.size>1)protection.mixedFinalNewline=true;
    else add('final-newline',last.index,last.text.length+1,content.length,content.length,
      requestedEnding??[...resultingEndings][0]??'\n');
  }
  if(exceeded)return whitespaceFailure('Whitespace edit budget reached. Narrow the scope.');
  const applied=applyWhitespaceEdits(content,edits);
  if(!applied.ok)return applied;
  if(!sameWhitespaceTokenSequence(content,applied.value,options.trimTrailing))
    return whitespaceFailure('Proposed whitespace changes alter the lexical token sequence.');
  return {ok:true,value:Object.freeze({
    content:applied.value,edits:Object.freeze(edits.sort((a,b)=>a.start-b.start||a.end-b.end)),
    counts:Object.freeze(totals),protected:Object.freeze(protection),
    bytesBefore:utf8ByteLength(content),bytesAfter:utf8ByteLength(applied.value),
  })};
}
export function visibleWhitespace(value:string):string{
  // Bounded presentation: show only whitespace symbols, not source context.
  const prefix=value.slice(0,80).replace(/ /g,'·').replace(/\t/g,'→').replace(/\r/g,'CR ').replace(/\n/g,'LF ');
  return (prefix||'(empty)')+(value.length>80?'… ('+value.length+' units)':'');
}
