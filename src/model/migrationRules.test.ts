import {describe,expect,it} from 'vitest';
import {validateMigrationRules,mappingWarnings,scanMigrationFile,replaceMigrationSites,
  MAX_MIGRATION_RULES,MAX_MIGRATION_SITES,type MigrationRule} from './migrationRules';

const name='src/fixture.srp';
const rules=[{from:'old_value',to:'new_value'},{from:'helper_fn',to:'worker_fn'}];
function value<T>(result:{ok:true;value:T}|{ok:false;error:string}):T{
  if(!result.ok)throw Error(result.error);return result.value;
}
describe('simultaneous migration rules',()=>{
  it('copies and freezes a distinct mapping inventory',()=>{
    const result=value(validateMigrationRules(rules));
    expect(result).toEqual(rules);
    expect(result).not.toBe(rules);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result[0])).toBe(true);
  });
  it('rejects invalid identifiers, reserved tokens, identical names and duplicate originals',()=>{
    for(const input of [[],[{from:'',to:'x'}],[{from:'old-name',to:'new_name'}],
      [{from:'old_name',to:'funcra'}],[{from:'old_name',to:'print'}],
      [{from:'old_name',to:'old_name'}],[{from:'old_name',to:'new_name'},{from:'old_name',to:'different'}],
      [{from:'नाम',to:'new_name'}],[{from:'x'.repeat(129),to:'new_name'}],
      Array.from({length:MAX_MIGRATION_RULES+1},(_,index)=>({from:'old_'+index,to:'new_'+index}))]){
      expect(validateMigrationRules(input).ok).toBe(false);
    }
  });
  it('allows swaps and shared targets only as visible warnings',()=>{
    const input=[{from:'old_a',to:'old_b'},{from:'old_b',to:'old_a'},{from:'old_c',to:'old_b'}];
    const warnings=mappingWarnings(value(validateMigrationRules(input)));
    expect(warnings).toEqual([
      {source:null,rule:0,kind:'shared-target',count:2},
      {source:null,rule:0,kind:'mapped-target',count:1},
      {source:null,rule:1,kind:'mapped-target',count:1},
      {source:null,rule:2,kind:'shared-target',count:2},
      {source:null,rule:2,kind:'mapped-target',count:1},
    ]);
  });
});
describe('lexical migration observations',()=>{
  it('retains exact offsets and roles without touching comments, raw and multiline strings',()=>{
    const source=[
      'bind old_value = 1;',
      'funcra helper_fn() { print(old_value); }',
      'module.helper_fn();',
      '// old_value helper_fn',
      'bind text = r"old_value";',
      'bind text2 = """helper_fn',
      'old_value""";',
      'bind old_value_longer = 2;',
    ].join('\r\n');
    const result=value(scanMigrationFile(name,source,rules));
    expect(result.sites.map(site=>[site.rule,site.role,site.line])).toEqual([
      [0,'declaration',1],[1,'declaration',2],[0,'other',2],[1,'qualified',3],
    ]);
    expect(result.sites.every(site=>source.slice(site.offset,site.end)===rules[site.rule].from)).toBe(true);
    expect(result.warnings).toEqual([]);
    const changed=value(replaceMigrationSites(source,rules,result.sites));
    expect(changed).toBe(source.replace('bind old_value =','bind new_value =')
      .replace('funcra helper_fn()','funcra worker_fn()').replace('print(old_value)','print(new_value)')
      .replace('module.helper_fn()','module.worker_fn()'));
  });
  it('counts target identifiers in code, excluding strings and comments',()=>{
    const source='bind old_value = new_value;\nnew_value();\n// new_value\nbind text = "new_value";';
    const result=value(scanMigrationFile(name,source,rules));
    expect(result.sites).toHaveLength(1);
    expect(result.warnings).toEqual([{source:name,rule:0,kind:'existing-target',count:2}]);
  });
  it('never returns a partial edit inventory after uncertain boundaries or malformed text',()=>{
    for(const source of ['old_value; éold_value;','old_value; new_valueé;', 'old_value; "unterminated',
      'old_value;\u0000','old_value;\ud800']){
      expect(scanMigrationFile(name,source,rules).ok).toBe(false);
    }
  });
  it('fails after the site cap instead of dropping matching offsets',()=>{
    expect(scanMigrationFile(name,'old_value;'.repeat(MAX_MIGRATION_SITES),rules).ok).toBe(true);
    expect(scanMigrationFile(name,'old_value;'.repeat(MAX_MIGRATION_SITES+1),rules).ok).toBe(false);
    expect(scanMigrationFile(name,'old_value;',rules,0).ok).toBe(false);
    expect(scanMigrationFile(name,'new_value;',rules,0).ok).toBe(true);
  });
  it('keeps excerpts on one line with Unicode-safe boundaries',()=>{
    const source='// hidden previous line\n'+ '😀'.repeat(30)+'; old_value; '+ '😀'.repeat(30)+'\n// hidden next line';
    const result=value(scanMigrationFile(name,source,rules));
    expect(result.sites[0].clippedBefore).toBe(true);
    expect(result.sites[0].clippedAfter).toBe(true);
    expect(result.sites[0].before).not.toContain('\n');
    expect(result.sites[0].after).toContain('new_value');
    expect(result.sites[0].before.length).toBeLessThan(120);
  });
});
describe('simultaneous original-offset replacements',()=>{
  it('applies swaps without cascading generated names',()=>{
    const input=[{from:'old_a',to:'old_b'},{from:'old_b',to:'old_a'}];
    const source='old_a(); old_b(); old_a();';
    const scan=value(scanMigrationFile(name,source,input));
    expect(value(replaceMigrationSites(source,input,scan.sites))).toBe('old_b(); old_a(); old_b();');
  });
  it('applies only selected original offsets regardless of selection order',()=>{
    const source='old_value; helper_fn(); old_value;';
    const scan=value(scanMigrationFile(name,source,rules));
    expect(value(replaceMigrationSites(source,rules,[scan.sites[2],scan.sites[0]])))
      .toBe('new_value; helper_fn(); new_value;');
  });
  it('rejects duplicate, overlapping, moved or forged rule offsets',()=>{
    const source='old_value; helper_fn();';
    const scan=value(scanMigrationFile(name,source,rules));
    const first=scan.sites[0];
    expect(replaceMigrationSites(source,rules,[first,first]).ok).toBe(false);
    expect(replaceMigrationSites(source,rules,[{...first,offset:1}]).ok).toBe(false);
    expect(replaceMigrationSites(source,rules,[{...first,rule:99}]).ok).toBe(false);
    expect(replaceMigrationSites(source,rules,[{...first,end:first.end+1}]).ok).toBe(false);
    expect(replaceMigrationSites(' '+source,rules,[first]).ok).toBe(false);
  });
  it('preserves original byte spelling under generated simultaneous mapping permutations',()=>{
    const names=['old_alpha','old_beta','old_gamma','old_delta'];
    for(let offset=1;offset<names.length;offset++){
      const input:MigrationRule[]=names.map((from,index)=>({from,to:names[(index+offset)%names.length]}));
      const original=names.flatMap(from=>[from,from]).join('; ');
      const scan=value(scanMigrationFile(name,original,input));
      const expected=names.flatMap((_,index)=>[names[(index+offset)%names.length],names[(index+offset)%names.length]]).join('; ');
      expect(value(replaceMigrationSites(original,input,scan.sites))).toBe(expected);
    }
  });
});
