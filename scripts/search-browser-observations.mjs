import assert from 'node:assert/strict';
import { selectors as s, labeled, assertPrivateReport } from './search-browser-driver.mjs';

const batch = labeled('Project search batch');
const observationReport = labeled('Search observation comparison report');
const ledgerReport = labeled('Search batch ledger report');
const knownLabels = ['src/a-dense.srp', 'src/b-buffer.srp', 'src/c-unavailable.srp', 'src/e-later.srp'];

async function startFirstBatch(d) {
  await d.reset();
  await d.button(s.scope, 'Configure project search scope');
  await d.change(batch, '1');
  await d.runSearch();
}

export async function observationScenarios(d, step) {
  await step('observation recording does not search or disclose query', async () => {
    await startFirstBatch(d);
    await d.noReads(async () => {
      await d.button(s.comparison, 'Compare search observations');
      await d.button(s.comparison, 'Record current search observation');
      await d.contains(s.comparison, '1 / 8 observations recorded');
      await d.metric(s.comparison, 'Comparable file labels', 3);
      await d.metric(s.comparison, 'Observed count delta', 0);
      assertPrivateReport(await d.value(observationReport), knownLabels);
    });
  });

  await step('buffer edit and recovered source produce evidence-aware comparison', async () => {
    await d.button(s.fixture, 'Edit fixture buffer');
    await d.button(s.fixture, 'Recover fixture read');
    await d.absent(s.completed);
    await d.buttonDisabled(s.comparison, 'Record current search observation');
    await d.runSearch();
    await d.metric(s.comparison, 'Comparable file labels', 3);
    await d.metric(s.comparison, 'Observed count delta', '+1');
    const rows = await d.rows(s.comparison + ' table');
    const buffer = rows.find(row => row[0] === 'src/b-buffer.srp');
    assert.ok(buffer);
    assert.equal(buffer[3], '+1');
    const recovered = rows.find(row => row[0] === 'src/c-unavailable.srp');
    assert.ok(recovered);
    assert.notEqual(recovered[3], '+1', 'A failed earlier scan is not a zero-match baseline');
    await d.change(labeled('Search observation filter'), 'changed');
    await d.count(s.comparison + ' tbody tr', 2);
    await d.noReads(async () => {
      await d.check(s.comparison, 'Include relative source labels in comparison report');
      await d.wait('comparison label opt-in', selector =>
        document.querySelector(selector)?.value.includes('src/b-buffer.srp'), observationReport);
      assertPrivateReport(await d.value(observationReport));
    });
  });

  await step('incompatible query and batch selection reject comparison', async () => {
    await d.change(labeled('Fixture query'), 'buffer');
    await d.runSearch();
    await d.contains(s.comparison + ' [role=alert]', 'Use the same search query');
    await d.absent(observationReport);
    await d.change(labeled('Fixture query'), 'needle');
    await d.change(batch, '2');
    await d.runSearch();
    await d.contains(s.comparison + ' [role=alert]', 'Use the same directory, filename filter and batch selection');
    await d.absent(observationReport);
  });

  await step('observation clear requires confirmation and preserves search', async () => {
    await d.noReads(async () => {
      await d.button(s.comparison, 'Clear search observations');
      await d.visible(labeled('Confirm clearing search observations'));
      await d.button(s.comparison, 'Cancel clear');
      await d.contains(s.comparison, '1 / 8 observations recorded');
      await d.button(s.comparison, 'Clear search observations');
      await d.button(s.comparison, 'Confirm clear observations');
      await d.contains(s.comparison, '0 / 8 observations recorded');
      await d.visible(s.completed);
    });
  });
}

export async function ledgerScenarios(d, step) {
  await step('ledger starts from explicit batch and separates incomplete evidence', async () => {
    await startFirstBatch(d);
    await d.noReads(async () => {
      await d.button(s.ledger, 'Track search batch coverage');
      await d.button(s.ledger, 'Start ledger from current batch');
      await d.metric(s.ledger, 'Eligible planned labels', 7);
      await d.metric(s.ledger, 'Fully scanned in recorded observations', 3);
      await d.metric(s.ledger, 'Recorded but not fully scanned', 1);
      await d.metric(s.ledger, 'No recorded observation', 3);
      await d.metric(s.ledger, 'Recorded batches', '1 / 2');
      assertPrivateReport(await d.value(ledgerReport), knownLabels);
      await d.check(s.ledger, 'Include relative source labels in ledger report');
      await d.wait('ledger relative labels', selector =>
        document.querySelector(selector)?.value.includes('src/c-unavailable.srp'), ledgerReport);
      assertPrivateReport(await d.value(ledgerReport));
    });
  });

  await step('ledger selects next unrecorded batch without automatic read', async () => {
    await d.noReads(async () => {
      await d.button(s.ledger, 'Select next pending batch');
      await d.valueIs(batch, '2');
      await d.absent(s.completed);
      await d.buttonDisabled(s.ledger, 'Record current batch observation');
    });
    await d.runSearch();
    await d.noReads(async () => {
      await d.button(s.ledger, 'Record current batch observation');
      await d.metric(s.ledger, 'Fully scanned in recorded observations', 6);
      await d.metric(s.ledger, 'Recorded but not fully scanned', 1);
      await d.metric(s.ledger, 'No recorded observation', 0);
      await d.metric(s.ledger, 'Recorded batches', '2 / 2');
    });
  });

  await step('failed batch can be retried and explicitly replaced', async () => {
    await d.noReads(async () => {
      await d.button(s.ledger, 'Select next pending batch');
      await d.valueIs(batch, '1');
      await d.button(s.fixture, 'Recover fixture read');
    });
    await d.runSearch();
    await d.noReads(async () => {
      await d.button(s.ledger, 'Replace recorded batch with current observation');
      await d.metric(s.ledger, 'Fully scanned in recorded observations', 7);
      await d.metric(s.ledger, 'Recorded but not fully scanned', 0);
      await d.buttonDisabled(s.ledger, 'Select next pending batch');
      await d.contains(s.ledger, 'does not establish current workspace coverage');
    });
  });

  await step('ledger context rejects changed inventory and clear is explicit', async () => {
    await d.noReads(async () => {
      await d.button(s.fixture, 'Add fixture source');
      await d.contains(s.ledger + ' [role=alert]', 'listed source inventory changed');
      await d.buttonDisabled(s.ledger, 'Select batch 1');
      await d.buttonDisabled(s.ledger, 'Select batch 2');
      await d.button(s.ledger, 'Clear search batch ledger');
      await d.button(s.ledger, 'Cancel clear ledger');
      await d.metric(s.ledger, 'Recorded batches', '2 / 2');
      await d.button(s.ledger, 'Clear search batch ledger');
      await d.button(s.ledger, 'Confirm clear ledger');
      await d.absent(ledgerReport);
      await d.buttonDisabled(s.ledger, 'Start ledger from current batch');
    });
  });
}
