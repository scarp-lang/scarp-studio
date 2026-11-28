import {describe,expect,it} from 'vitest';
import {analyzeWhitespaceFile,applyWhitespaceEdits,validateWhitespaceOptions,sameWhitespaceTokenSequence,indentationColumns,
  visibleWhitespace,DEFAULT_WHITESPACE_OPTIONS,MAX_WHITESPACE_EDITS,MAX_WHITESPACE_EDIT_UNITS,
  type WhitespaceOptions} from './sourceWhitespace';
import {scanScarpSource} from '../language/sourceLex';

const options=DEFAULT_WHITESPACE_OPTIONS;
function value<T>(result:{ok:true;value:T}|{ok:false;error:string}):T{
  if(!result.ok)throw Error(result.error);return result.value;
}
function clean(content:string,patch:Partial<WhitespaceOptions>={}){
  return value(analyzeWhitespaceFile(content,{...options,...patch}));
}
function literals(content:string){
  return scanScarpSource(content).tokens.filter(token=>token.kind==='string')
    .map(token=>content.slice(token.start,token.end));
}
describe('whitespace options and bounded operations',()=>{
  it('validates canonical options and requires a selected transformation',()=>{
    expect(value(validateWhitespaceOptions(options))).toEqual(options);
    expect(validateWhitespaceOptions({...options,trimTrailing:false,finalNewline:false}).ok).toBe(false);
    expect(validateWhitespaceOptions({...options,tabWidth:3 as 4}).ok).toBe(false);
    expect(validateWhitespaceOptions({...options,endings:'cr' as 'lf'}).ok).toBe(false);
    expect(validateWhitespaceOptions({...options,indentation:'mixed' as 'spaces'}).ok).toBe(false);
  });
  it('preserves no-op and empty source snapshots',()=>{
    expect(clean('').content).toBe('');
    expect(clean('bind value = 1;\n').edits).toEqual([]);
    expect(clean('bind value = 1;\r\n').edits).toEqual([]);
  });
  it('trims trailing spaces and comments without altering internal whitespace',()=>{
    const before='bind value = 1;  \r\n// keep  internal\t   \r\n\t  \r\nprint(value);\t';
    const result=clean(before);
    expect(result.content).toBe('bind value = 1;\r\n// keep  internal\r\n\r\nprint(value);\r\n');
    expect(result.counts).toEqual({trailing:4,indentation:0,'line-ending':0,'final-newline':1});
    expect(result.edits.every(edit=>before.slice(edit.start,edit.end)===edit.original)).toBe(true);
    expect(sameWhitespaceTokenSequence(before,result.content,true)).toBe(true);
  });
  it('normalizes indentation using visual tab stops, not a fixed replacement per tab',()=>{
    expect(indentationColumns(' \t  \t ',4)).toBe(9);
    const before=' \tbind value = 1;\n \t  print(value);\n';
    expect(clean(before,{indentation:'spaces'}).content).toBe('    bind value = 1;\n      print(value);\n');
    expect(clean('      bind value = 1;\n',{indentation:'tabs'}).content).toBe('\t  bind value = 1;\n');
    expect(clean('  bind value = 1;\n',{indentation:'tabs',tabWidth:2}).content).toBe('\tbind value = 1;\n');
    expect(clean('      bind value = 1;\n',{indentation:'tabs',tabWidth:8}).content).toBe('      bind value = 1;\n');
  });
  it('does not overlap leading indentation and trailing trim on blank lines',()=>{
    const result=clean(' \t  \n\tprint(1);\n',{indentation:'spaces'});
    expect(result.content).toBe('\n    print(1);\n');
    expect(result.counts.trailing).toBe(1);
    expect(result.counts.indentation).toBe(1);
  });
  it('normalizes supported line endings while preserving exact token slices',()=>{
    const before='bind value = 1;\r\nprint(value);\r// comment\nprint(2);';
    const lf=clean(before,{endings:'lf'});
    expect(lf.content).toBe('bind value = 1;\nprint(value);\n// comment\nprint(2);\n');
    expect(lf.counts['line-ending']).toBe(2);
    expect(lf.counts['final-newline']).toBe(1);
    const crlf=clean(before,{endings:'crlf'});
    expect(crlf.content).toBe('bind value = 1;\r\nprint(value);\r\n// comment\r\nprint(2);\r\n');
    expect(crlf.counts['line-ending']).toBe(2);
    expect(sameWhitespaceTokenSequence(before,crlf.content,true)).toBe(true);
  });
  it('withholds final newline when preserving an already mixed convention',()=>{
    const before='print(1);\r\nprint(2);\nprint(3);';
    const result=clean(before);
    expect(result.content).toBe(before);
    expect(result.protected.mixedFinalNewline).toBe(true);
    expect(result.counts['final-newline']).toBe(0);
    expect(clean(before,{endings:'lf'}).content.endsWith('\n')).toBe(true);
  });
  it('protects multiline and raw string whitespace, including internal CRLF',()=>{
    const before='bind text = """first  \r\n \t second  \r\n  third""";  \r\nbind raw = r"inside  "; \r\n';
    const result=clean(before,{endings:'lf',indentation:'spaces'});
    expect(literals(result.content)).toEqual(literals(before));
    expect(result.protected.literalTrailing).toBe(2);
    expect(result.protected.literalIndentation).toBe(2);
    expect(result.protected.literalEndings).toBe(2);
    expect(result.content).toBe('bind text = """first  \r\n \t second  \r\n  third""";\nbind raw = r"inside  ";\n');
  });
  it('does not trim or convert protected literal data even when every other option is enabled',()=>{
    const before='bind text = """line one  \n  \tline two\t \n  """;\n';
    const result=clean(before,{endings:'crlf',indentation:'tabs'});
    expect(literals(result.content)).toEqual(literals(before));
    expect(result.protected.literalEndings).toBe(2);
    expect(result.content.endsWith('""";\r\n')).toBe(true);
    expect(result.content).toContain('line two\t \n');
  });
  it('rejects malformed lexical text and edit or indentation budget exhaustion',()=>{
    for(const text of ['bind text = "unterminated','print(1);\u0000','\ud800']){
      expect(analyzeWhitespaceFile(text,options).ok).toBe(false);
    }
    expect(analyzeWhitespaceFile('x; \n'.repeat(MAX_WHITESPACE_EDITS+1),options).ok).toBe(false);
    expect(analyzeWhitespaceFile(' '.repeat(MAX_WHITESPACE_EDIT_UNITS+1)+'x;',{
      ...options,indentation:'tabs'}).ok).toBe(false);
    expect(analyzeWhitespaceFile('x; ',options,0).ok).toBe(false);
    expect(analyzeWhitespaceFile('x;\n',options,0).ok).toBe(true);
  });
});
describe('whitespace transformation invariants',()=>{
  it('checks original byte slices instead of token preview strings',()=>{
    expect(sameWhitespaceTokenSequence('bind x = 1;','bind x = 2;',true)).toBe(false);
    expect(sameWhitespaceTokenSequence('bind x = "a ";','bind x = "a";',true)).toBe(false);
    expect(sameWhitespaceTokenSequence('a b','ab',true)).toBe(false);
    expect(sameWhitespaceTokenSequence('// comment   \n','// comment\n',true)).toBe(true);
    expect(sameWhitespaceTokenSequence('// comment   \n','// comment\n',false)).toBe(false);
  });
  it('refuses forged, duplicate, overlapping and non-whitespace edits',()=>{
    const before='bind x = 1;  ';
    const result=clean(before),first=result.edits[0];
    expect(applyWhitespaceEdits(before,[first,first]).ok).toBe(false);
    expect(applyWhitespaceEdits(before,[{...first,start:0}]).ok).toBe(false);
    expect(applyWhitespaceEdits(before,[{...first,replacement:'x'}]).ok).toBe(false);
    expect(applyWhitespaceEdits(before,[{...first,kind:'final-newline'}]).ok).toBe(false);
    expect(value(applyWhitespaceEdits(before,result.edits))).toBe(result.content);
  });
  it('is idempotent and preserves lexical sequence across generated indentation/EOL combinations',()=>{
    for(const eol of ['\n','\r','\r\n']){
      for(const indent of [' ','\t',' \t','\t  ','        ']){
        for(const style of ['preserve','tabs','spaces'] as const){
          for(const target of ['preserve','lf','crlf'] as const){
            const before='funcra example() {'+eol+indent+'print("literal  "); \t'+eol+'}';
            const patch={indentation:style,endings:target,tabWidth:4 as const};
            const result=clean(before,patch);
            expect(sameWhitespaceTokenSequence(before,result.content,true)).toBe(true);
            expect(clean(result.content,patch).edits).toEqual([]);
          }
        }
      }
    }
  });
  it('renders only bounded visible whitespace symbols',()=>{
    expect(visibleWhitespace(' \t\r\n')).toBe('·→CR LF ');
    expect(visibleWhitespace('')).toBe('(empty)');
    expect(visibleWhitespace(' '.repeat(200))).toContain('200 units');
  });
});
