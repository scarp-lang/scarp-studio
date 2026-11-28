import assert from 'node:assert/strict';
import { eventually } from './settings-browser-harness.mjs';

export const selectors = Object.freeze({
  fixture: '[aria-label="Fixture controls"]',
  settings: '[aria-label="Fixture search settings"]',
  scope: '[aria-label="Project search scope"]',
  coverage: '[aria-label="Project search coverage"]',
  comparison: '[aria-label="Project search observation comparison"]',
  ledger: '[aria-label="Project search batch ledger"]',
  presets: '[aria-label="Project search presets"]',
  matches: '[aria-label="Displayed project match workbench"]',
  completed: '[aria-label="Fixture completed search"]',
});

export function labeled(name) {
  return '[aria-label=' + JSON.stringify(name) + ']';
}

export function testId(name) {
  return '[data-testid=' + JSON.stringify(name) + ']';
}

/** Read the DOM through Chromium, rather than invoking component callbacks
 * or mutating React internals. Every action checks the visible control first.
 */
export function createSearchBrowserDriver(cdp) {
  const evaluate = (fn, ...args) => cdp.evaluate(fn, ...args);
  const wait = (description, fn, ...args) =>
    eventually(() => evaluate(fn, ...args), description);

  async function visible(selector) {
    await wait('visible ' + selector, s => {
      const node = document.querySelector(s);
      return !!node && !node.closest('[hidden]') && node.getClientRects().length > 0;
    }, selector);
  }

  async function absent(selector) {
    await wait('absent ' + selector, s => !document.querySelector(s), selector);
  }

  async function text(selector) {
    await visible(selector);
    return evaluate(s => document.querySelector(s).textContent, selector);
  }

  async function contains(selector, fragment) {
    await wait('text ' + fragment + ' in ' + selector, (s, expected) =>
      document.querySelector(s)?.textContent.includes(expected), selector, fragment);
  }

  async function click(selector) {
    await visible(selector);
    await evaluate(s => {
      const node = document.querySelector(s);
      if (!(node instanceof HTMLElement) || node.matches(':disabled')) {
        throw new Error('Cannot activate ' + s);
      }
      node.click();
    }, selector);
  }

  async function button(scope, label) {
    await wait('enabled button ' + label, (s, name) =>
      [...document.querySelectorAll(s + ' button')].filter(node =>
        !node.disabled && node.getClientRects().length && node.textContent.trim() === name).length === 1,
    scope, label);
    await evaluate((s, name) => {
      const nodes = [...document.querySelectorAll(s + ' button')].filter(node =>
        !node.disabled && node.getClientRects().length && node.textContent.trim() === name);
      if (nodes.length !== 1) throw new Error('Ambiguous or unavailable button: ' + name);
      nodes[0].click();
    }, scope, label);
  }

  async function buttonDisabled(scope, label, expected = true) {
    await wait('button disabled=' + expected + ': ' + label, (s, name, disabled) => {
      const nodes = [...document.querySelectorAll(s + ' button')].filter(node =>
        node.getClientRects().length && node.textContent.trim() === name);
      return nodes.length === 1 && nodes[0].disabled === disabled;
    }, scope, label, expected);
  }

  async function change(selector, value) {
    await visible(selector);
    await evaluate((s, next) => {
      const node = document.querySelector(s);
      if (node.disabled) throw new Error('Disabled input: ' + s);
      const prototype = node instanceof HTMLSelectElement ? HTMLSelectElement.prototype :
        node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(node, next);
      node.dispatchEvent(new Event('input', { bubbles: true }));
      node.dispatchEvent(new Event('change', { bubbles: true }));
    }, selector, String(value));
    await valueIs(selector, value);
  }

  async function valueIs(selector, expected) {
    await wait('value ' + expected + ' in ' + selector, (s, v) =>
      document.querySelector(s)?.value === v, selector, String(expected));
  }

  async function value(selector) {
    await visible(selector);
    return evaluate(s => document.querySelector(s).value, selector);
  }

  async function check(scope, label, checked = true) {
    await wait('checkbox ' + label, (s, name) =>
      [...document.querySelectorAll(s + ' label')].some(node =>
        node.textContent.trim() === name && node.querySelector('input[type=checkbox]')?.getClientRects().length),
    scope, label);
    await evaluate((s, name, expected) => {
      const node = [...document.querySelectorAll(s + ' label')].find(item => item.textContent.trim() === name);
      const input = node?.querySelector('input[type=checkbox]');
      if (!input || input.disabled) throw new Error('Unavailable checkbox: ' + name);
      if (input.checked !== expected) input.click();
    }, scope, label, checked);
    await wait('checked=' + checked + ': ' + label, (s, name, expected) =>
      [...document.querySelectorAll(s + ' label')].find(item => item.textContent.trim() === name)
        ?.querySelector('input[type=checkbox]')?.checked === expected, scope, label, checked);
  }

  async function count(selector, expected) {
    await wait('count ' + expected + ' for ' + selector, (s, n) =>
      document.querySelectorAll(s).length === n, selector, expected);
  }

  async function rows(selector) {
    await visible(selector);
    return evaluate(s => [...document.querySelectorAll(s + ' tbody tr')].map(row =>
      [...row.querySelectorAll('td')].map(cell => cell.textContent.trim())), selector);
  }

  async function metric(scope, label, expected) {
    await wait('metric ' + label + '=' + expected, (s, name, value) => {
      const term = [...document.querySelectorAll(s + ' dt')].find(item => item.textContent.trim() === name);
      return term?.nextElementSibling?.textContent.trim() === value;
    }, scope, label, String(expected));
  }

  async function counter(name) {
    return Number(await text(testId(name)));
  }

  async function runSearch() {
    const before = await counter('search-count');
    await button(selectors.settings, 'Search Project');
    await visible(selectors.completed);
    await contains(testId('busy'), 'false');
    assert.equal(await counter('search-count'), before + 1);
  }

  async function reset() {
    await button(selectors.fixture, 'Reset fixture');
    await absent(selectors.completed);
    await valueIs(labeled('Fixture query'), 'needle');
    await wait('reset search counter', () => document.querySelector('[data-testid="search-count"]')?.textContent === '0');
    await wait('reset read counter', () => document.querySelector('[data-testid="read-count"]')?.textContent === '0');
  }

  async function readPaths() {
    return JSON.parse(await text(testId('read-paths')));
  }

  async function noReads(action) {
    const before = await counter('read-count');
    const searches = await counter('search-count');
    await action();
    assert.equal(await counter('read-count'), before, 'Unexpected synthetic reads');
    assert.equal(await counter('search-count'), searches, 'Unexpected search invocation');
  }

  return {
    evaluate, wait, visible, absent, text, contains, click, button, buttonDisabled,
    change, value, valueIs, check, count, rows, metric, counter, runSearch,
    reset, readPaths, noReads,
  };
}

export function assertPrivateReport(report, labels = []) {
  assert.equal(typeof report, 'string');
  assert.ok(report.length > 0, 'Expected a nonempty report');
  for (const secret of ['/fixture-private/', 'fixture-private-source-context', 'needle', ...labels]) {
    assert.ok(!report.includes(secret), 'Unexpected private report content: ' + secret);
  }
}
