import assert from 'node:assert/strict';
import { selectors as s, labeled, testId, assertPrivateReport } from './search-browser-driver.mjs';

const dir = labeled('Project search directory');
const batch = labeled('Project search batch');
const filename = labeled('Project filename substring');
const coverageReport = labeled('Project search coverage report text');
const root = '/fixture-private/workspace/';
const labels = [
  'src/a-dense.srp', 'src/b-buffer.srp', 'src/c-unavailable.srp',
  'src/d-empty.srp', 'src/e-later.srp', 'src/nested/f-unicode.srp',
  'tests/z-last.srp',
];

export async function scopeScenarios(d, step) {
  await step('scope preview and numbered batches are read-free', async () => {
    await d.reset();
    await d.noReads(async () => {
      await d.button(s.scope, 'Configure project search scope');
      await d.change(batch, '1');
      await d.contains(s.scope, '4 selected · 3 deferred');
      await d.button(s.scope, 'Review scope inventory');
      const preview = await d.text(s.scope + ' .project-scope-inventory');
      for (const name of labels.slice(0, 4)) assert.ok(preview.includes(name));
      for (const name of labels.slice(4)) assert.ok(!preview.includes(name));
      await d.buttonDisabled(s.scope, 'Previous search batch');
      await d.button(s.scope, 'Next search batch');
      await d.valueIs(batch, '2');
      await d.contains(s.scope, '3 selected · 4 deferred');
      await d.buttonDisabled(s.scope, 'Next search batch');
      await d.button(s.scope, 'Previous search batch');
      await d.valueIs(batch, '1');
    });
  });

  await step('batch reads preserve open-buffer precedence and failure coverage', async () => {
    await d.runSearch();
    const paths = await d.readPaths();
    assert.deepEqual([...paths].sort(), [labels[0], labels[2], labels[3]].map(name => root + name).sort());
    await d.button(s.coverage, 'Review search coverage report');
    await d.metric(s.coverage, 'Fully scanned', 3);
    await d.metric(s.coverage, 'Not fully scanned', 1);
    await d.metric(s.coverage, 'Displayed matches', 29);
    await d.metric(s.coverage, 'Matching files', 2);
    await d.contains(s.coverage, '3 deferred to other batches');
    const rows = await d.rows(s.coverage + ' table');
    assert.equal(rows.length, 4);
    assert.deepEqual(rows.find(row => row[0] === labels[1]), [labels[1], 'Fully scanned', '2', 'Open buffer']);
    assert.deepEqual(rows.find(row => row[0] === labels[2]), [labels[2], 'Read unavailable', '0', 'Disk read attempt']);
    await d.change(labeled('Project file coverage filter'), 'incomplete');
    await d.count(s.coverage + ' tbody tr', 1);
    assert.equal((await d.rows(s.coverage + ' table'))[0][0], labels[2]);
    await d.change(labeled('Project file coverage filter'), 'matched');
    await d.count(s.coverage + ' tbody tr', 2);
  });

  await step('coverage reports require explicit label disclosure', async () => {
    await d.noReads(async () => {
      const report = await d.value(coverageReport);
      assertPrivateReport(report, labels);
      await d.check(s.coverage, 'Include relative source labels in report');
      await d.wait('relative labels included', selector =>
        document.querySelector(selector)?.value.includes('src/a-dense.srp'), coverageReport);
      const disclosed = await d.value(coverageReport);
      assertPrivateReport(disclosed, labels.slice(4));
      assert.ok(disclosed.includes(labels[2]));
      await d.check(s.coverage, 'Include relative source labels in report', false);
      await d.wait('labels removed', selector =>
        !document.querySelector(selector)?.value.includes('src/a-dense.srp'), coverageReport);
    });
  });

  await step('next batch retires prior result and scans separate labels', async () => {
    await d.noReads(async () => {
      await d.button(s.scope, 'Next search batch');
      await d.absent(s.completed);
      await d.valueIs(batch, '2');
    });
    await d.runSearch();
    assert.equal(await d.counter('read-count'), 6);
    assert.deepEqual((await d.readPaths()).slice(3).sort(), labels.slice(4).map(name => root + name).sort());
    await d.button(s.coverage, 'Review search coverage report');
    await d.metric(s.coverage, 'Fully scanned', 3);
    await d.metric(s.coverage, 'Not fully scanned', 0);
    await d.metric(s.coverage, 'Displayed matches', 3);
    await d.contains(s.coverage, '4 deferred to other batches');
  });

  await step('directory descendants and literal basename filter reset batch', async () => {
    await d.noReads(async () => {
      await d.change(dir, 'src');
      await d.valueIs(batch, 'all');
      await d.contains(s.scope, '6 listed eligible source(s)');
      await d.check(s.scope, 'Include descendant directories', false);
      await d.contains(s.scope, '5 listed eligible source(s)');
      await d.change(filename, 'UNICODE');
      await d.contains(s.scope, '0 listed eligible source(s)');
      await d.check(s.scope, 'Include descendant directories');
      await d.contains(s.scope, '1 listed eligible source(s)');
      await d.change(filename, '*');
      await d.contains(s.scope, '0 listed eligible source(s)');
      await d.change(filename, 'unicode');
      await d.contains(s.scope, '1 listed eligible source(s)');
      await d.change(batch, '1');
      await d.button(s.scope, 'Reset project scope');
      await d.valueIs(dir, '');
      await d.valueIs(batch, 'all');
      await d.valueIs(filename, '');
    });
  });

  await step('cancelled read cannot publish a retired result', async () => {
    await d.reset();
    await d.check(s.fixture, 'Pause first synthetic read');
    await d.button(s.settings, 'Search Project');
    await d.contains(testId('busy'), 'true');
    await d.buttonDisabled(s.settings, 'Search Project');
    await d.button(s.fixture, 'Cancel fixture search');
    await d.contains(testId('busy'), 'false');
    await d.absent(s.completed);
    assert.equal(await d.counter('read-count'), 0);
    await d.check(s.fixture, 'Pause first synthetic read', false);
    await d.runSearch();
    assert.equal(await d.counter('search-count'), 2);
    assert.equal(await d.counter('read-count'), 6);
  });
}
