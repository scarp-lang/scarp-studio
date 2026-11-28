import assert from 'node:assert/strict';
import { selectors as s, labeled, testId, assertPrivateReport } from './search-browser-driver.mjs';

const sweep = labeled('Project search sweep');
const review = labeled('Review project search sweep');
const result = labeled('Project search sweep results');
const output = labeled('Project search sweep report');
const first = labeled('Sweep first batch');
const last = labeled('Sweep last batch');

async function reviewAll(d) {
  await d.button(sweep, 'Run reviewed batch sweep');
  await d.button(sweep, 'Select first available sweep window');
  await d.valueIs(first, '1');
  await d.valueIs(last, '2');
  await d.button(sweep, 'Review search sweep');
  await d.visible(review);
}

export async function sweepScenarios(d, step) {
  await step('sweep review is read-free and covers exact consecutive labels', async () => {
    await d.reset();
    await d.noReads(async () => {
      await reviewAll(d);
      await d.contains(review, '7 selected labels');
      await d.button(review, 'Review planned sweep labels');
      await d.contains(review, 'src/a-dense.srp');
      await d.contains(review, 'tests/z-last.srp');
      assert.ok(!(await d.text(review)).includes('/fixture-private/'));
      await d.button(review, 'Cancel sweep review');
      await d.absent(review);
      await d.change(last, '3');
      await d.button(sweep, 'Review search sweep');
      await d.contains(sweep + ' [role=alert]', 'Choose an available consecutive range');
      await d.absent(review);
      await d.change(last, '2');
      await d.button(sweep, 'Review search sweep');
    });
  });

  await step('sweep runs each selected batch and reports independent coverage', async () => {
    await d.button(review, 'Confirm and run sweep');
    await d.visible(result);
    await d.contains(result, 'Sweep completed');
    await d.metric(result, 'Selected labels', 7);
    await d.metric(result, 'Fully scanned', 6);
    await d.metric(result, 'Recorded but incomplete', 1);
    await d.metric(result, 'Unobserved labels', 0);
    await d.metric(result, 'Deferred outside range', 0);
    assert.equal(await d.counter('search-count'), 1);
    assert.equal(await d.counter('read-count'), 6);
    await d.absent(s.completed);
    await d.change(labeled('Sweep file evidence filter'), 'incomplete');
    await d.contains(result, 'src/c-unavailable.srp');
    await d.button(result, 'Review sweep report');
    assertPrivateReport(await d.value(output), ['src/c-unavailable.srp', 'src/a-dense.srp']);
    await d.check(result, 'Include relative source labels in sweep report');
    await d.wait('sweep labels included', selector => document.querySelector(selector)?.value.includes('src/a-dense.srp'), output);
    assertPrivateReport(await d.value(output));
    await d.check(result, 'Include relative source labels in sweep report', false);
    await d.wait('sweep labels removed', selector => !document.querySelector(selector)?.value.includes('src/a-dense.srp'), output);
  });

  await step('changed settings invalidate the reviewed sweep before reads', async () => {
    await d.reset();
    await d.noReads(async () => {
      await reviewAll(d);
      await d.change(labeled('Fixture query'), 'different');
      await d.button(review, 'Confirm and run sweep');
      await d.contains(sweep + ' [role=alert]', 'invalidated');
      await d.absent(result);
    });
  });

  await step('explicit cancellation keeps only completed batches', async () => {
    await d.reset();
    await reviewAll(d);
    await d.check(s.fixture, 'Pause first synthetic read');
    await d.button(review, 'Confirm and run sweep');
    await d.contains(testId('busy'), 'true');
    await d.button(sweep, 'Cancel active sweep');
    await d.buttonDisabled(sweep, 'Cancellation requested');
    await d.button(s.fixture, 'Release synthetic read');
    await d.visible(result);
    await d.contains(result, 'Sweep cancelled');
    await d.metric(result, 'Unobserved labels', 7);
    await d.metric(result, 'Fully scanned', 0);
    await d.contains(testId('busy'), 'false');
    assert.equal(await d.counter('read-count'), 1);
  });

  await step('workspace mutation retires active sweep and discards evidence', async () => {
    await d.reset();
    await reviewAll(d);
    await d.check(s.fixture, 'Pause first synthetic read');
    await d.button(review, 'Confirm and run sweep');
    await d.contains(testId('busy'), 'true');
    await d.button(s.fixture, 'Edit fixture buffer');
    await d.contains(sweep + ' [role=alert]', 'invalidated');
    await d.absent(result);
    await d.contains(testId('busy'), 'false');
    assert.equal(await d.counter('read-count'), 0);
  });
}
