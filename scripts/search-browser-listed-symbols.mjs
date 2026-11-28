import assert from 'node:assert/strict';
import {selectors as s,labeled,testId,assertPrivateReport} from './search-browser-driver.mjs';

const panel=labeled('Listed project symbols');
const review=labeled('Review listed symbol index');
const result=labeled('Listed symbol index results');
const report=labeled('Listed symbol inventory report');
const group=labeled('Listed symbol group details');
const topology=labeled('Listed call candidate topology');
const node=labeled('Selected call topology node');
const traversal=labeled('Call topology traversal');
const path=labeled('Observed call candidate path');
const cycles=labeled('Call candidate cycles');
const graphReport=labeled('Call topology report');
const interfaces=labeled('Captured function interfaces');
const comparison=labeled('Function interface comparison results');
const inventoryReport=labeled('Function interface inventory report');
const comparisonReport=labeled('Function interface comparison report');
const scope=panel+' '+labeled('Project search scope');
const entry='src/a-entry.srp';
const helper='src/b-helper.srp';
const leaf='src/c-leaf.srp';
const missing='src/d-unavailable.srp';
const test='tests/e-check.srp';
const caseFile='src/f-case.srp';
const privateBody='fixture-private-function-body';

export async function freshLexical(d){
  await d.button(s.fixture,'Use lexical fixture');
  await d.contains(testId('read-count'),'0');
  await d.contains(testId('search-count'),'0');
  await d.contains(testId('lexical-active-tab'),helper);
  await d.absent(result);
}

export async function openSymbolPanel(d){
  await d.button(panel,'Index listed project symbols');
  await d.visible(labeled('Listed symbol snapshot mode'));
}

export async function prepareSymbols(d){
  await d.button(panel,'Review listed symbol index');
  await d.visible(review);
}

export async function runSymbols(d){
  await prepareSymbols(d);
  await d.button(review,'Confirm listed symbol index');
  await d.visible(result);
  await d.contains(testId('busy'),'false');
}

function assertSymbolPrivacy(text,extras=[]){
  assertPrivateReport(text,[privateBody,...extras]);
}

async function selectOptionContaining(d,selector,needle){
  const value=await d.evaluate((selector,needle)=>{
    const element=document.querySelector(selector);
    const options=[...element.options].filter(option=>option.textContent.includes(needle));
    if(options.length!==1)throw new Error('Expected exactly one matching option: '+needle);
    return options[0].value;
  },selector,needle);
  await d.change(selector,value);
}

export async function listedSymbolScenarios(d,step){
  await step('symbol index requires explicit review, including optional interface capture',async()=>{
    await freshLexical(d);
    await d.noReads(async()=>{
      await openSymbolPanel(d);
      await prepareSymbols(d);
      await d.contains(review,'6 selected of 6 listed');
      await d.contains(review,'Do not capture function interface shapes');
      await d.button(review,'Review symbol source labels');
      await d.contains(review,helper);
      await d.contains(review,missing);
      assert.ok(!(await d.text(review)).includes('/fixture-private/'));
      await d.button(review,'Cancel symbol review');
      await d.absent(review);
      await d.check(panel,'Capture lexical function interface shapes');
      await prepareSymbols(d);
      await d.contains(review,'Capture canonical function interface tokens');
      await d.button(review,'Cancel symbol review');
      await d.check(panel,'Capture lexical function interface shapes',false);
      await d.absent(result);
    });
  });

  await step('working symbol index reads each closed selected source once',async()=>{
    await runSymbols(d);
    await d.metric(result,'Selected sources',6);
    await d.metric(result,'Fully indexed',5);
    await d.metric(result,'Declaration sites',8);
    await d.metric(result,'Call-like sites',11);
    await d.metric(result,'Repeated spellings',1);
    await d.contains(result,'Incomplete coverage');
    const reads=await d.readPaths();
    assert.equal(reads.length,5);
    assert.equal(new Set(reads).size,5);
    assert.ok(reads.every(value=>!value.endsWith('/'+helper)));
    assert.ok(reads.some(value=>value.endsWith('/'+missing)));
    assert.equal(await d.counter('search-count'),1);
  });

  await step('symbol site filters and current lexical navigation do not read sources',async()=>{
    await d.noReads(async()=>{
      await d.change(labeled('Listed symbol kind'),'function');
      await d.check(result,'Public declarations only');
      await d.contains(result,'3 matching observations');
      await d.change(labeled('Listed symbol source filter'),helper);
      await d.contains(result,'1 matching observations');
      await d.button(result,'Recheck and open symbol');
      const target=JSON.parse(await d.text(testId('navigation')));
      assert.equal(target.name,helper);
      assert.equal(target.line,1);
      assert.equal(target.column,12);
      assert.equal(target.kind,'symbol');
      await d.change(labeled('Listed symbol nesting'),'nested');
      await d.contains(result,'0 matching observations');
      await d.button(result,'Reset listed symbol filters');
      await d.change(labeled('Filter listed symbol observations'),'twin');
      await d.contains(result,'3 matching observations');
      await d.button(result,'Reset listed symbol filters');
    });
  });

  await step('symbol candidate group distinguishes a unique spelling from ambiguity and absence',async()=>{
    await d.noReads(async()=>{
      await d.change(labeled('Listed symbol view'),'calls');
      await d.change(labeled('Listed call candidate status'),'one-observed');
      await d.button(result,'helper');
      await d.visible(group);
      await d.contains(group,'5 retained sites');
      await d.contains(group,helper);
      await d.contains(group,entry);
      await d.contains(group,test);
      await d.button(group,'Close symbol group');
      await d.change(labeled('Listed call candidate status'),'multiple-observed');
      await d.contains(result,'1 matching observations');
      await d.button(result,'twin');
      await d.contains(group,'3 retained sites');
      await d.button(group,'Close symbol group');
      await d.change(labeled('Listed call candidate status'),'none-observed');
      await d.contains(result,'2 matching observations');
      await d.button(result,'missing');
      await d.contains(group,'1 retained sites');
      await d.button(group,'Close symbol group');
    });
  });

  await step('repeated declarations and unavailable coverage remain independent evidence',async()=>{
    await d.noReads(async()=>{
      await d.change(labeled('Listed symbol view'),'repeated');
      await d.button(result,'twin');
      await d.contains(group,'2 retained sites');
      await d.contains(group,entry);
      await d.contains(group,leaf);
      await d.button(group,'Close symbol group');
      await d.change(labeled('Listed symbol view'),'coverage');
      await d.change(labeled('Listed symbol coverage filter'),'read-failed');
      let rows=await d.rows(result+' table');
      assert.equal(rows.length,1);
      assert.equal(rows[0][0],missing);
      await d.change(labeled('Listed symbol coverage filter'),'scanned');
      rows=await d.rows(result+' table');
      assert.equal(rows.length,5);
      assert.ok(rows.some(row=>row[0]===helper&&row.includes('Working buffer')));
      await d.button(result,'Reset listed symbol filters');
    });
  });

  await step('symbol inventory reports redact names and labels independently',async()=>{
    await d.noReads(async()=>{
      await d.button(result,'Review listed symbol report');
      assertSymbolPrivacy(await d.value(report),[entry,helper,leaf,'helper','twin']);
      await d.check(result,'Include lexical symbol names');
      let text=await d.value(report);
      assert.ok(text.includes('helper'));
      assert.ok(text.includes('twin'));
      assertSymbolPrivacy(text,[entry,helper,leaf]);
      await d.check(result,'Include lexical symbol names',false);
      await d.check(result,'Include relative file labels');
      text=await d.value(report);
      assert.ok(text.includes(helper));
      assert.ok(text.includes(missing));
      assertSymbolPrivacy(text);
      await d.button(result,'Hide listed symbol report');
      await d.absent(report);
      await d.button(result,'Review listed symbol report');
      assertSymbolPrivacy(await d.value(report),[entry,helper,leaf,'helper','twin']);
      await d.button(result,'Hide listed symbol report');
    });
  });

  await step('candidate topology retains file contexts, unique edges, and ambiguity',async()=>{
    await d.noReads(async()=>{
      await d.button(topology,'Explore call candidate topology');
      await d.metric(topology,'Function nodes',6);
      await d.metric(topology,'Call-like sites',11);
      await d.metric(topology,'Unique candidate groups',6);
      await d.metric(topology,'Ambiguous groups',1);
      await d.metric(topology,'No observed candidate groups',2);
      await d.metric(topology,'Candidate-cycle components',2);
      await d.contains(topology,'not a compiler call graph');
      await d.change(labeled('Call topology node kind'),'file-context');
      await d.contains(topology,'2 nodes');
      await d.change(labeled('Call topology source'),caseFile);
      await d.contains(topology,'1 nodes');
      await d.button(topology,'Reset topology filters');
      await d.change(labeled('Filter call topology nodes'),'twin');
      await d.contains(topology,'2 nodes');
      await d.button(topology,'Reset topology filters');
    });
  });

  await step('bounded candidate traversal and shortest path use retained unique edges only',async()=>{
    await d.noReads(async()=>{
      await d.change(labeled('Filter call topology nodes'),'start');
      await d.button(topology,'Explore node start');
      await d.visible(node);
      await d.change(labeled('Call topology direction'),'outgoing');
      await d.change(labeled('Call topology depth'),'1');
      await d.contains(traversal,'Traversal limit reached');
      await selectOptionContaining(d,labeled('Call topology path destination'),'leaf · '+leaf);
      await d.button(node,'Find shortest observed candidate path');
      await d.contains(path,'Traversal limit reached; path unknown');
      await d.change(labeled('Call topology depth'),'3');
      await d.button(node,'Find shortest observed candidate path');
      await d.contains(path,'Observed candidate path only, 2 edges');
      const text=await d.text(path);
      assert.ok(text.includes('start'));
      assert.ok(text.includes('helper'));
      assert.ok(text.includes('leaf'));
      await d.change(labeled('Call topology direction'),'incoming');
      await d.contains(traversal,test);
      await d.button(topology,'Reset topology filters');
    });
  });

  await step('cycle evidence distinguishes a multi-node component and self candidate',async()=>{
    await d.noReads(async()=>{
      await d.button(topology,'Review candidate cycles');
      await d.visible(cycles);
      await d.button(cycles,'Candidate component · 2 nodes · 2 edges');
      await d.contains(cycles,helper);
      await d.contains(cycles,leaf);
      await d.button(cycles,'Self candidate · 1 nodes · 1 edges');
      await d.contains(cycles,'self');
      await d.button(topology,'Hide candidate cycles');
      await d.absent(cycles);
    });
  });

  await step('topology reports do not disclose lexical identifiers without consent',async()=>{
    await d.noReads(async()=>{
      await d.button(topology,'Review topology report');
      assertSymbolPrivacy(await d.value(graphReport),[entry,helper,leaf,'helper','twin']);
      await d.check(topology,'Include topology symbol names');
      assert.ok((await d.value(graphReport)).includes('helper'));
      assertSymbolPrivacy(await d.value(graphReport),[entry,helper,leaf]);
      await d.check(topology,'Include topology symbol names',false);
      await d.check(topology,'Include topology source labels');
      assert.ok((await d.value(graphReport)).includes(helper));
      assertSymbolPrivacy(await d.value(graphReport));
      await d.button(topology,'Hide call candidate topology');
      await d.absent(graphReport);
      await d.button(topology,'Explore call candidate topology');
      await d.button(topology,'Review topology report');
      assertSymbolPrivacy(await d.value(graphReport),[entry,helper,leaf,'helper','twin']);
    });
  });

  await step('symbol interface capture is opt-in and excludes bodies',async()=>{
    await freshLexical(d);
    await openSymbolPanel(d);
    await d.check(panel,'Capture lexical function interface shapes');
    await runSymbols(d);
    await d.button(interfaces,'Review function interfaces');
    await d.metric(interfaces,'Retained functions',6);
    await d.metric(interfaces,'Public modifiers',3);
    await d.metric(interfaces,'Captured shapes',6);
    await d.metric(interfaces,'Unavailable shapes',0);
    await d.contains(interfaces,'3 matching interfaces');
    await d.noReads(async()=>{
      await d.change(labeled('Function interface source'),helper);
      await d.contains(interfaces,'1 matching interfaces');
      await d.button(interfaces,'Recheck and open interface declaration');
      assert.equal(JSON.parse(await d.text(testId('navigation'))).name,helper);
      await d.button(interfaces,'Reset function interface filters');
      await d.button(interfaces,'Review function interface report');
      assertSymbolPrivacy(await d.value(inventoryReport),[entry,helper,leaf,'helper','twin','integer']);
      await d.check(interfaces,'Include full captured lexical shapes (contains function and type names)');
      const value=await d.value(inventoryReport);
      assert.ok(value.includes('integer'));
      assert.ok(value.includes('helper'));
      assertSymbolPrivacy(value,[entry,helper,leaf,'return x']);
      await d.button(interfaces,'Hide function interface report');
      await d.button(interfaces,'Capture function interface baseline');
      await d.contains(interfaces,'1 / 6 interface baselines saved');
      await d.visible(comparison);
    });
  });

  await step('interface comparison detects observed signature change despite unavailable unrelated source',async()=>{
    await d.button(s.fixture,'Change lexical function interface');
    await runSymbols(d);
    await d.visible(comparison);
    await d.metric(comparison,'Captured shape changed',1);
    await d.metric(comparison,'Same captured shape',5);
    await d.noReads(async()=>{
      await d.change(labeled('Interface change state'),'shape-changed');
      await d.button(comparison,'Review compared shapes');
      const shape=labeled('Compared interface shapes');
      await d.contains(shape,'integer');
      await d.contains(shape,'float');
      await d.button(comparison,'Review interface comparison report');
      assertSymbolPrivacy(await d.value(comparisonReport),[entry,helper,leaf,'helper','integer','float']);
      await d.check(comparison,'Include full captured lexical shapes (contains function and type names)');
      const value=await d.value(comparisonReport);
      assert.ok(value.includes('integer'));
      assert.ok(value.includes('float'));
      assertSymbolPrivacy(value,[entry,helper,leaf,'return x']);
      await d.button(interfaces,'Review clearing interface baselines');
      await d.button(interfaces,'Cancel clear interface baselines');
      await d.contains(interfaces,'1 / 6 interface baselines saved');
      await d.button(interfaces,'Review clearing interface baselines');
      await d.button(interfaces,'Confirm clear interface baselines');
      await d.contains(interfaces,'0 / 6 interface baselines saved');
      await d.absent(comparison);
    });
  });

  await step('symbol recheck rejects shifted historical coordinates without additional reads',async()=>{
    await freshLexical(d);
    await openSymbolPanel(d);
    await runSymbols(d);
    await d.noReads(async()=>{
      await d.change(labeled('Listed symbol kind'),'function');
      await d.change(labeled('Listed symbol source filter'),helper);
      await d.button(result,'Recheck and open symbol');
      assert.equal(JSON.parse(await d.text(testId('navigation'))).name,helper);
      await d.button(s.fixture,'Shift lexical source location');
      await d.button(result,'Recheck and open symbol');
      assert.equal(await d.text(testId('navigation')),'');
      await d.button(panel,'Dismiss listed symbol results');
      await d.absent(result);
    });
  });

  await step('symbol scope restricts reads and switches independently between working and saved modes',async()=>{
    await freshLexical(d);
    await openSymbolPanel(d);
    await d.button(scope,'Configure project search scope');
    await d.change(scope+' '+labeled('Project filename substring'),'b-helper');
    await runSymbols(d);
    await d.metric(result,'Selected sources',1);
    await d.metric(result,'Fully indexed',1);
    await d.metric(result,'Call-like sites',2);
    assert.equal(await d.counter('read-count'),0);
    await d.change(labeled('Listed symbol snapshot mode'),'saved');
    await runSymbols(d);
    await d.metric(result,'Call-like sites',1);
    assert.equal(await d.counter('read-count'),1);
    assert.ok((await d.readPaths())[0].endsWith('/'+helper));
  });

  await step('symbol cancellation retains incomplete coverage and stale review rejects changed membership',async()=>{
    await freshLexical(d);
    await openSymbolPanel(d);
    await prepareSymbols(d);
    await d.check(s.fixture,'Pause first synthetic read');
    await d.button(review,'Confirm listed symbol index');
    await d.contains(testId('busy'),'true');
    await d.button(panel,'Cancel listed symbol index');
    await d.buttonDisabled(panel,'Symbol cancellation requested');
    await d.button(s.fixture,'Release synthetic read');
    await d.visible(result);
    await d.contains(result,'Symbol index cancelled');
    await d.contains(result,'Incomplete coverage');
    assert.equal(await d.counter('read-count'),1);
    await freshLexical(d);
    await openSymbolPanel(d);
    await prepareSymbols(d);
    await d.noReads(async()=>{
      await d.button(s.fixture,'Remove lexical entry');
      await d.button(review,'Confirm listed symbol index');
      await d.contains(panel+' [role=alert]','invalidated');
      await d.absent(result);
    });
  });
}
