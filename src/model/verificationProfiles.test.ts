import {describe,expect,it} from 'vitest';
import {
  createVerificationProfileLibrary,addVerificationProfile,renameVerificationProfile,
  removeVerificationProfile,clearVerificationProfiles,prepareVerificationProfileReview,
  confirmVerificationProfileApply,confirmVerificationProfileReplace,exportVerificationProfiles,
  parseVerificationProfiles,reviewVerificationImport,confirmVerificationImport,
  sameVerificationRules,MAX_VERIFICATION_PROFILES,MAX_VERIFICATION_BACKUP_UNITS,
  VERIFICATION_PROFILE_FORMAT,
} from './verificationProfiles';
import type {VerificationRule} from './projectVerification';

const rule=(query='needle',name='Check'):VerificationRule=>({
  name,query,expectation:'present',options:{caseSensitive:true,wholeWord:false},
});
function value<T>(result:{ok:true;value:T}|{ok:false;error:string}):T{
  if(!result.ok)throw Error(result.error);
  return result.value;
}
function library(name='Sample',rules=[rule()]){
  return value(addVerificationProfile(createVerificationProfileLibrary(),name,rules));
}
function backup(profiles:unknown[]){
  return JSON.stringify({format:VERIFICATION_PROFILE_FORMAT,version:1,profiles});
}

describe('verification profile library',()=>{
  it('starts with an immutable empty library',()=>{
    const initial=createVerificationProfileLibrary();
    expect(initial.profiles).toEqual([]);
    expect(initial.revision).toBe(0);
    expect(initial.nextId).toBe(1);
    expect(Object.isFrozen(initial.profiles)).toBe(true);
  });
  it('captures independent rule and option snapshots',()=>{
    const input=rule();
    const initial=createVerificationProfileLibrary();
    const saved=value(addVerificationProfile(initial,'  Sample  ',[input]));
    expect(saved.profiles[0].name).toBe('Sample');
    expect(saved.profiles[0].rules[0]).not.toBe(input);
    expect(saved.profiles[0].rules[0].options).not.toBe(input.options);
    expect(Object.isFrozen(saved.profiles[0].rules)).toBe(true);
    expect(Object.isFrozen(saved.profiles[0].rules[0].options)).toBe(true);
    expect(initial.profiles).toHaveLength(0);
    expect(saved.revision).toBe(1);
    expect(saved.nextId).toBe(2);
  });
  it('rejects duplicate names regardless of case',()=>{
    const saved=library();
    expect(addVerificationProfile(saved,'sAMPLE',[rule('other')]).ok).toBe(false);
    expect(saved.profiles).toHaveLength(1);
  });
  it('rejects invalid drafts and invalid profile names',()=>{
    const empty=createVerificationProfileLibrary();
    for(const name of ['', '   ', 'x'.repeat(1000),null]){
      expect(addVerificationProfile(empty,name,[rule()]).ok).toBe(false);
    }
    expect(addVerificationProfile(empty,'valid',[]).ok).toBe(false);
    expect(addVerificationProfile(empty,'valid',[rule('')]).ok).toBe(false);
  });
  it('enforces capacity and never reuses removed identities',()=>{
    let saved=createVerificationProfileLibrary();
    for(let index=0;index<MAX_VERIFICATION_PROFILES;index++){
      saved=value(addVerificationProfile(saved,'Profile '+index,[rule()]));
    }
    expect(addVerificationProfile(saved,'Overflow',[rule()]).ok).toBe(false);
    const previous=saved.nextId;
    saved=value(removeVerificationProfile(saved,1));
    saved=value(addVerificationProfile(saved,'New',[rule()]));
    expect(saved.profiles.at(-1)?.id).toBe(previous);
    expect(saved.profiles).toHaveLength(MAX_VERIFICATION_PROFILES);
  });
  it('renames only the chosen profile and preserves rules',()=>{
    let saved=library();
    saved=value(addVerificationProfile(saved,'Second',[rule('second')]));
    const renamed=value(renameVerificationProfile(saved,1,'Renamed'));
    expect(renamed.profiles.map(item=>item.name)).toEqual(['Renamed','Second']);
    expect(renamed.profiles[0].rules).toEqual(saved.profiles[0].rules);
    expect(renamed.profiles[1]).toBe(saved.profiles[1]);
    expect(renameVerificationProfile(saved,1,'second').ok).toBe(false);
    expect(renameVerificationProfile(saved,999,'new').ok).toBe(false);
  });
  it('returns original library for unchanged name and empty clear',()=>{
    const saved=library();
    expect(value(renameVerificationProfile(saved,1,'Sample'))).toBe(saved);
    const empty=clearVerificationProfiles(saved);
    expect(empty.profiles).toHaveLength(0);
    expect(empty.nextId).toBe(saved.nextId);
    expect(clearVerificationProfiles(empty)).toBe(empty);
    expect(removeVerificationProfile(empty,1).ok).toBe(false);
  });
});

describe('verification profile reviews',()=>{
  it('allows applying valid saved rules over incomplete editor drafts',()=>{
    const saved=library();
    const drafts=[rule('')];
    const review=value(prepareVerificationProfileReview(saved,1,drafts,'apply'));
    const applied=value(confirmVerificationProfileApply(saved,review,drafts));
    expect(applied).toEqual([rule()]);
    expect(applied).not.toBe(saved.profiles[0].rules);
    expect(saved.revision).toBe(1);
  });
  it('rejects changes to query, expectation, flags, names and order after review',()=>{
    const saved=library();
    const current=[rule('old','First'),rule('next','Second')];
    const review=value(prepareVerificationProfileReview(saved,1,current,'apply'));
    const variants:VerificationRule[][]=[
      [rule('changed','First'),current[1]],
      [{...current[0],expectation:'absent'},current[1]],
      [{...current[0],options:{...current[0].options,wholeWord:true}},current[1]],
      [{...current[0],name:'Renamed'},current[1]],
      [...current].reverse(),
      [current[0]],
    ];
    for(const changed of variants){
      expect(confirmVerificationProfileApply(saved,review,changed).ok).toBe(false);
    }
  });
  it('rejects stale library revisions even when profile rules did not change',()=>{
    const saved=library();
    const current=[rule('current')];
    const review=value(prepareVerificationProfileReview(saved,1,current,'apply'));
    const newer=value(addVerificationProfile(saved,'Other',[rule()]));
    expect(confirmVerificationProfileApply(newer,review,current).ok).toBe(false);
  });
  it('requires valid replacement rules and distinguishes review actions',()=>{
    const saved=library();
    expect(prepareVerificationProfileReview(saved,1,[rule('')],'replace').ok).toBe(false);
    const drafts=[rule('replacement')];
    const review=value(prepareVerificationProfileReview(saved,1,drafts,'replace'));
    expect(confirmVerificationProfileApply(saved,review,drafts).ok).toBe(false);
    const replaced=value(confirmVerificationProfileReplace(saved,review,drafts));
    expect(replaced.profiles[0].rules).toEqual(drafts);
    expect(replaced.profiles[0].id).toBe(1);
    expect(saved.profiles[0].rules).toEqual([rule()]);
    expect(confirmVerificationProfileReplace(replaced,review,drafts).ok).toBe(false);
  });
  it('does not revise an identical replacement',()=>{
    const saved=library();
    const review=value(prepareVerificationProfileReview(saved,1,[rule()],'replace'));
    expect(value(confirmVerificationProfileReplace(saved,review,[rule()]))).toBe(saved);
    expect(sameVerificationRules([rule()],[rule()])).toBe(true);
    expect(sameVerificationRules([rule()],[])).toBe(false);
  });
});

describe('strict portable verification backups',()=>{
  it('round-trips only named rule sets without runtime authority or paths',()=>{
    const saved=library('Portable',[rule('private literal')]);
    const text=value(exportVerificationProfiles(saved));
    const parsed=JSON.parse(text);
    expect(Object.keys(parsed).sort()).toEqual(['format','profiles','version']);
    expect(Object.keys(parsed.profiles[0]).sort()).toEqual(['name','rules']);
    expect(value(parseVerificationProfiles(text))).toEqual([
      {name:'Portable',rules:[rule('private literal')]},
    ]);
  });
  it('rejects malformed, oversized and unsupported backups',()=>{
    const cases=[
      '', '{', 'null','[]','x'.repeat(MAX_VERIFICATION_BACKUP_UNITS+1),
      JSON.stringify({format:VERIFICATION_PROFILE_FORMAT,version:2,profiles:[]}),
      JSON.stringify({format:VERIFICATION_PROFILE_FORMAT,version:1,profiles:[],path:'/private'}),
      backup([{name:'A',rules:[rule()],path:'/private'}]),
      backup([{name:'A',rules:[{...rule(),execute:true}]}]),
      backup([{name:'A',rules:[{...rule(),options:{...rule().options,regex:true}}]}]),
      backup([{name:'A',rules:[{...rule(),expectation:'execute'}]}]),
      backup([{name:'A',rules:[{...rule(),options:{caseSensitive:'yes',wholeWord:false}}]}]),
      backup([{name:'A',rules:[rule('')]}]),
      backup([{name:'A',rules:[rule()]},{name:'a',rules:[rule()]}]),
      backup(Array.from({length:MAX_VERIFICATION_PROFILES+1},(_,i)=>({name:'P'+i,rules:[rule()]}))),
    ];
    for(const text of cases)expect(parseVerificationProfiles(text).ok,text.slice(0,120)).toBe(false);
  });
  it('classifies identical, conflicting and new entries without mutation',()=>{
    const saved=library();
    const text=backup([
      {name:'sample',rules:[rule()]},
      {name:'Other',rules:[rule('other')]},
    ]);
    const reviewed=value(reviewVerificationImport(saved,text));
    expect(reviewed.rows.map(item=>item.status)).toEqual(['identical','new']);
    expect(saved.profiles).toHaveLength(1);
    const conflict=value(reviewVerificationImport(saved,backup([{name:'SAMPLE',rules:[rule('changed')]}])));
    expect(conflict.rows[0].status).toBe('conflict');
    expect(confirmVerificationImport(saved,conflict,[0]).ok).toBe(false);
  });
  it('imports only selected new entries and preserves deterministic order',()=>{
    const saved=library();
    const reviewed=value(reviewVerificationImport(saved,backup([
      {name:'A',rules:[rule('a')]},
      {name:'B',rules:[rule('b')]},
      {name:'C',rules:[rule('c')]},
    ])));
    const imported=value(confirmVerificationImport(saved,reviewed,[2,0]));
    expect(imported.profiles.map(item=>item.name)).toEqual(['Sample','A','C']);
    expect(imported.profiles.map(item=>item.id)).toEqual([1,2,3]);
    expect(imported.revision).toBe(saved.revision+1);
    expect(saved.profiles).toHaveLength(1);
  });
  it('rejects duplicate, invalid and empty selections atomically',()=>{
    const saved=library();
    const review=value(reviewVerificationImport(saved,backup([{name:'New',rules:[rule()]}])));
    for(const selection of [[],[0,0],[-1],[1],[0.5],[NaN]]){
      expect(confirmVerificationImport(saved,review,selection).ok).toBe(false);
    }
    expect(saved.profiles).toHaveLength(1);
  });
  it('rechecks stale and modified import evidence',()=>{
    const saved=library();
    const review=value(reviewVerificationImport(saved,backup([{name:'New',rules:[rule()]}])));
    const newer=value(renameVerificationProfile(saved,1,'Changed'));
    expect(confirmVerificationImport(newer,review,[0]).ok).toBe(false);
    expect(confirmVerificationImport(saved,{...review,capacity:999},[0]).ok).toBe(false);
    expect(confirmVerificationImport(saved,{...review,text:backup([{name:'Changed',rules:[rule()]}])},[0]).ok).toBe(false);
    expect(confirmVerificationImport(saved,{...review,rows:[{...review.rows[0],rules:[rule('changed')]}]},[0]).ok).toBe(false);
  });
  it('enforces remaining capacity during confirmation',()=>{
    let saved=createVerificationProfileLibrary();
    for(let i=0;i<MAX_VERIFICATION_PROFILES-1;i++){
      saved=value(addVerificationProfile(saved,'P'+i,[rule()]));
    }
    const review=value(reviewVerificationImport(saved,backup([
      {name:'New A',rules:[rule()]},{name:'New B',rules:[rule()]},
    ])));
    expect(review.capacity).toBe(1);
    expect(confirmVerificationImport(saved,review,[0,1]).ok).toBe(false);
    expect(value(confirmVerificationImport(saved,review,[1])).profiles).toHaveLength(MAX_VERIFICATION_PROFILES);
  });
});
