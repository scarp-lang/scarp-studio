import assert from 'node:assert/strict';
import {selectors as s,labeled,testId} from './search-browser-driver.mjs';
import {freshLexical,openSymbolPanel,runSymbols} from './search-browser-listed-symbols.mjs';
import {openReferences,runReferences} from './search-browser-listed-references.mjs';

const symbol=labeled('Listed project symbols');
const reference=labeled('Listed project code references');
const symbolOpen=symbol+' '+labeled('Open observed source files');
const referenceOpen=reference+' '+labeled('Open observed source files');
const entry='src/a-entry.srp';
const helper='src/b-helper.srp';
const leaf='src/c-leaf.srp';
const missing='src/d-unavailable.srp';
const caseFile='src/f-case.srp';
const checkFile='tests/e-check.srp';

function review(panel){
  return panel+' '+labeled('Confirm opening observed sources');
}

function field(panel,name){
  return panel+' '+labeled(name);
}

async function tabs(d){
  return JSON.parse(await d.text(testId('lexical-open-tabs')));
}

async function assertInitialTab(d){
  assert.deepEqual(await tabs(d),[{name:helper,dirty:true}]);
  assert.equal(await d.text(testId('lexical-active-tab')),helper);
}

async function openSelector(d,panel){
  await d.button(panel,'Review opening observed source files');
  await d.visible(field(panel,'Filter observed source open labels'));
}

async function selectAndReview(d,panel,labels,active=null){
  for(const label of labels)await d.check(panel,label);
  if(active!==null)await d.change(field(panel,'Active observed source after opening'),active);
  await d.button(panel,'Review selected source open');
  await d.visible(review(panel));
}

async function confirm(d,panel){
  await d.button(review(panel),'Confirm opening observed sources');
  await d.contains(testId('busy'),'false');
}

export async function analysisOpenScenarios(d,step){
  await step('source-set review exposes only current labels, existing dirty tabs, and read counts',async()=>{
    await freshLexical(d);
    await openSymbolPanel(d);
    await runSymbols(d);
    await assertInitialTab(d);
    await d.noReads(async()=>{
      await openSelector(d,symbolOpen);
      await d.contains(symbolOpen,'5 observed labels');
      await d.contains(symbolOpen,'Already open');
      await d.contains(symbolOpen,'modified tab preserved');
      await d.buttonDisabled(symbolOpen,'Review selected source open');
      await d.change(field(symbolOpen,'Observed source open state'),'open');
      await d.contains(symbolOpen,helper);
      await d.change(field(symbolOpen,'Observed source open state'),'available');
      await d.contains(symbolOpen,entry);
      await d.change(field(symbolOpen,'Observed source open state'),'all');
      await selectAndReview(d,symbolOpen,[helper,leaf],leaf);
      await d.contains(review(symbolOpen),'1 new reads · 1 existing tabs reused');
      await d.contains(review(symbolOpen),'preserve unsaved changes');
      await d.contains(review(symbolOpen),'Activate '+leaf);
      assert.ok(!(await d.text(review(symbolOpen))).includes('/fixture-private/'));
      await d.button(review(symbolOpen),'Cancel observed source review');
      await d.absent(review(symbolOpen));
      await assertInitialTab(d);
      await d.button(symbolOpen,'Review selected source open');
      await d.visible(review(symbolOpen));
    });
  });

  await step('reviewed source-set commit opens the closed source and preserves existing dirty text',async()=>{
    const searches=await d.counter('search-count');
    const before=await d.counter('read-count');
    await confirm(d,symbolOpen);
    await d.contains(symbolOpen,'Opened 1 new source(s); preserved 1 existing tab(s)');
    assert.deepEqual(await tabs(d),[
      {name:helper,dirty:true},
      {name:leaf,dirty:false},
    ]);
    assert.equal(await d.text(testId('lexical-active-tab')),leaf);
    assert.equal(await d.counter('read-count'),before+1);
    assert.equal(await d.counter('search-count'),searches);
    assert.ok((await d.readPaths()).at(-1).endsWith('/'+leaf));
    await d.noReads(async()=>{
      await d.change(field(symbolOpen,'Observed source open state'),'open');
      await d.contains(symbolOpen,'Already open');
      await selectAndReview(d,symbolOpen,[helper,leaf],helper);
      await d.contains(review(symbolOpen),'0 new reads · 2 existing tabs reused');
      await confirm(d,symbolOpen);
      await d.contains(symbolOpen,'Opened 0 new source(s); preserved 2 existing tab(s)');
      assert.equal(await d.text(testId('lexical-active-tab')),helper);
      assert.deepEqual(await tabs(d),[
        {name:helper,dirty:true},
        {name:leaf,dirty:false},
      ]);
    });
  });

  await step('atomic source opening rolls back all staged reads if a later source fails',async()=>{
    await freshLexical(d);
    await openSymbolPanel(d);
    await runSymbols(d);
    await openSelector(d,symbolOpen);
    await d.button(s.fixture,'Fail lexical leaf read');
    await d.noReads(async()=>{
      await selectAndReview(d,symbolOpen,[entry,leaf],leaf);
      await d.contains(review(symbolOpen),'2 new reads · 0 existing tabs reused');
      await assertInitialTab(d);
    });
    const before=await d.counter('read-count');
    await confirm(d,symbolOpen);
    await d.contains(symbolOpen+' [role=alert]','No files were opened');
    assert.equal(await d.counter('read-count'),before+2);
    const reads=(await d.readPaths()).slice(-2);
    assert.ok(reads[0].endsWith('/'+entry));
    assert.ok(reads[1].endsWith('/'+leaf));
    await assertInitialTab(d);
    assert.ok(!(await d.text(symbolOpen+' [role=alert]')).includes('/fixture-private/'));
  });

  await step('source open cancellation discards the staged batch instead of opening a subset',async()=>{
    await freshLexical(d);
    await openSymbolPanel(d);
    await runSymbols(d);
    await openSelector(d,symbolOpen);
    await selectAndReview(d,symbolOpen,[entry,leaf],leaf);
    await d.check(s.fixture,'Pause first synthetic read');
    const before=await d.counter('read-count');
    await d.button(review(symbolOpen),'Confirm opening observed sources');
    await d.contains(testId('busy'),'true');
    await d.button(symbolOpen,'Cancel opening observed sources');
    await d.buttonDisabled(symbolOpen,'Source open cancellation requested');
    await d.button(s.fixture,'Release synthetic read');
    await d.contains(testId('busy'),'false');
    await d.contains(symbolOpen+' [role=alert]','No files opened');
    assert.equal(await d.counter('read-count'),before+1);
    await assertInitialTab(d);
  });

  await step('changed editor generation retires a source-open review before any native read',async()=>{
    await freshLexical(d);
    await openSymbolPanel(d);
    await runSymbols(d);
    await openSelector(d,symbolOpen);
    await d.noReads(async()=>{
      await selectAndReview(d,symbolOpen,[entry],entry);
      await d.button(s.fixture,'Shift lexical source location');
      await d.contains(review(symbolOpen),'Editor changed since review');
      await d.buttonDisabled(review(symbolOpen),'Confirm opening observed sources');
      await d.button(review(symbolOpen),'Cancel observed source review');
      await d.button(symbolOpen,'Review selected source open');
      await d.visible(review(symbolOpen));
      await d.button(s.fixture,'Remove lexical entry');
      await d.buttonDisabled(review(symbolOpen),'Confirm opening observed sources');
      await d.button(review(symbolOpen),'Cancel observed source review');
      await d.button(symbolOpen,'Review selected source open');
      await d.contains(symbolOpen+' [role=alert]','missing or ambiguous');
      await d.absent(review(symbolOpen));
      await assertInitialTab(d);
    });
  });

  await step('reference result source-set opening uses only observed labels and explicit selection',async()=>{
    await freshLexical(d);
    await openReferences(d);
    await runReferences(d);
    await openSelector(d,referenceOpen);
    await d.noReads(async()=>{
      await d.contains(referenceOpen,'5 observed labels');
      assert.ok(!(await d.text(referenceOpen)).includes(missing));
      await d.change(field(referenceOpen,'Filter observed source open labels'),'e-check');
      await d.contains(referenceOpen,checkFile);
      await d.button(referenceOpen,'Select available labels on this page');
      await d.contains(referenceOpen,'1 selected');
      await d.change(field(referenceOpen,'Filter observed source open labels'),'f-case');
      await d.check(referenceOpen,caseFile);
      await d.contains(referenceOpen,'2 selected');
      await d.change(field(referenceOpen,'Active observed source after opening'),checkFile);
      await d.button(referenceOpen,'Review selected source open');
      await d.contains(review(referenceOpen),'2 new reads · 0 existing tabs reused');
      await d.contains(review(referenceOpen),checkFile);
      await d.contains(review(referenceOpen),caseFile);
      assert.ok(!(await d.text(review(referenceOpen))).includes(helper));
    });
    const before=await d.counter('read-count');
    await confirm(d,referenceOpen);
    await d.contains(referenceOpen,'Opened 2 new source(s); preserved 0 existing tab(s)');
    assert.deepEqual(await tabs(d),[
      {name:helper,dirty:true},
      {name:checkFile,dirty:false},
      {name:caseFile,dirty:false},
    ]);
    assert.equal(await d.text(testId('lexical-active-tab')),checkFile);
    assert.equal(await d.counter('read-count'),before+2);
    const reads=(await d.readPaths()).slice(-2);
    assert.ok(reads[0].endsWith('/'+checkFile));
    assert.ok(reads[1].endsWith('/'+caseFile));
  });

  await step('source selection filters do not change retained choice or silently commit a review',async()=>{
    await d.noReads(async()=>{
      await d.change(field(referenceOpen,'Filter observed source open labels'),'e-check');
      await d.check(referenceOpen,checkFile);
      await d.change(field(referenceOpen,'Filter observed source open labels'),'f-case');
      await d.check(referenceOpen,caseFile);
      await d.button(referenceOpen,'Review selected source open');
      await d.contains(review(referenceOpen),'0 new reads · 2 existing tabs reused');
      await d.change(field(referenceOpen,'Active observed source after opening'),caseFile);
      await d.absent(review(referenceOpen));
      await d.button(referenceOpen,'Clear selected source labels');
      await d.buttonDisabled(referenceOpen,'Review selected source open');
      await d.valueIs(field(referenceOpen,'Active observed source after opening'),'');
      await d.button(referenceOpen,'Hide observed source opener');
      await d.absent(field(referenceOpen,'Filter observed source open labels'));
      assert.equal(await d.text(testId('lexical-active-tab')),checkFile);
      assert.equal((await tabs(d)).length,3);
    });
  });
}
