import assert from 'node:assert/strict';
import {selectors as s,labeled,testId,assertPrivateReport} from './search-browser-driver.mjs';
import {freshLexical} from './search-browser-listed-symbols.mjs';

const panel=labeled('Listed project code references');
const review=labeled('Review listed code references');
const result=labeled('Listed code reference results');
const report=labeled('Listed code reference report');
const identifier=labeled('Listed code reference identifier');
const scope=panel+' '+labeled('Project search scope');
const entry='src/a-entry.srp';
const helper='src/b-helper.srp';
const leaf='src/c-leaf.srp';
const missing='src/d-unavailable.srp';
const test='tests/e-check.srp';
const caseFile='src/f-case.srp';

export async function openReferences(d,query='helper'){
  await d.button(panel,'Find listed code references');
  await d.change(identifier,query);
}

export async function prepareReferences(d){
  await d.button(panel,'Review listed code reference search');
  await d.visible(review);
}

export async function runReferences(d){
  await prepareReferences(d);
  await d.button(review,'Confirm listed code references');
  await d.visible(result);
  await d.contains(testId('busy'),'false');
}

function privateReport(value,extra=[]){
  assertPrivateReport(value,['fixture-private-function-body',...extra]);
}

export async function listedReferenceScenarios(d,step){
  await step('reference review rejects non-identifiers and accepts cursor identifier without scanning',async()=>{
    await freshLexical(d);
    await d.noReads(async()=>{
      await openReferences(d,'helper()');
      await d.button(panel,'Review listed code reference search');
      await d.visible(panel+' [role=alert]');
      await d.absent(review);
      await d.change(identifier,'helper');
      await prepareReferences(d);
      await d.contains(review,'Match case');
      await d.contains(review,'6 selected of 6 listed sources');
      await d.button(review,'Review reference source labels');
      await d.contains(review,helper);
      await d.contains(review,missing);
      assert.ok(!(await d.text(review)).includes('/fixture-private/'));
      await d.button(review,'Cancel reference review');
      await d.absent(review);
      await d.change(identifier,'other');
      await d.button(panel,'Use identifier at editor cursor');
      await d.valueIs(identifier,'helper');
      await d.absent(result);
    });
  });

  await step('lexical reference search counts only code tokens and reports unread sources',async()=>{
    await runReferences(d);
    await d.metric(result,'Selected sources',6);
    await d.metric(result,'Fully searched files',5);
    await d.metric(result,'Retained references',8);
    await d.contains(result,'Incomplete coverage');
    const reads=await d.readPaths();
    assert.equal(reads.length,5);
    assert.equal(new Set(reads).size,5);
    assert.ok(reads.every(value=>!value.endsWith('/'+helper)));
    assert.equal(await d.counter('search-count'),1);
    await d.noReads(async()=>{
      await d.change(labeled('Listed reference source'),test);
      await d.contains(result,'1 matching observations');
      await d.change(labeled('Listed reference role'),'call-like');
      await d.contains(result,'1 matching observations');
      await d.button(result,'Recheck and open reference');
      const target=JSON.parse(await d.text(testId('navigation')));
      assert.equal(target.name,test);
      assert.equal(target.kind,'reference');
      assert.equal(target.line,1);
      await d.change(labeled('Listed reference role'),'declaration-like');
      await d.contains(result,'0 matching observations');
      await d.button(result,'Reset reference filters');
    });
  });

  await step('reference role filters distinguish declaration, call, member, assignment, and type position',async()=>{
    await d.noReads(async()=>{
      for(const [role,count] of [
        ['declaration-like',1],
        ['call-like',4],
        ['qualified-call',1],
        ['qualified-member',0],
        ['assignment-like',1],
        ['type-position',1],
        ['other-identifier',0],
      ]){
        await d.change(labeled('Listed reference role'),role);
        await d.contains(result,count+' matching observations');
      }
      await d.change(labeled('Listed reference role'),'type-position');
      await d.contains(result,caseFile);
      await d.button(result,'Recheck and open reference');
      const location=JSON.parse(await d.text(testId('navigation')));
      assert.equal(location.name,caseFile);
      assert.equal(location.line,1);
      await d.button(result,'Reset reference filters');
      await d.change(labeled('Listed reference order'),'role');
      await d.contains(result,'8 matching observations');
      await d.change(labeled('Listed reference order'),'spelling');
      await d.contains(result,'8 matching observations');
    });
  });

  await step('reference file coverage separates read failure from scanned zero results',async()=>{
    await d.noReads(async()=>{
      await d.change(labeled('Listed reference view'),'files');
      await d.change(labeled('Listed reference coverage'),'read-failed');
      let rows=await d.rows(result+' table');
      assert.equal(rows.length,1);
      assert.equal(rows[0][0],missing);
      await d.change(labeled('Listed reference coverage'),'scanned');
      rows=await d.rows(result+' table');
      assert.equal(rows.length,5);
      assert.ok(rows.some(row=>row[0]===helper&&row.includes('Working buffer')));
      await d.change(labeled('Listed reference source'),entry);
      rows=await d.rows(result+' table');
      assert.equal(rows.length,1);
      assert.equal(rows[0][0],entry);
      await d.button(result,'Reset reference filters');
      await d.change(labeled('Listed reference view'),'sites');
    });
  });

  await step('reference report discloses identifier and source labels only with separate opt-ins',async()=>{
    await d.noReads(async()=>{
      await d.button(result,'Review listed reference report');
      privateReport(await d.value(report),['helper',entry,leaf,missing]);
      await d.check(result,'Include identifier and observed spellings');
      let text=await d.value(report);
      assert.ok(text.includes('helper'));
      privateReport(text,[entry,helper,leaf,missing]);
      await d.check(result,'Include identifier and observed spellings',false);
      await d.check(result,'Include relative source labels');
      text=await d.value(report);
      assert.ok(text.includes(helper));
      assert.ok(text.includes(missing));
      privateReport(text);
      await d.button(result,'Hide listed reference report');
      await d.absent(report);
      await d.button(result,'Review listed reference report');
      privateReport(await d.value(report),['helper',entry,leaf,missing]);
      await d.button(result,'Hide listed reference report');
    });
  });

  await step('case-insensitive code reference run retains exact lexical spelling groups',async()=>{
    await d.check(panel,'Match case for listed references',false);
    await runReferences(d);
    await d.metric(result,'Retained references',9);
    assert.equal(await d.counter('read-count'),10);
    await d.noReads(async()=>{
      await d.change(labeled('Listed reference spelling'),'Helper');
      await d.contains(result,'1 matching observations');
      await d.button(result,'Recheck and open reference');
      const target=JSON.parse(await d.text(testId('navigation')));
      assert.equal(target.name,caseFile);
      assert.equal(target.column,1);
      await d.change(labeled('Listed reference spelling'),'helper');
      await d.contains(result,'8 matching observations');
      await d.button(result,'Reset reference filters');
    });
  });

  await step('reference scan recovery increases coverage and reveals newly observed token',async()=>{
    await d.button(s.fixture,'Recover fixture read');
    await runReferences(d);
    await d.metric(result,'Fully searched files',6);
    await d.metric(result,'Retained references',10);
    await d.contains(result,'Complete for chosen listed scope');
    assert.equal(await d.counter('read-count'),15);
    await d.noReads(async()=>{
      await d.change(labeled('Listed reference source'),missing);
      await d.contains(result,'1 matching observations');
      await d.button(result,'Recheck and open reference');
      assert.equal(JSON.parse(await d.text(testId('navigation'))).name,missing);
    });
  });

  await step('zero reference count preserves incomplete-coverage uncertainty',async()=>{
    await freshLexical(d);
    await openReferences(d,'unseenIdentifier');
    await runReferences(d);
    await d.metric(result,'Retained references',0);
    await d.contains(result,'Zero retained references do not establish absence');
    await d.button(s.fixture,'Recover fixture read');
    await runReferences(d);
    await d.metric(result,'Retained references',0);
    await d.contains(result,'Complete for chosen listed scope');
    await d.noReads(async()=>{
      await d.button(result,'Review listed reference report');
      privateReport(await d.value(report),['unseenIdentifier',entry,helper]);
      await d.check(result,'Include identifier and observed spellings');
      assert.ok((await d.value(report)).includes('unseenIdentifier'));
    });
  });

  await step('restricted code reference scope uses current working buffer and saved disk independently',async()=>{
    await freshLexical(d);
    await openReferences(d,'leaf');
    await d.button(scope,'Configure project search scope');
    await d.change(scope+' '+labeled('Project filename substring'),'b-helper');
    await runReferences(d);
    await d.metric(result,'Selected sources',1);
    await d.metric(result,'Retained references',2);
    assert.equal(await d.counter('read-count'),0);
    await d.change(labeled('Listed reference snapshot mode'),'saved');
    await runReferences(d);
    await d.metric(result,'Retained references',1);
    assert.equal(await d.counter('read-count'),1);
    assert.ok((await d.readPaths())[0].endsWith('/'+helper));
  });

  await step('reference navigation refuses stale historical coordinates and removed labels',async()=>{
    await freshLexical(d);
    await openReferences(d);
    await runReferences(d);
    await d.noReads(async()=>{
      await d.change(labeled('Listed reference source'),helper);
      await d.button(result,'Recheck and open reference');
      assert.equal(JSON.parse(await d.text(testId('navigation'))).name,helper);
      await d.button(s.fixture,'Shift lexical source location');
      await d.button(result,'Recheck and open reference');
      assert.equal(await d.text(testId('navigation')),'');
      await d.change(labeled('Listed reference source'),entry);
      await d.button(s.fixture,'Remove lexical entry');
      await d.count(result+' button',await d.evaluate(selector=>document.querySelectorAll(selector+' button').length,result));
      const target=await d.evaluate(selector=>{
        const button=[...document.querySelectorAll(selector+' button')].find(node=>node.textContent==='Recheck and open reference');
        if(!button)throw new Error('Missing retained reference button');
        button.click();
        return true;
      },result);
      assert.equal(target,true);
      assert.equal(await d.text(testId('navigation')),'');
      await d.button(panel,'Dismiss listed reference results');
      await d.absent(result);
    });
  });

  await step('reference cancellation and stale scope review cannot publish a complete search',async()=>{
    await freshLexical(d);
    await openReferences(d);
    await prepareReferences(d);
    await d.check(s.fixture,'Pause first synthetic read');
    await d.button(review,'Confirm listed code references');
    await d.contains(testId('busy'),'true');
    await d.button(panel,'Cancel listed reference search');
    await d.buttonDisabled(panel,'Reference cancellation requested');
    await d.button(s.fixture,'Release synthetic read');
    await d.visible(result);
    await d.contains(result,'Reference search cancelled');
    await d.contains(result,'Incomplete coverage');
    assert.equal(await d.counter('read-count'),1);
    await freshLexical(d);
    await openReferences(d);
    await prepareReferences(d);
    await d.noReads(async()=>{
      await d.button(s.fixture,'Remove lexical entry');
      await d.button(review,'Confirm listed code references');
      await d.contains(panel+' [role=alert]','invalidated');
      await d.absent(result);
    });
  });
}
