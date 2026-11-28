import assert from 'node:assert/strict';
import { selectors as s, labeled, testId, assertPrivateReport } from './search-browser-driver.mjs';

const source = labeled('Filter displayed project match source');
const origin = labeled('Filter project match origin');
const context = labeled('Filter displayed match context');
const first = labeled('First displayed match line');
const last = labeled('Last displayed match line');
const report = labeled('Displayed project match report');
const order = labeled('Displayed project match order');
const review = labeled('Reviewed project search occurrence');
const rows = s.matches + ' [role=listitem]';
const dense = 'src/a-dense.srp';
const buffer = 'src/b-buffer.srp';
const unicode = 'src/nested/f-unicode.srp';

export async function matchScenarios(d, step) {
  await step('match workbench paginates without reading additional files', async () => {
    await d.reset();
    await d.runSearch();
    await d.contains(s.matches, '32 filtered of 32 displayed matches');
    await d.contains(s.matches, 'Page 1 of 2');
    const pageSize = await d.evaluate(selector => document.querySelectorAll(selector).length, rows);
    assert.ok(pageSize > 0 && pageSize < 32);
    await d.noReads(async () => {
      await d.button(s.matches, 'Next match page');
      await d.contains(s.matches, 'Page 2 of 2');
      await d.count(rows, 32 - pageSize);
      await d.buttonDisabled(s.matches, 'Next match page');
      await d.button(s.matches, 'Previous match page');
      await d.count(rows, pageSize);
      await d.buttonDisabled(s.matches, 'Previous match page');
    });
  });

  await step('source overview, context and origin filters compose', async () => {
    await d.noReads(async () => {
      await d.button(s.matches, 'Review matching source overview');
      const overview = await d.rows(s.matches + ' table');
      assert.equal(overview.find(row => row[0] === dense)[1], '27');
      assert.equal(overview.find(row => row[0] === buffer)[1], '2');
      await d.button(s.matches, dense);
      await d.valueIs(source, dense);
      await d.contains(s.matches, '27 filtered of 32 displayed matches');
      await d.change(origin, 'open-buffer');
      await d.contains(s.matches, '0 filtered of 32 displayed matches');
      await d.contains(s.matches, 'No displayed matches satisfy the current filters');
      await d.button(s.matches, 'Reset displayed match filters');
      await d.change(origin, 'open-buffer');
      await d.contains(s.matches, '2 filtered of 32 displayed matches');
      await d.change(context, 'buffer');
      await d.count(rows, 2);
      await d.change(context, 'does-not-occur');
      await d.count(rows, 0);
      await d.button(s.matches, 'Reset displayed match filters');
    });
  });

  await step('inclusive line range, invalid range and sort preserve occurrence identity', async () => {
    await d.noReads(async () => {
      await d.change(source, dense);
      await d.change(first, '20');
      await d.change(last, '22');
      await d.contains(s.matches, '3 filtered of 32 displayed matches');
      await d.count(rows, 3);
      await d.change(last, '19');
      await d.contains(s.matches + ' [role=alert]', 'valid inclusive line range');
      await d.count(rows, 0);
      await d.change(last, '22');
      await d.change(order, 'file-density');
      const firstReview = rows + ':first-child button[aria-pressed]';
      await d.click(firstReview);
      await d.contains(review, '20:');
      await d.buttonDisabled(review, 'Previous reviewed match');
      await d.button(review, 'Next reviewed match');
      await d.contains(review, '21:');
      await d.button(review, 'Open reviewed match');
      const nav = JSON.parse(await d.text(testId('navigation')));
      assert.equal(nav.name, dense);
      assert.equal(nav.line, 21);
      assert.equal(nav.match, 'needle');
      assert.equal(nav.fromOpenTab, false);
      await d.button(review, 'Next reviewed match');
      await d.contains(review, '22:');
      await d.buttonDisabled(review, 'Next reviewed match');
    });
  });

  await step('Unicode preview and navigation retain exact UTF-16 coordinates', async () => {
    await d.noReads(async () => {
      await d.button(s.matches, 'Reset displayed match filters');
      await d.change(source, unicode);
      await d.count(rows, 1);
      await d.click(rows + ' button[aria-pressed]');
      await d.contains(review, '😀');
      await d.contains(review, '1:7');
      await d.button(review, 'Open reviewed match');
      const nav = JSON.parse(await d.text(testId('navigation')));
      assert.deepEqual(nav, {
        name: unicode, line: 1, column: 7, offset: 6, match: 'needle', fromOpenTab: false,
      });
      assert.equal(await d.evaluate(selector => document.querySelector(selector + ' mark').textContent, review), 'needle');
    });
  });

  await step('reports omit source context and queries even when locations are included', async () => {
    await d.noReads(async () => {
      await d.button(s.matches, 'Review displayed match report');
      assertPrivateReport(await d.value(report), [dense, buffer, unicode]);
      await d.check(s.matches, 'Include relative source labels and coordinates');
      await d.wait('coordinate report opt-in', selector =>
        document.querySelector(selector)?.value.includes('src/nested/f-unicode.srp'), report);
      const exported = await d.value(report);
      assertPrivateReport(exported, [dense, buffer]);
      assert.ok(exported.includes(unicode));
      await d.check(s.matches, 'Include relative source labels and coordinates', false);
      await d.wait('coordinate report opt-out', selector =>
        !document.querySelector(selector)?.value.includes('src/nested/f-unicode.srp'), report);
    });
  });

  await step('edited open buffer retires displayed match and starts fresh review', async () => {
    await d.button(s.fixture, 'Edit fixture buffer');
    await d.absent(s.matches);
    await d.absent(review);
    await d.runSearch();
    await d.contains(s.matches, '33 filtered of 33 displayed matches');
    await d.change(origin, 'open-buffer');
    await d.count(rows, 3);
    await d.click(rows + ':last-child button[aria-pressed]');
    await d.button(review, 'Open reviewed match');
    const nav = JSON.parse(await d.text(testId('navigation')));
    assert.equal(nav.name, buffer);
    assert.equal(nav.line, 3);
    assert.equal(nav.fromOpenTab, true);
  });
}
