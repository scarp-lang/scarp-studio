import assert from 'node:assert/strict';
import { selectors as s, labeled, testId, assertPrivateReport } from './search-browser-driver.mjs';

const inspection = labeled('Listed project source inspection');
const review = labeled('Review listed source inspection');
const results = labeled('Listed source inspection results');
const baseline = labeled('Listed inspection baseline library');
const comparison = labeled('Source inspection comparison details');
const report = labeled('Listed source inspection report');
const comparisonReport = labeled('Inspection comparison report');
const scope = inspection + ' ' + labeled('Project search scope');
const buffer = 'src/b-buffer.srp';
const missing = 'src/c-unavailable.srp';
const dense = 'src/a-dense.srp';
const owner = 'privateOwner';
const task = 'fixture-private-task';

async function openInspection(d) {
  await d.button(inspection, 'Inspect listed source quality and tasks');
  await d.visible(labeled('Listed inspection snapshot mode'));
}

async function prepare(d) {
  await d.button(inspection, 'Review listed source inspection');
  await d.visible(review);
}

async function run(d) {
  await prepare(d);
  await d.button(review, 'Confirm source inspection');
  await d.visible(results);
  await d.contains(testId('busy'), 'false');
}

async function assertPrivateInspection(d, selector, labels = []) {
  const value = await d.value(selector);
  assertPrivateReport(value, labels);
  assert.ok(!value.includes(owner), 'Owner disclosed');
  assert.ok(!value.includes(task), 'Task description disclosed');
}

async function restrictToBuffer(d) {
  await d.button(scope, 'Configure project search scope');
  await d.change(scope + ' ' + labeled('Project filename substring'), 'b-buffer');
}

export async function inspectionScenarios(d, step) {
  await step('inspection review previews listed scope without touching sources', async () => {
    await d.reset();
    await d.noReads(async () => {
      await openInspection(d);
      await d.button(baseline, 'Compare inspection baselines');
      await d.buttonDisabled(baseline, 'Record current inspection baseline');
      await prepare(d);
      await d.contains(review, 'Selected 7 of 7 listed sources');
      await d.button(review, 'Review inspection labels');
      await d.contains(review, buffer);
      await d.contains(review, missing);
      assert.ok(!(await d.text(review)).includes('/fixture-private/'));
      await d.button(review, 'Cancel inspection review');
      await d.absent(review);
      await d.absent(results);
    });
  });

  await step('inspection uses working buffers and preserves unread evidence', async () => {
    await d.button(s.fixture, 'Add fixture task');
    await run(d);
    await d.metric(results, 'Selected sources', 7);
    await d.metric(results, 'Unread', 1);
    await d.metric(results, 'Retained tasks', 1);
    await d.contains(results, 'Incomplete coverage');
    await d.contains(results, 'Working buffer');
    await d.contains(results, 'Read unavailable');
    assert.equal(await d.counter('search-count'), 1);
    const reads = await d.readPaths();
    assert.equal(reads.length, 6);
    assert.ok(reads.every(path => !path.endsWith('/'+buffer)));
    assert.ok(reads.some(path => path.endsWith('/'+missing)));
    await d.noReads(async () => {
      await d.change(labeled('Inspection file coverage'), 'read-failed');
      await d.contains(results, '1 matching observations');
      await d.contains(results, missing);
      await d.button(results, 'Reset inspection filters');
      await d.change(labeled('Listed inspection view'), 'tasks');
      await d.contains(results, task);
      await d.contains(results, owner);
      await d.change(labeled('Inspection task marker'), 'BUG');
      await d.contains(results, 'No retained observations match the filters.');
      await d.button(results, 'Reset inspection filters');
      await d.change(labeled('Inspection task priority'), 'high');
      await d.contains(results, 'No retained observations match the filters.');
      await d.button(results, 'Reset inspection filters');
      await d.change(labeled('Filter listed inspection observations'), 'fixture-private-task');
      await d.contains(results, '1 matching observations');
      await d.button(results, 'Open current listed source');
      await d.contains(testId('navigation'), '"source":"inspection"');
      assert.equal(JSON.parse(await d.text(testId('navigation'))).name, buffer);
    });
  });

  await step('inspection exports counts without leaking task text or owners', async () => {
    await d.noReads(async () => {
      await d.button(results, 'Review inspection report');
      await assertPrivateInspection(d, report, [buffer, missing, dense]);
      await d.check(results, 'Include relative source labels in inspection report');
      await d.wait('inspection includes labels', selector => document.querySelector(selector)?.value.includes('src/b-buffer.srp'), report);
      await assertPrivateInspection(d, report);
      await d.check(results, 'Include relative source labels in inspection report', false);
      await d.wait('inspection excludes labels', selector => !document.querySelector(selector)?.value.includes('src/b-buffer.srp'), report);
      await d.button(baseline, 'Record current inspection baseline');
      await d.contains(baseline, '1 / 8 baselines recorded');
      await d.visible(comparison);
      await d.metric(comparison, 'Task count change', '1 → 1 (0)');
    });
  });

  await step('inspection comparison counts new tasks and excludes recovered unread sources', async () => {
    await d.button(s.fixture, 'Add fixture task');
    await d.button(s.fixture, 'Recover fixture read');
    await run(d);
    await d.metric(results, 'Unread', 0);
    await d.metric(results, 'Retained tasks', 2);
    await d.visible(comparison);
    await d.metric(comparison, 'Comparable task labels', 6);
    await d.metric(comparison, 'Task count change', '1 → 2 (+1)');
    await d.noReads(async () => {
      await d.change(labeled('Inspection comparison filter'), 'uncertain');
      await d.contains(comparison, missing);
      await d.contains(comparison, '1 matching labels');
      await d.contains(comparison, 'Not comparable');
      await d.change(labeled('Inspection comparison filter'), 'changed');
      await d.contains(comparison, buffer);
      await d.button(comparison, 'Review inspection rule totals');
      await d.contains(comparison, 'Task kinds across comparable task labels');
      await d.button(comparison, 'Review inspection comparison report');
      await assertPrivateInspection(d, comparisonReport, [buffer, missing, dense]);
      await d.check(comparison, 'Include relative file labels in comparison report');
      await d.wait('comparison includes labels', selector => document.querySelector(selector)?.value.includes('src/c-unavailable.srp'), comparisonReport);
      await assertPrivateInspection(d, comparisonReport);
    });
  });

  await step('saved disk inspection excludes unsaved tasks and disallows cross-mode comparison', async () => {
    await d.change(labeled('Listed inspection snapshot mode'), 'saved');
    await run(d);
    await d.metric(results, 'Retained tasks', 0);
    await d.contains(results, 'saved disk files');
    await d.contains(baseline + ' [role=alert]', 'same working-buffer or saved-disk mode');
    await d.absent(comparison);
    const reads = await d.readPaths();
    assert.equal(reads.length, 19);
    assert.equal(reads.filter(path => path.endsWith('/'+buffer)).length, 1);
    await d.noReads(async () => {
      await d.button(baseline, 'Clear inspection baselines');
      await d.button(baseline, 'Cancel clear inspection baselines');
      await d.contains(baseline, '1 / 8 baselines recorded');
      await d.button(baseline, 'Clear inspection baselines');
      await d.button(baseline, 'Confirm clear inspection baselines');
      await d.contains(baseline, '0 / 8 baselines recorded');
      await d.visible(results);
    });
  });

  await step('inspection filters constrain reads and source navigation resolves current listing', async () => {
    await d.reset();
    await openInspection(d);
    await restrictToBuffer(d);
    await d.button(s.fixture, 'Add fixture task');
    await run(d);
    await d.metric(results, 'Selected sources', 1);
    await d.metric(results, 'Retained tasks', 1);
    assert.equal(await d.counter('read-count'), 0);
    await d.noReads(async () => {
      await d.button(results, 'Open current listed source');
      assert.equal(JSON.parse(await d.text(testId('navigation'))).name, buffer);
      await d.button(inspection, 'Dismiss inspection results');
      await d.absent(results);
    });
  });

  await step('collapsing inspection keeps recorded baselines but retires transient reviews', async () => {
    await d.reset();
    await openInspection(d);
    await d.button(s.fixture, 'Add fixture task');
    await run(d);
    await d.noReads(async () => {
      await d.button(baseline, 'Compare inspection baselines');
      await d.button(baseline, 'Record current inspection baseline');
      await d.contains(baseline, '1 / 8 baselines recorded');
      await d.button(comparison, 'Review inspection comparison report');
      await d.check(comparison, 'Include relative file labels in comparison report');
      await d.button(results, 'Review inspection report');
      await d.check(results, 'Include relative source labels in inspection report');
      await d.button(baseline, 'Clear inspection baselines');
      await prepare(d);
      await d.button(inspection, 'Hide listed source inspection');
      await d.absent(baseline);
      await d.absent(review);
      await d.absent(results);
      await d.absent(comparisonReport);
      await d.absent(report);
      await openInspection(d);
      await d.absent(review);
      await d.visible(results);
      await d.absent(report);
      await d.button(baseline, 'Compare inspection baselines');
      await d.contains(baseline, '1 / 8 baselines recorded');
      await d.visible(comparison);
      await d.absent(comparisonReport);
      await d.absent(labeled('Confirm clearing inspection baselines'));
      await d.metric(comparison, 'Task count change', '1 → 1 (0)');
      await d.button(comparison, 'Review inspection comparison report');
      await assertPrivateInspection(d, comparisonReport, [buffer, missing, dense]);
    });
  });

  await step('inspection stale scope review never expands to changed listing', async () => {
    await d.reset();
    await openInspection(d);
    await prepare(d);
    await d.noReads(async () => {
      await d.button(s.fixture, 'Add fixture source');
      await d.button(review, 'Confirm source inspection');
      await d.contains(inspection + ' [role=alert]', 'invalidated');
      await d.absent(results);
    });
  });

  await step('inspection cancellation keeps explicitly unobserved file evidence', async () => {
    await d.reset();
    await openInspection(d);
    await prepare(d);
    await d.check(s.fixture, 'Pause first synthetic read');
    await d.button(review, 'Confirm source inspection');
    await d.contains(testId('busy'), 'true');
    await d.button(inspection, 'Cancel source inspection');
    await d.buttonDisabled(inspection, 'Inspection cancellation requested');
    await d.button(s.fixture, 'Release synthetic read');
    await d.visible(results);
    await d.contains(results, 'Inspection cancelled');
    await d.contains(testId('busy'), 'false');
    assert.equal(await d.counter('read-count'), 1);
    await d.change(labeled('Inspection file coverage'), 'not-observed');
    await d.contains(results, '7 matching observations');
  });

  await step('inspection invalidates evidence when workspace changes during read', async () => {
    await d.reset();
    await openInspection(d);
    await prepare(d);
    await d.check(s.fixture, 'Pause first synthetic read');
    await d.button(review, 'Confirm source inspection');
    await d.contains(testId('busy'), 'true');
    await d.button(s.fixture, 'Edit fixture buffer');
    await d.contains(inspection + ' [role=alert]', 'invalidated');
    await d.absent(results);
    await d.contains(testId('busy'), 'false');
    assert.equal(await d.counter('read-count'), 0);
  });
}
