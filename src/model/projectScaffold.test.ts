import { describe,expect,it } from 'vitest';
import { planProjectScaffold,scaffoldPlanIsCurrent,scaffoldVersionValid,summarizeScaffoldResult,
  MAX_SCAFFOLD_TOTAL_BYTES,type ProjectScaffoldRequest } from './projectScaffold';
import { PROJECT_SCAFFOLD_TEMPLATES } from './projectScaffoldTemplates';

const request:ProjectScaffoldRequest={parent:'practice',folderName:'calculator',projectName:'My "project" हिंदी',version:'1.2.3-alpha.1',template:'calculator',includeTests:true};
const targets=['','practice','one/two/three','one/two/three/four'];
function plan(patch:Partial<ProjectScaffoldRequest>={}){
  const result=planProjectScaffold({...request,...patch},targets);
  if(!result.ok)throw Error(result.error);
  return result.value;
}
describe('project scaffold plan',()=>{
  it('includes exact fixed manifest, entrypoint, library and optional tests',()=>{
    const result=plan();
    expect(result.directory).toBe('practice/calculator');
    expect(result.directories).toEqual(['src','tests']);
    expect(result.files.map(file=>file.path)).toEqual(['scarp.project','src/main.srp','src/math.srp','tests/arithmetic.srp','tests/identity.srp']);
    expect(result.files[0].content).toContain('project "My \\"project\\" हिंदी"');
    expect(result.files[0].content).toContain('entry: "src/main.srp"');
    expect(result.files[1].content).not.toContain(request.projectName);
    expect(result.bytes).toBe(result.files.reduce((total,file)=>total+new TextEncoder().encode(file.content).length,0));
    expect(Object.isFrozen(result.files)).toBe(true);
  });
  it('keeps tests optional and all recipes within their budgets',()=>{
    for(const template of PROJECT_SCAFFOLD_TEMPLATES){
      const included=plan({template:template.id}),excluded=plan({template:template.id,includeTests:false});
      expect(included.files.some(file=>file.kind==='test')).toBe(true);
      expect(excluded.files.some(file=>file.kind==='test')).toBe(false);
      expect(excluded.directories).toEqual(['src']);
      expect(excluded.files.some(file=>file.path==='src/main.srp')).toBe(true);
      expect(included.bytes).toBeLessThanOrEqual(MAX_SCAFFOLD_TOTAL_BYTES);
    }
  });
  it.each(['','..','../x','a/b','a\\b','CON','nul.txt','.hidden','target','bad.','a:stream','a\u202eb','\ud800'])('rejects invalid folder %j',folderName=>{
    expect(planProjectScaffold({...request,folderName},targets).ok).toBe(false);
  });
  it('rejects unknown and unavailable parents and excess nesting',()=>{
    for(const parent of ['missing','../escape','one/two/three/four'])
      expect(planProjectScaffold({...request,parent},targets).ok).toBe(false);
    expect(plan({parent:'one/two/three'}).directory).toBe('one/two/three/calculator');
  });
  it.each(['','  x','x\nz','x\u0000','x\u202e','\ud800','x'.repeat(121)])('rejects invalid display name %j',projectName=>{
    expect(planProjectScaffold({...request,projectName},targets).ok).toBe(false);
  });
  it.each(['0.01.0','1.2','1.2.3-01','1.2.3+','v1.2.3','1.2.3-a..b'])('rejects invalid version %s',version=>{
    expect(scaffoldVersionValid(version)).toBe(false);
  });
  it.each(['0.0.0','1.2.3-0','1.2.3-0a','1.2.3+01','1.2.3-rc.1+build.2'])('accepts semantic version %s',version=>{
    expect(scaffoldVersionValid(version)).toBe(true);
  });
  it('revalidates exact plan, not just the destination',()=>{
    const result=plan();
    expect(scaffoldPlanIsCurrent(result,targets)).toBe(true);
    expect(scaffoldPlanIsCurrent(result,[''])).toBe(false);
    expect(scaffoldPlanIsCurrent({...result,files:[{...result.files[0],content:'changed'},...result.files.slice(1)]},targets)).toBe(false);
    expect(scaffoldPlanIsCurrent({...result,directory:'other'},targets)).toBe(false);
  });
  it('does not label partial creation as success',()=>{
    expect(summarizeScaffoldResult({status:'partial',directory:'app',created:[{kind:'directory',relativePath:'app'}],
      uncertain:[{kind:'file',relativePath:'app/src/main.srp'}],error:'disk full'})).toContain('nothing was rolled back');
  });
});
