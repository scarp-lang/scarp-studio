import assert from 'node:assert/strict';
import { selectors as s, labeled, testId, assertPrivateReport } from './search-browser-driver.mjs';

const panel = labeled('Listed project verification');
const review = labeled('Review project verification');
const result = labeled('Project verification results');
const report = labeled('Project verification report');
const editor = labeled('Literal verification rules');
const profiles = labeled('Verification profiles');
const profileReview = labeled('Review verification profile change');
const importReview = labeled('Review verification profile import');
const history = labeled('Verification history comparison');
const comparison = labeled('Verification comparison results');
const comparisonReport = labeled('Verification comparison report');
const backup = labeled('Verification profile backup');
const importBox = labeled('Import verification profile backup');
const scope = panel + ' ' + labeled('Project search scope');
const dense = 'src/a-dense.srp';
const buffer = 'src/b-buffer.srp';
const missing = 'src/c-unavailable.srp';
const ruleName = 'Private required literal';
const forbiddenName = 'Private forbidden literal';
const absenceQuery = 'fixture-absent-literal';

function field(index, name) {
  return labeled('Verification rule ' + index + ' ' + name);
}

async function openVerification(d) {
  await d.button(panel, 'Verify literal project rules');
  await d.visible(editor);
}

async function configureRule(d, index, name, query, expectation) {
  await d.change(field(index, 'name'), name);
  await d.change(field(index, 'query'), query);
  await d.change(field(index, 'expectation'), expectation);
}

async function configureTwoRules(d) {
  await configureRule(d, 1, ruleName, 'needle', 'present');
  await d.button(editor, 'Add verification rule');
  await configureRule(d, 2, forbiddenName, absenceQuery, 'absent');
}

async function prepare(d) {
  await d.button(panel, 'Review project verification');
  await d.visible(review);
}

async function run(d) {
  await prepare(d);
  await d.button(review, 'Confirm and run verification');
  await d.visible(result);
  await d.contains(testId('busy'), 'false');
}

function assertVerificationPrivacy(text, names = [], labels = []) {
  assertPrivateReport(text, [...names, ...labels, absenceQuery]);
}

function newProfile(name, query = 'fixture-import-query') {
  return {
    name,
    rules: [{
      name: 'Imported rule',
      query,
      expectation: 'observe',
      options: {caseSensitive: true, wholeWord: false},
    }],
  };
}

async function saveProfile(d, name) {
  await d.change(labeled('Verification profile name'), name);
  await d.button(profiles, 'Save current verification rules');
  await d.contains(profiles, 'Saved verification profile.');
}

export async function verificationScenarios(d, step) {
  await step('verification reviews valid ordered rules and rejects incomplete drafts without reads', async () => {
    await d.reset();
    await d.noReads(async () => {
      await openVerification(d);
      await d.button(panel, 'Review project verification');
      await d.absent(review);
      await d.visible(panel + ' [role=alert]');
      await configureTwoRules(d);
      await d.button(editor, 'Move rule 2 earlier');
      await d.valueIs(field(1, 'name'), forbiddenName);
      await d.valueIs(field(2, 'name'), ruleName);
      await d.button(editor, 'Move rule 1 later');
      await d.valueIs(field(1, 'name'), ruleName);
      await prepare(d);
      await d.contains(review, '7 selected of 7 listed sources');
      await d.contains(review, ruleName);
      await d.contains(review, forbiddenName);
      await d.button(review, 'Review verification source labels');
      await d.contains(review, missing);
      assert.ok(!(await d.text(review)).includes('/fixture-private/'));
      await d.button(review, 'Cancel verification review');
      await d.absent(review);
      await d.absent(result);
    });
  });

  await step('two literal rules share each bounded read and retain asymmetric coverage evidence', async () => {
    await run(d);
    await d.metric(result, 'Expectations satisfied', 1);
    await d.metric(result, 'Inconclusive rules', 1);
    await d.metric(result, 'Expectations contradicted', 0);
    assert.equal(await d.counter('search-count'), 1);
    const reads = await d.readPaths();
    assert.equal(reads.length, 6);
    assert.equal(new Set(reads).size, reads.length);
    assert.ok(reads.every(path => !path.endsWith('/'+buffer)));
    await d.noReads(async () => {
      await d.button(result, forbiddenName);
      await d.contains(result, 'zero matches are not conclusive');
      await d.change(labeled('Verification file evidence filter'), 'incomplete');
      const rows = await d.rows(result + ' table');
      assert.equal(rows.length, 1);
      assert.equal(rows[0][0], missing);
      assert.equal(rows[0][1], 'Read unavailable');
      await d.change(labeled('Verification file evidence filter'), 'zero-scanned');
      assert.equal((await d.rows(result + ' table')).length, 6);
      await d.button(result, ruleName);
      await d.change(labeled('Verification file evidence filter'), 'matches');
      const found = await d.rows(result + ' table');
      assert.ok(found.some(row => row[0]===buffer && row[2]==='Working buffer' && row[3]==='2'));
    });
  });

  await step('verification exports redact queries and opt in separately to names and labels', async () => {
    await d.noReads(async () => {
      await d.button(result, 'Review verification report');
      assertVerificationPrivacy(await d.value(report), [ruleName, forbiddenName], [dense, missing]);
      await d.check(result, 'Include rule names in verification report');
      await d.wait('verification names disclosed', selector=>document.querySelector(selector)?.value.includes('Private required literal'),report);
      assertVerificationPrivacy(await d.value(report), [], [dense, missing]);
      await d.check(result, 'Include rule names in verification report', false);
      await d.check(result, 'Include source labels in verification report');
      await d.wait('verification labels disclosed', selector=>document.querySelector(selector)?.value.includes('src/a-dense.srp'),report);
      assertVerificationPrivacy(await d.value(report), [ruleName, forbiddenName]);
      await d.button(history, 'Compare verification runs');
      await d.button(history, 'Capture verification baseline');
      await d.contains(history, '1 / 8 verification baselines saved');
      await d.visible(comparison);
      await d.metric(comparison, 'Changed expectation statuses', 0);
    });
  });

  await step('verification comparison separates recovered coverage from observed count changes', async () => {
    await d.button(s.fixture, 'Edit fixture buffer');
    await d.button(s.fixture, 'Recover fixture read');
    await run(d);
    await d.metric(result, 'Expectations satisfied', 2);
    await d.metric(result, 'Inconclusive rules', 0);
    await d.metric(comparison, 'Changed expectation statuses', 1);
    await d.metric(comparison, 'Rules with incomplete coverage', 2);
    assert.equal(await d.counter('read-count'), 12);
    await d.noReads(async () => {
      await d.button(comparison, ruleName);
      await d.contains(comparison, '6 comparable labels · count change +1');
      await d.change(labeled('Verification comparison filter'), 'changed');
      const changed=await d.rows(comparison+' table');
      assert.equal(changed.length,1);
      assert.equal(changed[0][0],buffer);
      assert.equal(changed[0][3],'+1');
      await d.change(labeled('Verification comparison filter'), 'uncertain');
      const unknown=await d.rows(comparison+' table');
      assert.equal(unknown.length,1);
      assert.equal(unknown[0][0],missing);
      assert.equal(unknown[0][3],'Not comparable');
      await d.button(comparison, 'Review verification comparison report');
      assertVerificationPrivacy(await d.value(comparisonReport),[ruleName,forbiddenName],[buffer,missing]);
      await d.check(comparison,'Include source labels in comparison report');
      await d.wait('comparison labels disclosed',selector=>document.querySelector(selector)?.value.includes('src/b-buffer.srp'),comparisonReport);
      assertVerificationPrivacy(await d.value(comparisonReport),[ruleName,forbiddenName]);
    });
  });

  await step('changed verification settings block baseline comparisons and clearing preserves results', async () => {
    await d.change(field(1,'query'),'different literal');
    await run(d);
    await d.contains(history+' [role=alert]','exactly the same ordered rule');
    await d.absent(comparison);
    await d.noReads(async () => {
      await d.button(history,'Review clearing verification baselines');
      await d.button(history,'Cancel clearing verification baselines');
      await d.contains(history,'1 / 8 verification baselines saved');
      await d.button(history,'Review clearing verification baselines');
      await d.button(history,'Confirm clear verification baselines');
      await d.contains(history,'0 / 8 verification baselines saved');
      await d.visible(result);
    });
  });

  await step('verification profile application requires review and never runs a source scan', async () => {
    await d.reset();
    await d.noReads(async () => {
      await openVerification(d);
      await configureTwoRules(d);
      await d.button(profiles,'Manage verification profiles');
      await saveProfile(d,'Portable checks');
      await d.absent(backup);
      await d.change(field(1,'query'),'changed draft');
      await d.button(profiles,'Review applying profile');
      await d.visible(profileReview);
      await d.contains(profileReview,'changed draft');
      await d.contains(profileReview,'needle');
      await d.change(field(1,'query'),'changed again');
      await d.button(profileReview,'Confirm verification profile change');
      await d.contains(profiles+' [role=alert]','changed');
      await d.valueIs(field(1,'query'),'changed again');
      await d.button(profiles,'Review applying profile');
      await d.button(profileReview,'Confirm verification profile change');
      await d.valueIs(field(1,'query'),'needle');
      await d.valueIs(field(2,'query'),absenceQuery);
      await d.absent(review);
      await d.absent(result);
      await d.contains(profiles,'No source read or verification run');
    });
  });

  await step('profile backup disclosure is explicit and import merges only selected new entries', async () => {
    await d.noReads(async () => {
      await d.check(profiles,'Reveal private verification backup including literal queries');
      const exported=JSON.parse(await d.value(backup));
      assert.equal(exported.format,'scarp-studio.verification-profiles');
      assert.equal(exported.version,1);
      assert.equal(exported.profiles[0].rules[0].query,'needle');
      assert.ok(!JSON.stringify(exported).includes('/fixture-private/'));
      await d.check(profiles,'Reveal private verification backup including literal queries',false);
      await d.absent(backup);
      const incoming={...exported,profiles:[
        exported.profiles[0],newProfile('New profile'),newProfile('Skipped profile'),
      ]};
      await d.change(importBox,JSON.stringify(incoming));
      await d.button(profiles,'Review verification profile import');
      await d.contains(importReview,'Portable checks · identical');
      await d.contains(importReview,'New profile · new');
      await d.buttonDisabled(importReview,'Import selected verification profiles');
      await d.button(importReview,'Review imported rules for New profile');
      await d.contains(importReview,'fixture-import-query');
      await d.check(importReview,'New profile · new');
      await d.button(importReview,'Import selected verification profiles');
      await d.contains(profiles,'2 / 12 profiles saved');
      await d.check(profiles,'Reveal private verification backup including literal queries');
      const updated=JSON.parse(await d.value(backup));
      assert.deepEqual(updated.profiles.map(item=>item.name),['Portable checks','New profile']);
      await d.change(importBox,JSON.stringify({...exported,profiles:[newProfile('Portable checks')]}));
      await d.button(profiles,'Review verification profile import');
      await d.contains(importReview,'Portable checks · conflict');
      await d.buttonDisabled(importReview,'Import selected verification profiles');
      await d.button(importReview,'Cancel profile import');
      await d.change(importBox,JSON.stringify({...exported,path:'/private'}));
      await d.button(profiles,'Review verification profile import');
      await d.contains(profiles+' [role=alert]','Unsupported');
      await d.absent(importReview);
    });
  });

  await step('profile replacement and rename are explicit and clear does not mutate current rules', async () => {
    await d.noReads(async () => {
      await d.change(labeled('Saved verification profile'),'1');
      await d.change(field(1,'query'),'new private query');
      await d.button(profiles,'Review replacing profile');
      await d.button(profileReview,'Confirm verification profile change');
      await d.change(labeled('Verification profile name'),'Renamed checks');
      await d.button(profiles,'Rename verification profile');
      const updated=JSON.parse(await d.value(backup));
      assert.equal(updated.profiles[0].name,'Renamed checks');
      assert.equal(updated.profiles[0].rules[0].query,'new private query');
      await d.button(profiles,'Review clearing verification profiles');
      await d.button(profiles,'Cancel clearing profiles');
      await d.contains(profiles,'2 / 12 profiles saved');
      await d.button(profiles,'Review clearing verification profiles');
      await d.button(profiles,'Confirm clear verification profiles');
      await d.contains(profiles,'0 / 12 profiles saved');
      await d.valueIs(field(1,'query'),'new private query');
    });
  });

  await step('verification restricted scope uses working buffer and never reads unrelated disk files', async () => {
    await d.reset();
    await openVerification(d);
    await configureRule(d,1,ruleName,'needle','present');
    await d.button(scope,'Configure project search scope');
    await d.change(scope+' '+labeled('Project filename substring'),'b-buffer');
    await run(d);
    await d.contains(result,'1 rules over 1 selected sources');
    await d.metric(result,'Expectations satisfied',1);
    assert.equal(await d.counter('read-count'),0);
    await d.change(labeled('Verification snapshot mode'),'saved');
    await run(d);
    assert.equal(await d.counter('read-count'),1);
    const rows=await d.rows(result+' table');
    assert.equal(rows[0][0],buffer);
    assert.equal(rows[0][2],'Disk read');
    assert.equal(rows[0][3],'1');
  });

  await step('verification cancellation cannot turn unobserved absence into success', async () => {
    await d.reset();
    await openVerification(d);
    await configureRule(d,1,forbiddenName,absenceQuery,'absent');
    await prepare(d);
    await d.check(s.fixture,'Pause first synthetic read');
    await d.button(review,'Confirm and run verification');
    await d.contains(testId('busy'),'true');
    await d.button(panel,'Cancel project verification');
    await d.buttonDisabled(panel,'Verification cancellation requested');
    await d.button(s.fixture,'Release synthetic read');
    await d.visible(result);
    await d.contains(result,'Verification cancelled');
    await d.metric(result,'Inconclusive rules',1);
    await d.metric(result,'Expectations satisfied',0);
    assert.equal(await d.counter('read-count'),1);
  });

  await step('verification scope changes invalidate stale reviewed plans before reads', async () => {
    await d.reset();
    await openVerification(d);
    await configureRule(d,1,ruleName,'needle','present');
    await prepare(d);
    await d.noReads(async () => {
      await d.button(s.fixture,'Add fixture source');
      await d.button(review,'Confirm and run verification');
      await d.contains(panel+' [role=alert]','invalidated');
      await d.absent(result);
    });
  });
}
