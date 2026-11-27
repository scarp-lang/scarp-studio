import { useState,useMemo } from 'react';
import { FIXTURE_STREAMS,planFixtureCreation,fixtureSlot,MAX_FIXTURE_CREATE_BYTES,
  type FixtureInventory,type FixtureByteSummary,type FixtureCreatePlan,type FixtureCreateRequest,type FixtureResult,type FixtureStream } from '../model/testFixtures';
import type { FixtureCreationOutcome } from '../services/testFixtures';
interface Props{
  folder:string;
  generation:number;
  busy:boolean;
  onScan:()=>Promise<FixtureResult<FixtureInventory>>;
  onInspect:(test:string,stream:FixtureStream)=>Promise<FixtureResult<FixtureByteSummary>>;
  onCreate:(plan:FixtureCreatePlan)=>Promise<FixtureCreationOutcome>;
}
function Bytes({summary}:{summary:FixtureByteSummary}){
  return <div className="fixture-byte-review">
    <dl className="activity-metrics">
      <div><dt>Bytes</dt><dd>{summary.bytes}</dd></div><div><dt>UTF-8</dt><dd>{summary.utf8Valid?'Valid':'Invalid'}</dd></div>
      <div><dt>BOM</dt><dd>{summary.bom?'Present':'Absent'}</dd></div><div><dt>NUL bytes</dt><dd>{summary.nul}</dd></div>
      <div><dt>CRLF / LF / CR</dt><dd>{summary.crlf} / {summary.lf} / {summary.cr}</dd></div>
      <div><dt>Final ending</dt><dd>{summary.finalEnding}</dd></div>
    </dl>
    <strong>Escaped text {summary.textTruncated?'(prefix)':''}</strong>
    <pre>{summary.textPreview??'Invalid UTF-8; use byte preview.'}</pre>
    <strong>Hex bytes {summary.hexTruncated?'(prefix)':''}</strong><pre>{summary.hexPreview||'(empty fixture)'}</pre>
  </div>;
}
export function TestFixturesPanel({folder,generation,busy,onScan,onInspect,onCreate}:Props){
  const [expanded,setExpanded]=useState(false);
  const [inventory,setInventory]=useState<FixtureInventory|null>(null);
  const [test,setTest]=useState('');
  const [stream,setStream]=useState<FixtureStream>('stdin');
  const [summary,setSummary]=useState<FixtureByteSummary|null>(null);
  const [text,setText]=useState('');
  const [lineEnding,setLineEnding]=useState<FixtureCreateRequest['lineEnding']>('LF');
  const [finalNewline,setFinalNewline]=useState(false);
  const [review,setReview]=useState<FixtureCreatePlan|null>(null);
  const [confirmed,setConfirmed]=useState(false);
  const [notice,setNotice]=useState('');
  const [pending,setPending]=useState(false);
  const [prior,setPrior]=useState({folder,generation});
  if(prior.folder!==folder||prior.generation!==generation){
    setPrior({folder,generation});setInventory(null);setTest('');setSummary(null);setReview(null);setConfirmed(false);
  }
  const slot=inventory?fixtureSlot(inventory,test,stream):null;
  const plan=useMemo(()=>inventory&&slot?.status==='absent'?planFixtureCreation(inventory,{testName:test,stream,text,lineEnding,finalNewline}):null,
    [inventory,slot,test,stream,text,lineEnding,finalNewline]);
  const locked=busy||pending;
  function resetReview(){setSummary(null);setReview(null);setConfirmed(false);setNotice('');}
  async function scan(){
    if(locked)return;
    resetReview();setInventory(null);setPending(true);
    try{
      const result=await onScan();
      if(!result.ok){setNotice(result.error);return;}
      setInventory(result.value);setTest(result.value.tests[0]?.name??'');
      setNotice('Observed '+result.value.tests.length+' direct regular test source(s).');
    }catch(error){setNotice(String(error));}finally{setPending(false);}
  }
  async function inspect(){
    if(locked||slot?.status!=='regular')return;
    resetReview();setPending(true);
    try{const result=await onInspect(test,stream);if(result.ok)setSummary(result.value);else setNotice(result.error);}
    catch(error){setNotice(String(error));}finally{setPending(false);}
  }
  async function create(){
    if(locked||!review||!confirmed)return;
    setPending(true);
    try{
      const outcome=await onCreate(review);
      setNotice(outcome.message);setInventory(null);setReview(null);setConfirmed(false);
      if(outcome.status==='created')setText('');
    }catch(error){setNotice(String(error));setInventory(null);setReview(null);setConfirmed(false);}
    finally{setPending(false);}
  }
  return <section className="test-fixture-panel" aria-label="Project test fixtures">
    <button type="button" aria-expanded={expanded} onClick={()=>{setExpanded(value=>!value);resetReview();}}>
      {expanded?'Hide test fixtures':'Review project test fixtures'}</button>
    {expanded&&<>
      <p>Inspect direct tests/ companions. stdin supplies input; stdout and stderr compare exact bytes.
        Empty expected output is different from an absent file.</p>
      <button type="button" disabled={locked} onClick={()=>void scan()}>Scan direct tests and fixture siblings</button>
      {inventory&&<>
        <p>{inventory.tests.length} test(s) · {inventory.unpaired.length} unpaired fixture name(s).
          {inventory.ignoredUppercaseTests>0?' '+inventory.ignoredUppercaseTests+' uppercase/mixed suffix test name(s) are not discovered by the compiler.':''}</p>
        <div className="activity-filters">
          <select aria-label="Fixture test source" value={test} disabled={locked} onChange={event=>{setTest(event.target.value);resetReview();}}>
            {inventory.tests.map(item=><option key={item.name} value={item.name}>{item.name}</option>)}</select>
          <select aria-label="Fixture stream" value={stream} disabled={locked} onChange={event=>{setStream(event.target.value as FixtureStream);resetReview();}}>
            {FIXTURE_STREAMS.map(item=><option key={item} value={item}>{item}</option>)}</select>
        </div>
        {slot&&<p>{slot.name} · {slot.status}</p>}
        {slot?.status==='regular'&&<button type="button" disabled={locked} onClick={()=>void inspect()}>Inspect existing fixture bytes</button>}
        {(slot?.status==='ambiguous'||slot?.status==='unsafe')&&<p role="alert">This fixture cannot be read or created through Studio.</p>}
        {summary&&<Bytes summary={summary}/>}
        {slot?.status==='absent'&&<>
          <h4>Create absent fixture</h4>
          <p>Only exclusive creation is available. Existing files are never overwritten.
            Creation limit: {MAX_FIXTURE_CREATE_BYTES/1024} KiB of UTF-8 bytes.</p>
          <textarea aria-label="New fixture draft" rows={5} maxLength={MAX_FIXTURE_CREATE_BYTES} value={text} disabled={locked}
            onChange={event=>{setText(event.target.value);resetReview();}}/>
          <label>Line ending <select value={lineEnding} disabled={locked} onChange={event=>{setLineEnding(event.target.value as FixtureCreateRequest['lineEnding']);resetReview();}}>
            <option value="LF">LF</option><option value="CRLF">CRLF</option></select></label>
          <label><input type="checkbox" checked={finalNewline} disabled={locked} onChange={event=>{setFinalNewline(event.target.checked);resetReview();}}/>
            Append a final newline if not already present</label>
          {plan&&!plan.ok&&<p role="alert">{plan.error}</p>}
          <button type="button" disabled={locked||!plan?.ok} onClick={()=>{if(plan?.ok){setReview(plan.value);setConfirmed(false);}}}>Review new fixture bytes</button>
          {review&&<div className="transfer-review">
            <strong>Create tests/{review.name}</strong><Bytes summary={review.summary}/>
            {review.summary.textTruncated&&<details><summary>Full escaped text</summary><textarea readOnly rows={8} value={JSON.stringify(review.content)}/></details>}
            <label><input type="checkbox" checked={confirmed} disabled={locked} onChange={event=>setConfirmed(event.target.checked)}/>
              I reviewed the exact content and want to create this absent fixture.</label>
            <button type="button" disabled={locked||!confirmed} onClick={()=>void create()}>Create reviewed fixture exclusively</button>
            <button type="button" disabled={locked} onClick={resetReview}>Cancel creation review</button>
          </div>}
        </>}
        {inventory.unpaired.length>0&&<details><summary>Unpaired fixture names</summary>
          <ul>{inventory.unpaired.slice(0,64).map((name,index)=><li key={index}>{name}</li>)}</ul>
          {inventory.unpaired.length>64&&<p>{inventory.unpaired.length-64} additional labels omitted.</p>}
          <p>No deletion or automatic pairing is offered.</p></details>}
      </>}
      {pending&&<p role="status">Fixture operation in progress…</p>}
      {notice&&<p role="status">{notice}</p>}
    </>}
  </section>;
}
