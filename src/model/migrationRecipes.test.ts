import {describe,expect,it} from 'vitest';
import {emptyMigrationRecipes,addMigrationRecipe,renameMigrationRecipe,removeMigrationRecipe,clearMigrationRecipes,
  prepareMigrationRecipeReview,confirmMigrationRecipeApply,confirmMigrationRecipeReplace,parseMigrationRecipeBackup,
  exportMigrationRecipes,reviewMigrationRecipeImport,confirmMigrationRecipeImport,MAX_MIGRATION_RECIPES,
  MAX_RECIPE_BACKUP_UNITS,MIGRATION_RECIPE_FORMAT,type MigrationRecipeLibrary} from './migrationRecipes';

const rules=[{from:'old_value',to:'new_value'},{from:'helper_fn',to:'worker_fn'}];
const changed=[{from:'old_value',to:'replacement_value'}];
function value<T>(result:{ok:true;value:T}|{ok:false;error:string}):T{
  if(!result.ok)throw Error(result.error);return result.value;
}
function library(){
  return value(addMigrationRecipe(emptyMigrationRecipes(),'Private migration',rules));
}
function backup(recipes:unknown[]){
  return JSON.stringify({format:MIGRATION_RECIPE_FORMAT,version:1,recipes});
}
function portable(name:string,mappings=rules){return {name,rules:mappings};}
describe('session recipe library',()=>{
  it('adds normalized distinct names and freezes only canonical ordered mappings',()=>{
    const empty=emptyMigrationRecipes();
    const next=value(addMigrationRecipe(empty,'  Private migration  ',rules));
    expect(empty.recipes).toEqual([]);
    expect(next).toMatchObject({revision:1,nextId:2,recipes:[{id:1,name:'Private migration',rules}]});
    expect(Object.isFrozen(next.recipes[0].rules[0])).toBe(true);
    expect(addMigrationRecipe(next,'PRIVATE MIGRATION',changed).ok).toBe(false);
    expect(addMigrationRecipe(next,'\u202ehidden',changed).ok).toBe(false);
    expect(addMigrationRecipe(next,'Other',[{from:'funcra',to:'x'}]).ok).toBe(false);
  });
  it('renames, removes and clears without reusing stable identifiers',()=>{
    const one=library();
    const two=value(addMigrationRecipe(one,'Second recipe',changed));
    expect(renameMigrationRecipe(two,1,'second recipe').ok).toBe(false);
    const renamed=value(renameMigrationRecipe(two,1,'Renamed'));
    expect(renamed.recipes[0].name).toBe('Renamed');
    expect(renamed.recipes[0].id).toBe(1);
    expect(value(renameMigrationRecipe(renamed,1,'Renamed'))).toBe(renamed);
    const removed=value(removeMigrationRecipe(renamed,1));
    expect(removed.recipes.map(item=>item.id)).toEqual([2]);
    const cleared=clearMigrationRecipes(removed);
    expect(cleared.recipes).toEqual([]);
    expect(clearMigrationRecipes(cleared)).toBe(cleared);
    const fresh=value(addMigrationRecipe(cleared,'Another',rules));
    expect(fresh.recipes[0].id).toBe(3);
  });
  it('enforces capacity without silently evicting older recipes',()=>{
    let current=emptyMigrationRecipes();
    for(let index=0;index<MAX_MIGRATION_RECIPES;index++)current=value(addMigrationRecipe(current,'Recipe '+index,rules));
    expect(current.recipes).toHaveLength(MAX_MIGRATION_RECIPES);
    expect(addMigrationRecipe(current,'Overflow',changed).ok).toBe(false);
    expect(current.recipes[0].name).toBe('Recipe 0');
  });
});
describe('reviewed mapping draft changes',()=>{
  it('allows reviewing application over incomplete drafts without granting scan authority',()=>{
    const current=library(),drafts=[{from:'',to:''}];
    const review=value(prepareMigrationRecipeReview(current,1,drafts,'apply'));
    expect(review.drafts).toEqual(drafts);
    const applied=value(confirmMigrationRecipeApply(current,review,drafts));
    expect(applied).toEqual(rules);
    expect(applied).not.toBe(current.recipes[0].rules);
    expect(current.recipes[0].rules).toEqual(rules);
    expect(prepareMigrationRecipeReview(current,1,drafts,'replace').ok).toBe(false);
  });
  it('invalidates review on changed drafts, reordered mappings, renamed or removed recipe',()=>{
    const current=library(),review=value(prepareMigrationRecipeReview(current,1,rules,'apply'));
    expect(confirmMigrationRecipeApply(current,review,changed).ok).toBe(false);
    expect(confirmMigrationRecipeApply(current,review,[...rules].reverse()).ok).toBe(false);
    expect(confirmMigrationRecipeApply(value(renameMigrationRecipe(current,1,'Renamed')),review,rules).ok).toBe(false);
    expect(confirmMigrationRecipeApply(value(removeMigrationRecipe(current,1)),review,rules).ok).toBe(false);
    expect(confirmMigrationRecipeReplace(current,review,rules).ok).toBe(false);
  });
  it('replaces only the chosen recipe after exact draft confirmation',()=>{
    const current=value(addMigrationRecipe(library(),'Second',rules));
    const review=value(prepareMigrationRecipeReview(current,1,changed,'replace'));
    const next=value(confirmMigrationRecipeReplace(current,review,changed));
    expect(next.recipes[0].rules).toEqual(changed);
    expect(next.recipes[1]).toBe(current.recipes[1]);
    expect(next.nextId).toBe(current.nextId);
    expect(confirmMigrationRecipeReplace(current,review,rules).ok).toBe(false);
  });
});
describe('portable recipe backups',()=>{
  it('round-trips only format, version, names and mapping strings',()=>{
    const current=library(),raw=value(exportMigrationRecipes(current));
    expect(JSON.parse(raw)).toEqual({format:MIGRATION_RECIPE_FORMAT,version:1,recipes:[portable('Private migration')]});
    expect(value(parseMigrationRecipeBackup(raw))).toEqual([portable('Private migration')]);
    expect(raw).not.toContain('nextId');
    expect(raw).not.toContain('revision');
    expect(raw).not.toContain('scope');
  });
  it('rejects unknown fields or invalid nested mappings rather than dropping them',()=>{
    for(const input of [
      JSON.stringify({format:MIGRATION_RECIPE_FORMAT,version:2,recipes:[]}),
      JSON.stringify({format:MIGRATION_RECIPE_FORMAT,version:1,recipes:[],path:'/private'}),
      backup([{...portable('Recipe'),scope:{directory:'src'}}]),
      backup([{...portable('Recipe'),rules:[{from:'old_value',to:'new_value',offset:0}]}]),
      backup([{...portable('Recipe'),rules:[{from:'old_value',to:'new_value',command:'run'}]}]),
      backup([{...portable('Recipe'),rules:[{from:'old_value',to:'new_value',acknowledged:true}]}]),
      backup([portable('Recipe'),portable('recipe')]),
      backup([portable('Recipe',[{from:'old_value',to:'old_value'}])]),
      backup([portable('Recipe',[])]),
      'not-json','x'.repeat(MAX_RECIPE_BACKUP_UNITS+1),
    ])expect(parseMigrationRecipeBackup(input).ok).toBe(false);
  });
  it('keeps new, identical and conflicting names distinct and imports only selected new entries',()=>{
    const current=library();
    const raw=backup([portable('Private migration'),portable('Second',changed),portable('Third')]);
    const review=value(reviewMigrationRecipeImport(current,raw));
    expect(review.rows.map(row=>row.status)).toEqual(['identical','new','new']);
    expect(confirmMigrationRecipeImport(current,review,[0]).ok).toBe(false);
    expect(confirmMigrationRecipeImport(current,review,[1,1]).ok).toBe(false);
    const imported=value(confirmMigrationRecipeImport(current,review,[2]));
    expect(imported.recipes.map(item=>item.name)).toEqual(['Private migration','Third']);
    const conflict=value(reviewMigrationRecipeImport(imported,backup([portable('private migration',changed)])));
    expect(conflict.rows[0].status).toBe('conflict');
    expect(confirmMigrationRecipeImport(imported,conflict,[0]).ok).toBe(false);
  });
  it('pins the exact library identity and rejects forged import rows and excessive selection',()=>{
    let current:MigrationRecipeLibrary=library();
    for(let i=0;i<MAX_MIGRATION_RECIPES-2;i++)current=value(addMigrationRecipe(current,'Existing '+i,rules));
    const review=value(reviewMigrationRecipeImport(current,backup([portable('New one'),portable('New two')])));
    expect(review.capacity).toBe(1);
    expect(confirmMigrationRecipeImport(current,review,[0,1]).ok).toBe(false);
    expect(confirmMigrationRecipeImport(current,{...review,capacity:99},[0]).ok).toBe(false);
    expect(confirmMigrationRecipeImport(current,{...review,rows:review.rows.slice(1)},[0]).ok).toBe(false);
    const renamed=value(renameMigrationRecipe(current,1,'Changed'));
    expect(confirmMigrationRecipeImport(renamed,review,[0]).ok).toBe(false);
    expect(value(confirmMigrationRecipeImport(current,review,[0])).recipes).toHaveLength(MAX_MIGRATION_RECIPES);
  });
});
