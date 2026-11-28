import {describe,expect,it,vi} from 'vitest';
import {prepareManifestLedger,startManifestLedger,confirmManifestLedger,prepareLedgerBatch,recordManifestLedgerBatch,
  summarizeManifestLedger,ledgerDigestGroups,filterLedgerRows,manifestLedgerText,DEFAULT_LEDGER_FILTER} from './manifestBatchLedger';
import {executeSourceManifest} from './projectSourceManifest';
import {DEFAULT_PROJECT_SEARCH_SCOPE,PROJECT_SEARCH_BATCH_SIZE} from './projectSearchScope';

const control={isCurrent:()=>true,isCancelled:()=>false};
const entries=Array.from({length:PROJECT_SEARCH_BATCH_SIZE*2+1},(_,index)=>({
  name:'src/file-'+String(index).padStart(3,'0')+'.srp',path:'C:/private-project/src/file-'+String(index).padStart(3,'0')+'.srp',
}));
function unwrap<T>(result:{ok:true;value:T}|{ok:false;error:string}):T{
  if(!result.ok)throw Error(result.error);return result.value;
}
const setup=()=>startManifestLedger(unwrap(prepareManifestLedger(entries,DEFAULT_PROJECT_SEARCH_SCOPE,'saved',false)));
async function scan(ledger:ReturnType<typeof setup>,batch:number,reader: (path:string)=>Promise<string>=async()=> 'print(1);'){
  const plan=unwrap(prepareLedgerBatch(ledger,batch,entries,DEFAULT_PROJECT_SEARCH_SCOPE,'saved',false));
  const result=await executeSourceManifest(plan,[],reader,control);
  if(result.kind!=='report')throw Error('Expected manifest report');
  return result.report;
}
describe('manifest batch ledger',()=>{
  it('plans identical numbered windows without disk reads and detects stale membership',()=>{
    const ledger=setup();
    expect(ledger.plan.batches.map(batch=>batch.labels.length)).toEqual([PROJECT_SEARCH_BATCH_SIZE,PROJECT_SEARCH_BATCH_SIZE,1]);
    expect(ledger.plan.sources.map(source=>source.name)).toEqual(entries.map(source=>source.name));
    expect(confirmManifestLedger(ledger.plan,[...entries].reverse(),DEFAULT_PROJECT_SEARCH_SCOPE,'saved',false).ok).toBe(true);
    expect(confirmManifestLedger(ledger.plan,entries.slice(1),DEFAULT_PROJECT_SEARCH_SCOPE,'saved',false).ok).toBe(false);
    expect(confirmManifestLedger(ledger.plan,entries.map((source,i)=>i===0?{...source,path:'D:/other.srp'}:source),DEFAULT_PROJECT_SEARCH_SCOPE,'saved',false).ok).toBe(false);
    expect(confirmManifestLedger(ledger.plan,entries,DEFAULT_PROJECT_SEARCH_SCOPE,'working',false).ok).toBe(false);
    expect(confirmManifestLedger(ledger.plan,entries,DEFAULT_PROJECT_SEARCH_SCOPE,'saved',true).ok).toBe(false);
    expect(prepareLedgerBatch(ledger,0,entries,DEFAULT_PROJECT_SEARCH_SCOPE,'saved',false).ok).toBe(false);
  });
  it('tracks missing windows and exact hashed coverage without an atomic snapshot claim',async()=>{
    let ledger=setup();
    let summary=summarizeManifestLedger(ledger);
    expect(summary.pending).toBe(entries.length);
    expect(summary.fullListedCoverage).toBe(false);
    const reader=vi.fn(async()=> 'print(1);');
    ledger=unwrap(recordManifestLedgerBatch(ledger,await scan(ledger,2,reader),false));
    expect(reader).toHaveBeenCalledTimes(PROJECT_SEARCH_BATCH_SIZE);
    summary=summarizeManifestLedger(ledger);
    expect(summary.hashed).toBe(PROJECT_SEARCH_BATCH_SIZE);
    expect(summary.recorded).toBe(1);
    expect(summary.finished).toBe(1);
    expect(summary.pending).toBe(entries.length-PROJECT_SEARCH_BATCH_SIZE);
    for(const batch of [1,3])ledger=unwrap(recordManifestLedgerBatch(ledger,await scan(ledger,batch),false));
    summary=summarizeManifestLedger(ledger);
    expect(summary.fullListedCoverage).toBe(true);
    expect(summary.allSelectedHashed).toBe(true);
    expect(summary.pending).toBe(0);
    expect(ledgerDigestGroups(summary)[0].batches).toBe(3);
    expect(ledgerDigestGroups(summary)[0].rows).toHaveLength(entries.length);
    expect(manifestLedgerText(ledger)).toContain('NOT an atomic project snapshot');
  });
  it('replaces only a confirmed receipt and preserves other observed windows',async()=>{
    let ledger=setup();
    ledger=unwrap(recordManifestLedgerBatch(ledger,await scan(ledger,1),false));
    ledger=unwrap(recordManifestLedgerBatch(ledger,await scan(ledger,2),false));
    const other=ledger.receipts[1];
    const next=await scan(ledger,1,async()=>{throw Error('private disk error');});
    expect(recordManifestLedgerBatch(ledger,next,false).ok).toBe(false);
    ledger=unwrap(recordManifestLedgerBatch(ledger,next,true));
    expect(ledger.receipts[1]).toBe(other);
    const summary=summarizeManifestLedger(ledger);
    expect(summary.unavailable).toBe(PROJECT_SEARCH_BATCH_SIZE);
    expect(summary.finished).toBe(1);
    expect(summary.hashed).toBe(PROJECT_SEARCH_BATCH_SIZE);
    expect(ledger.receipts[0].sequence).toBe(3);
    expect(manifestLedgerText(ledger,true,true)).not.toContain('private disk error');
  });
  it('rejects forged batch, duplicate labels, changed settings and inconsistent byte counts',async()=>{
    const ledger=setup(),report=await scan(ledger,1);
    expect(recordManifestLedgerBatch(ledger,{...report,listed:999},false).ok).toBe(false);
    expect(recordManifestLedgerBatch(ledger,{...report,settings:{...report.settings,mode:'working'}},false).ok).toBe(false);
    expect(recordManifestLedgerBatch(ledger,{...report,files:report.files.map(()=>report.files[0])},false).ok).toBe(false);
    expect(recordManifestLedgerBatch(ledger,{...report,settings:{...report.settings,scope:{...report.settings.scope,batch:2}}},false).ok).toBe(false);
    expect(recordManifestLedgerBatch(ledger,{...report,bytes:report.bytes+1},false).ok).toBe(false);
  });
  it('keeps report labels and digests independent and excludes native paths',async()=>{
    let ledger=setup();
    ledger=unwrap(recordManifestLedgerBatch(ledger,await scan(ledger,1),false));
    const hash=ledger.receipts[0].files[0].digest!;
    expect(manifestLedgerText(ledger)).not.toContain(entries[0].name);
    expect(manifestLedgerText(ledger)).not.toContain(hash);
    expect(manifestLedgerText(ledger,true,false)).toContain(entries[0].name);
    expect(manifestLedgerText(ledger,true,false)).not.toContain(hash);
    expect(manifestLedgerText(ledger,false,true)).toContain(hash);
    expect(manifestLedgerText(ledger,false,true)).not.toContain(entries[0].name);
    expect(manifestLedgerText(ledger,true,true)).not.toContain('C:/private-project');
    const summary=summarizeManifestLedger(ledger);
    expect(filterLedgerRows(summary,{...DEFAULT_LEDGER_FILTER,state:'pending'})).toHaveLength(entries.length-PROJECT_SEARCH_BATCH_SIZE);
    expect(filterLedgerRows(summary,{...DEFAULT_LEDGER_FILTER,batch:1,duplicatesOnly:true})).toHaveLength(PROJECT_SEARCH_BATCH_SIZE);
    expect(filterLedgerRows(summary,{...DEFAULT_LEDGER_FILTER,query:'file-000'})).toHaveLength(1);
  });
});
