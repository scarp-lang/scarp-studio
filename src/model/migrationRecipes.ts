import {normalizeSearchPresetName} from './projectSearchPresets';
import {validateMigrationRules,migrationFailure,type MigrationRule,type MigrationResult} from './migrationRules';

export const MAX_MIGRATION_RECIPES=12;
export const MAX_RECIPE_BACKUP_UNITS=64*1024;
export const MIGRATION_RECIPE_FORMAT='scarp-studio.identifier-migration-recipes';
export interface MigrationRecipe{
  readonly id:number;
  readonly name:string;
  readonly rules:readonly MigrationRule[];
}
export interface MigrationRecipeLibrary{
  readonly revision:number;
  readonly nextId:number;
  readonly recipes:readonly MigrationRecipe[];
}
export function emptyMigrationRecipes():MigrationRecipeLibrary{
  return Object.freeze({revision:0,nextId:1,recipes:Object.freeze([])});
}
function copyRules(rules:readonly MigrationRule[]):readonly MigrationRule[]{
  return Object.freeze(rules.map(rule=>Object.freeze({from:rule.from,to:rule.to})));
}
export function sameMigrationRules(a:readonly MigrationRule[],b:readonly MigrationRule[]):boolean{
  return a.length===b.length&&a.every((rule,index)=>rule.from===b[index].from&&rule.to===b[index].to);
}
function recipe(id:number,name:string,rules:readonly MigrationRule[]):MigrationRecipe{
  return Object.freeze({id,name,rules:copyRules(rules)});
}
const key=(name:string)=>name.toLowerCase();
function duplicate(library:MigrationRecipeLibrary,name:string,except?:number):boolean{
  return library.recipes.some(item=>item.id!==except&&key(item.name)===key(name));
}
function update(library:MigrationRecipeLibrary,recipes:readonly MigrationRecipe[],nextId=library.nextId):MigrationRecipeLibrary{
  return Object.freeze({revision:library.revision+1,nextId,recipes:Object.freeze([...recipes])});
}
export function addMigrationRecipe(library:MigrationRecipeLibrary,name:unknown,rules:readonly MigrationRule[]):MigrationResult<MigrationRecipeLibrary>{
  if(library.recipes.length>=MAX_MIGRATION_RECIPES)return migrationFailure('Migration recipe capacity reached.');
  const normalized=normalizeSearchPresetName(name);
  if(!normalized.ok)return normalized;
  if(duplicate(library,normalized.value))return migrationFailure('A recipe with this name already exists.');
  const checked=validateMigrationRules(rules);
  if(!checked.ok)return checked;
  return {ok:true,value:update(library,[...library.recipes,recipe(library.nextId,normalized.value,checked.value)],library.nextId+1)};
}
export function renameMigrationRecipe(library:MigrationRecipeLibrary,id:number,name:unknown):MigrationResult<MigrationRecipeLibrary>{
  const selected=library.recipes.find(item=>item.id===id);
  if(!selected)return migrationFailure('The migration recipe no longer exists.');
  const normalized=normalizeSearchPresetName(name);
  if(!normalized.ok)return normalized;
  if(duplicate(library,normalized.value,id))return migrationFailure('A recipe with this name already exists.');
  if(selected.name===normalized.value)return {ok:true,value:library};
  return {ok:true,value:update(library,library.recipes.map(item=>item===selected?recipe(id,normalized.value,item.rules):item))};
}
export function removeMigrationRecipe(library:MigrationRecipeLibrary,id:number):MigrationResult<MigrationRecipeLibrary>{
  if(!library.recipes.some(item=>item.id===id))return migrationFailure('The migration recipe no longer exists.');
  return {ok:true,value:update(library,library.recipes.filter(item=>item.id!==id))};
}
export function clearMigrationRecipes(library:MigrationRecipeLibrary):MigrationRecipeLibrary{
  return library.recipes.length?update(library,[]):library;
}
export interface MigrationRecipeReview{
  readonly library:MigrationRecipeLibrary;
  readonly selected:MigrationRecipe;
  readonly drafts:readonly MigrationRule[];
  readonly action:'apply'|'replace';
}
export function prepareMigrationRecipeReview(library:MigrationRecipeLibrary,id:number,drafts:readonly MigrationRule[],
  action:MigrationRecipeReview['action']):MigrationResult<MigrationRecipeReview>{
  const selected=library.recipes.find(item=>item.id===id);
  if(!selected)return migrationFailure('The recipe no longer exists.');
  if(action!=='apply'&&action!=='replace')return migrationFailure('Unknown recipe action.');
  if(action==='replace'){
    const checked=validateMigrationRules(drafts);
    if(!checked.ok)return checked;
  }
  return {ok:true,value:Object.freeze({library,selected,drafts:copyRules(drafts),action})};
}
function reviewCurrent(library:MigrationRecipeLibrary,review:MigrationRecipeReview,drafts:readonly MigrationRule[]):boolean{
  return review.library===library&&library.recipes.includes(review.selected)&&sameMigrationRules(review.drafts,drafts);
}
export function confirmMigrationRecipeApply(library:MigrationRecipeLibrary,review:MigrationRecipeReview,
  drafts:readonly MigrationRule[]):MigrationResult<readonly MigrationRule[]>{
  if(review.action!=='apply'||!reviewCurrent(library,review,drafts))
    return migrationFailure('Recipe or mapping drafts changed. Review again.');
  return {ok:true,value:copyRules(review.selected.rules)};
}
export function confirmMigrationRecipeReplace(library:MigrationRecipeLibrary,review:MigrationRecipeReview,
  drafts:readonly MigrationRule[]):MigrationResult<MigrationRecipeLibrary>{
  if(review.action!=='replace'||!reviewCurrent(library,review,drafts))
    return migrationFailure('Recipe or mapping drafts changed. Review again.');
  const checked=validateMigrationRules(drafts);
  if(!checked.ok)return checked;
  if(sameMigrationRules(review.selected.rules,checked.value))return {ok:true,value:library};
  return {ok:true,value:update(library,library.recipes.map(item=>item===review.selected?
    recipe(item.id,item.name,checked.value):item))};
}

/** The portable schema contains only names and ordered identifier mappings.
 * It cannot carry source scope, paths, text, offsets, acknowledgements,
 * execution commands or editor authority. Imported recipes remain drafts. */
export interface PortableMigrationRecipe{
  readonly name:string;
  readonly rules:readonly MigrationRule[];
}
function object(value:unknown):value is Record<string,unknown>{
  return value!==null&&typeof value==='object'&&!Array.isArray(value);
}
function exact(value:Record<string,unknown>,keys:readonly string[]):boolean{
  return Object.keys(value).length===keys.length&&keys.every(name=>Object.hasOwn(value,name));
}
export function parseMigrationRecipeBackup(raw:string):MigrationResult<readonly PortableMigrationRecipe[]>{
  if(typeof raw!=='string'||!raw.length||raw.length>MAX_RECIPE_BACKUP_UNITS)
    return migrationFailure('Recipe backup is empty or exceeds the import budget.');
  let data:unknown;
  try{data=JSON.parse(raw);}catch{return migrationFailure('Recipe backup is not valid JSON.');}
  if(!object(data)||!exact(data,['format','version','recipes'])||
    data.format!==MIGRATION_RECIPE_FORMAT||data.version!==1||!Array.isArray(data.recipes)||
    data.recipes.length>MAX_MIGRATION_RECIPES)
    return migrationFailure('Unsupported migration recipe backup format.');
  const recipes:PortableMigrationRecipe[]=[];
  const names=new Set<string>();
  for(const item of data.recipes){
    if(!object(item)||!exact(item,['name','rules'])||!Array.isArray(item.rules))
      return migrationFailure('Unsupported recipe fields.');
    const name=normalizeSearchPresetName(item.name);
    if(!name.ok)return name;
    if(names.has(key(name.value)))return migrationFailure('Recipe backup contains duplicate names.');
    names.add(key(name.value));
    const rules:MigrationRule[]=[];
    for(const rule of item.rules){
      if(!object(rule)||!exact(rule,['from','to'])||typeof rule.from!=='string'||typeof rule.to!=='string')
        return migrationFailure('Unsupported identifier mapping fields.');
      rules.push({from:rule.from,to:rule.to});
    }
    const checked=validateMigrationRules(rules);
    if(!checked.ok)return checked;
    recipes.push(Object.freeze({name:name.value,rules:checked.value}));
  }
  return {ok:true,value:Object.freeze(recipes)};
}
export function exportMigrationRecipes(library:MigrationRecipeLibrary):MigrationResult<string>{
  const raw=JSON.stringify({format:MIGRATION_RECIPE_FORMAT,version:1,
    recipes:library.recipes.map(item=>({name:item.name,rules:item.rules}))},null,2);
  const checked=parseMigrationRecipeBackup(raw);
  return checked.ok?{ok:true,value:raw}:checked;
}
export type RecipeImportStatus='new'|'identical'|'conflict';
export interface RecipeImportRow{
  readonly incoming:PortableMigrationRecipe;
  readonly existing:MigrationRecipe|null;
  readonly status:RecipeImportStatus;
}
export interface RecipeImportReview{
  readonly library:MigrationRecipeLibrary;
  readonly raw:string;
  readonly rows:readonly RecipeImportRow[];
  readonly capacity:number;
}
export function reviewMigrationRecipeImport(library:MigrationRecipeLibrary,raw:string):MigrationResult<RecipeImportReview>{
  const parsed=parseMigrationRecipeBackup(raw);
  if(!parsed.ok)return parsed;
  const rows=parsed.value.map(incoming=>{
    const existing=library.recipes.find(item=>key(item.name)===key(incoming.name))??null;
    const status:RecipeImportStatus=!existing?'new':sameMigrationRules(existing.rules,incoming.rules)?'identical':'conflict';
    return Object.freeze({incoming,existing,status});
  });
  return {ok:true,value:Object.freeze({library,raw,rows:Object.freeze(rows),capacity:MAX_MIGRATION_RECIPES-library.recipes.length})};
}
export function confirmMigrationRecipeImport(library:MigrationRecipeLibrary,review:RecipeImportReview,
  selected:readonly number[]):MigrationResult<MigrationRecipeLibrary>{
  if(review.library!==library)return migrationFailure('Recipe library changed. Review import again.');
  const current=reviewMigrationRecipeImport(library,review.raw);
  if(!current.ok)return current;
  if(JSON.stringify(review.rows)!==JSON.stringify(current.value.rows)||review.capacity!==current.value.capacity)
    return migrationFailure('Recipe import review changed.');
  const ids=new Set(selected);
  if(!ids.size||ids.size!==selected.length||ids.size>current.value.capacity||
    selected.some(index=>!Number.isSafeInteger(index)||current.value.rows[index]?.status!=='new'))
    return migrationFailure('Select distinct new recipes within the remaining capacity.');
  let nextId=library.nextId;
  const additions=current.value.rows.flatMap((row,index)=>ids.has(index)?
    [recipe(nextId++,row.incoming.name,row.incoming.rules)]:[]);
  return {ok:true,value:update(library,[...library.recipes,...additions],nextId)};
}
