import { workspaceArchitectureSmoke } from './settings-browser-workspace-architecture.mjs';
import { sourceBreadcrumbsSmoke } from './settings-browser-source-breadcrumbs.mjs';
import { referenceEditorSmoke } from './settings-browser-reference.mjs';
import { editorViewStateSmoke } from './settings-browser-editor-view-state.mjs';
import { tabOrganizationSmoke } from './settings-browser-tab-organization.mjs';
import { quickOpenSmoke } from './settings-browser-quick-open.mjs';
import { selectionAndCommandSmoke } from './settings-browser-selection.mjs';
import assert from 'node:assert/strict';
import { advancedSettingsSmoke } from './settings-browser-advanced.mjs';
import { eventually, launchBrowser, serveBuild } from './settings-browser-harness.mjs';

const server = await serveBuild();
let browser;
let completed = 0;
try {
  browser = await launchBrowser(server.url);
  const { cdp } = browser;
  const evaluate = (fn, ...args) => cdp.evaluate(fn, ...args);
  const wait = (fn, description, ...args) => eventually(() => evaluate(fn, ...args), description);
  const visible = selector => wait(s => {
    const element = document.querySelector(s);
    return !!element && !element.closest('[hidden]') && element.getClientRects().length > 0;
  }, 'visible ' + selector, selector);
  const click = async selector => {
    await visible(selector);
    await evaluate(s => {
      const element = document.querySelector(s);
      if (element.matches(':disabled')) throw Error('Disabled control: ' + s);
      element.click();
    }, selector);
  };
  const button = async (label, scope = '#editor-settings') => {
    await wait((label, scope) => Array.from(document.querySelectorAll(scope + ' button')).some(
      b => b.textContent.trim() === label && !b.closest('[hidden]') && !b.disabled && b.getClientRects().length),
    'button ' + label, label, scope);
    await evaluate((label, scope) => {
      const b = Array.from(document.querySelectorAll(scope + ' button')).find(
        b => b.textContent.trim() === label && !b.closest('[hidden]') && !b.disabled && b.getClientRects().length);
      if (!b) throw Error('Button disappeared: ' + label);
      b.click();
    }, label, scope);
  };
  const change = async (selector, value) => {
    await visible(selector);
    await evaluate((selector, value) => {
      const element = document.querySelector(selector);
      if (element.disabled) throw Error('Disabled input: ' + selector);
      const proto = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype :
        element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }, selector, String(value));
    await wait((s, v) => document.querySelector(s)?.value === v, 'value ' + selector, selector, String(value));
  };
  const category = label => button(label, '.settings-category-nav');
  const search = async query => {
    await change('input[aria-label="Search settings"]', query);
    await visible('.settings-search-results button');
  };
  const jump = async label => {
    await evaluate(label => {
      const b = Array.from(document.querySelectorAll('.settings-search-results button')).find(b =>
        b.querySelector('strong')?.textContent.trim() === label || b.textContent.trim().startsWith(label));
      if (!b) throw Error('Missing search result ' + label);
      b.click();
    }, label);
  };
  const stored = (key, path, value) => wait((key, path, value) => {
    let data = JSON.parse(localStorage.getItem(key) ?? 'null');
    for (const part of path) data = data?.[part];
    return data === value;
  }, 'persisted ' + key + ':' + path.join('.'), key, path, value);
  const step = async (name, action) => {
    await action(); completed++;
    console.log('PASS ' + name);
  };
  await visible('.settings-toggle');
  await click('.settings-toggle');
  await step('appearance preferences update and persist', async () => {
    await category('Appearance');
    await change('#studio-theme', 'light');
    await change('#studio-contrast', 'high');
    await change('#studio-motion', 'reduced');
    await wait(() => document.documentElement.dataset.theme === 'light' &&
      document.documentElement.dataset.contrast === 'high' &&
      document.documentElement.dataset.motion === 'reduced', 'appearance applied');
    await stored('studio.appearance.v1', ['contrast'], 'high');
  });
  await step('global search reveals and focuses a collapsed advanced control', async () => {
    await search('line height');
    await jump('Line height');
    await visible('#editor-experience-lineHeight');
    await wait(() => document.activeElement?.id === 'editor-experience-lineHeight', 'advanced control focus');
    await change('#editor-experience-lineHeight', 28);
  });
  await step('disabled Auto Save delay falls back to its category', async () => {
    await search('auto save delay');
    await jump('Auto Save delay');
    await visible('#studio-auto-save-delay');
    assert.equal(await evaluate(() => document.querySelector('#studio-auto-save').checked), false);
    await wait(() => document.activeElement?.id === 'settings-category-files', 'disabled control focus fallback');
  });
  await step('shortcut override updates the command label and storage', async () => {
    await category('Keyboard shortcuts');
    await change('#studio-shortcut-new', 'Ctrl+Alt+Shift+K');
    await stored('studio.shortcuts.v1', ['bindings', 'new'], 'Ctrl+Alt+Shift+K');
    await wait(() => !!document.querySelector('button[title="New (Ctrl+Alt+Shift+K)"]'), 'updated toolbar label');
    assert.equal(await evaluate(() => document.querySelector('#studio-shortcut-settings').disabled), true);
  });
  let exported;
  await step('Studio export excludes automatic writes and trust settings', async () => {
    await category('Studio preference transfer');
    await button('Export Studio preferences');
    exported = JSON.parse(await evaluate(() => document.querySelector('#studio-transfer-export').value));
    assert.equal(exported.format, 'scarp-studio.preferences');
    assert.equal(exported.preferences.editor.lineHeight, 28);
    assert.deepEqual(Object.keys(exported.preferences.files), ['autoSaveDelay']);
    assert.deepEqual(Object.keys(exported.preferences).sort(), ['appearance', 'editor', 'files', 'intelliSense', 'layout']);
  });
  await step('invalid import cannot authorize Auto Save', async () => {
    await button('Import Studio preferences');
    const invalid = structuredClone(exported);
    invalid.preferences.files.enabled = true;
    await change('#studio-transfer-import', JSON.stringify(invalid));
    await button('Review Studio import');
    await wait(() => !!document.querySelector('.studio-transfer [role="alert"]'), 'invalid import rejected');
    assert.equal(await evaluate(() => !!document.querySelector('[aria-label="Confirm Studio preference changes"]')), false);
  });
  await step('reviewed import and undo change only selected portable preferences', async () => {
    const modified = structuredClone(exported);
    modified.preferences.editor.lineHeight = 32;
    await change('#studio-transfer-import', JSON.stringify(modified));
    await button('Review Studio import');
    await button('Confirm Studio import');
    await wait(() => JSON.parse(document.querySelector('#studio-transfer-export').value).preferences.editor.lineHeight === 32, 'import applied');
    await button('Review undo last import');
    await button('Confirm Studio undo');
    await wait(() => JSON.parse(document.querySelector('#studio-transfer-export').value).preferences.editor.lineHeight === 28, 'undo applied');
    assert.equal(await evaluate(() => document.querySelector('#studio-auto-save').checked), false);
  });
  await step('named configuration and session history operate through Settings', async () => {
    await button('Manage named configurations');
    await change('#studio-profile-name', 'Browser Smoke');
    await button('Save current configuration');
    await wait(() => Array.from(document.querySelector('#studio-profile-select').options).some(o => o.text === 'Browser Smoke'), 'saved configuration');
    await button('Browse preference history');
    await visible('.history-entries button');
  });
  await step('settings persist after a real page reload', async () => {
    await cdp.send('Page.reload', { ignoreCache: true });
    await wait(() => document.readyState === 'complete' && !!document.querySelector('.settings-toggle'), 'reloaded application');
    if (!await evaluate(() => !!document.querySelector('#editor-settings'))) await click('.settings-toggle');
    await category('Appearance');
    assert.equal(await evaluate(() => document.querySelector('#studio-theme').value), 'light');
    assert.equal(await evaluate(() => document.querySelector('#studio-contrast').value), 'high');
    await search('line height');
    await jump('Line height');
    await visible('#editor-experience-lineHeight');
    assert.equal(await evaluate(() => document.querySelector('#editor-experience-lineHeight').value), '28');
    await category('Keyboard shortcuts');
    assert.equal(await evaluate(() => document.querySelector('#studio-shortcut-new').value), 'Ctrl+Alt+Shift+K');
    await category('Studio preference transfer');
    await button('Manage named configurations');
    assert.ok(await evaluate(() => Array.from(document.querySelector('#studio-profile-select').options).some(o => o.text === 'Browser Smoke')));
    await button('Browse preference history');
    assert.equal(await evaluate(() => document.querySelectorAll('.history-entries button').length), 0);
  });
  await advancedSettingsSmoke({ evaluate, wait, visible, click, button, change, category, stored, step, cdp });
  await selectionAndCommandSmoke({ evaluate, wait, visible, click, button, change, category, step, cdp });
  await quickOpenSmoke({ evaluate, wait, visible, click, button, change, step, cdp });
  await tabOrganizationSmoke({ evaluate, wait, visible, click, button, change, step, cdp });
  await editorViewStateSmoke({ evaluate, wait, visible, click, change, step, cdp });
  await referenceEditorSmoke({ evaluate, wait, visible, click, change, step, cdp });
  await sourceBreadcrumbsSmoke({ evaluate, wait, visible, click, change, step, cdp });
  await workspaceArchitectureSmoke({ evaluate, wait, visible, click, change, step, cdp });
  assert.deepEqual(cdp.errors, [], 'uncaught browser exceptions');
  console.log('Settings browser smoke: ' + completed + ' checks passed.');
} finally {
  try { if (browser) await browser.close(); }
  finally { await server.close(); }
}
