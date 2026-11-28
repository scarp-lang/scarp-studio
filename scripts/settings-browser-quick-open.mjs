import assert from 'node:assert/strict';

/** Exercise the real App's Ctrl+P palette in Chromium, with unsaved
 * buffers only. No native dialogs, compiler, or disk writes are used. */
export async function quickOpenSmoke({ evaluate, wait, visible, click, button, change, step, cdp }) {
  const palette = '[aria-label="Quick Open Scarp tabs and project sources"]';
  const query = 'input[aria-label="Search open Scarp tabs and listed project files"]';
  const scope = 'select[aria-label="Quick Open source scope"]';
  const mode = 'select[aria-label="Quick Open matching mode"]';
  const location = 'input[aria-label="Quick Open line and column"]';
  const tabs = '[aria-label="Open source files"] [role="tab"]';
  const activeTab = tabs + '[aria-selected="true"]';
  const options = palette + ' [role="option"]';
  const status = 'button[title^="Go to Line ("]';
  const newButton = '[aria-label="File actions"] button[title^="New ("]';
  let first;
  let second;

  const resultNames = () => evaluate(s =>
    [...document.querySelectorAll(s + ' .nav-result-name')].map(node => node.textContent), options);
  const activeName = () => evaluate(s => document.querySelector(s)?.title, activeTab);
  const waitActive = name => wait((s, name) => document.querySelector(s)?.title === name,
    'active tab ' + name, activeTab, name);
  const tabCount = () => evaluate(s => document.querySelectorAll(s).length, tabs);
  const key = async (key, code, virtual, modifiers = 0) => {
    const event = { key, code, modifiers, windowsVirtualKeyCode: virtual, nativeVirtualKeyCode: virtual };
    await cdp.send('Input.dispatchKeyEvent', { ...event, type: 'keyDown' });
    await cdp.send('Input.dispatchKeyEvent', { ...event, type: 'keyUp' });
  };

  async function openPalette() {
    await click('.toolbar-quick-open');
    await visible(palette);
    await wait(s => document.activeElement === document.querySelector(s), 'Quick Open query focus', query);
  }

  async function closePalette() {
    await click(palette + ' button[aria-label="Close navigation"]');
    await wait(s => !document.querySelector(s), 'Quick Open closed', palette);
  }

  async function newTab() {
    const before = await tabCount();
    await click(newButton);
    await wait((s, count) => document.querySelectorAll(s).length === count, 'new untitled tab', tabs, before + 1);
    await visible('.monaco-editor textarea');
    const name = await activeName();
    assert.match(name, /^Untitled-[0-9]+\.srp$/);
    return name;
  }

  async function waitResults(expected) {
    await wait((s, names) => JSON.stringify([...document.querySelectorAll(s + ' .nav-result-name')]
      .map(node => node.textContent)) === JSON.stringify(names), 'Quick Open results ' + expected.join(', '), options, expected);
  }

  async function choose(name) {
    await wait((s, name) => [...document.querySelectorAll(s)].some(node =>
      !node.disabled && node.querySelector('.nav-result-name')?.textContent === name), 'selectable Quick Open result ' + name, options, name);
    await evaluate((s, name) => {
      const node = [...document.querySelectorAll(s)].find(item =>
        !item.disabled && item.querySelector('.nav-result-name')?.textContent === name);
      if (!node) throw Error('Quick Open result disappeared');
      node.click();
    }, options, name);
    await wait(s => !document.querySelector(s), 'Quick Open selection closed', palette);
    await waitActive(name);
  }

  async function waitCursor(line, column) {
    await wait((s, expected) => document.querySelector(s)?.textContent === expected,
      'cursor line ' + line + ' column ' + column, status, 'Ln ' + line + ', Col ' + column);
  }

  await step('Quick Open scopes reflect actual untitled and modified editor tabs', async () => {
    first = await newTab();
    await evaluate(() => document.querySelector('.monaco-editor textarea').focus());
    await key('a', 'KeyA', 65, 2);
    await cdp.send('Input.insertText', { text: 'alpha\nbeta\ngamma' });
    await wait(s => !!document.querySelector(s + ' [aria-label="unsaved changes"]'), 'dirty tab', activeTab);
    second = await newTab();
    await openPalette();
    assert.equal(await evaluate(s => document.querySelector(s).value, scope), 'all');
    assert.equal(await evaluate(s => document.querySelector(s).value, mode), 'fuzzy');
    await change(scope, 'modified');
    const modified = await resultNames();
    assert.ok(modified.includes(first));
    assert.ok(!modified.includes(second));
    await change(scope, 'untitled');
    const untitled = await resultNames();
    assert.ok(untitled.includes(first));
    assert.ok(untitled.includes(second));
    await change(scope, 'closed');
    await waitResults([]);
    await change(scope, 'listed');
    await waitResults([]);
    assert.equal(await activeName(), second);
    await closePalette();
  });

  await step('Quick Open recent scope prioritizes active tabs and preserves unsaved buffers', async () => {
    await openPalette();
    await change(scope, 'recent');
    await wait(s => document.querySelector(s + ' .nav-result-name')?.textContent ===
      document.querySelector('[aria-label="Open source files"] [aria-selected="true"]')?.title,
    'active recent tab first', options);
    assert.ok((await resultNames()).includes(first));
    await change(query, first);
    await waitResults([first]);
    await choose(first);
    await wait(s => !!document.querySelector(s + ' [aria-label="unsaved changes"]'), 'dirty buffer preserved', activeTab);
    await openPalette();
    await change(scope, 'recent');
    assert.deepEqual((await resultNames()).slice(0, 2), [first, second]);
    await closePalette();
  });

  await step('Quick Open fuzzy abbreviation differs from literal search and highlights matches', async () => {
    await openPalette();
    const abbreviated = 'utl-' + first.match(/[0-9]+/)[0];
    await change(query, abbreviated);
    await waitResults([first]);
    const highlighted = await evaluate(s =>
      [...document.querySelectorAll(s + ' mark.quick-open-match')].map(node => node.textContent).join(''), options);
    assert.equal(highlighted.toLowerCase(), abbreviated.toLowerCase());
    await change(mode, 'literal');
    await waitResults([]);
    await change(query, first);
    await waitResults([first]);
    await closePalette();
  });

  await step('Quick Open invalid line input blocks selection instead of silently opening a tab', async () => {
    await openPalette();
    await change(query, second);
    await waitResults([second]);
    await change(location, '0:1');
    await wait(s => document.querySelector(s)?.getAttribute('aria-invalid') === 'true', 'invalid location', location);
    await wait(s => document.querySelector(s)?.disabled, 'invalid position blocks result', options);
    await evaluate(s => document.querySelector(s).focus(), query);
    await key('Enter', 'Enter', 13);
    await visible(palette);
    assert.equal(await activeName(), first);
    await change(location, '');
    await wait(s => !document.querySelector(s)?.disabled, 'valid position permits result', options);
    await choose(second);
  });

  await step('Quick Open navigates to an exact position in another dirty tab', async () => {
    await openPalette();
    await change(query, first);
    await waitResults([first]);
    await change(location, '2:3');
    await evaluate(s => document.querySelector(s).focus(), location);
    await key('Enter', 'Enter', 13);
    await wait(s => !document.querySelector(s), 'position selection closes palette', palette);
    await waitActive(first);
    await waitCursor(2, 3);
    await wait(s => !!document.querySelector(s + ' [aria-label="unsaved changes"]'), 'dirty text remains', activeTab);
  });

  await step('Quick Open clamps positions and resets optional controls on the next invocation', async () => {
    await openPalette();
    await change(query, first);
    await change(location, '999:999');
    await choose(first);
    await waitCursor(3, 6);
    await wait(() => document.querySelector('.status-notice')?.textContent.includes('clamped'), 'clamp notice');
    await openPalette();
    assert.equal(await evaluate(s => document.querySelector(s).value, location), '');
    assert.equal(await evaluate(s => document.querySelector(s).value, query), '');
    assert.equal(await evaluate(s => document.querySelector(s).value, scope), 'all');
    await closePalette();
  });

  await step('Quick Open recent entries disappear after a clean tab closes', async () => {
    await openPalette();
    await change(query, second);
    await choose(second);
    const before = await tabCount();
    await click(activeTab + ' .tab-close');
    await wait((s, count) => document.querySelectorAll(s).length === count, 'closed clean tab', tabs, before - 1);
    await openPalette();
    await change(scope, 'recent');
    await change(query, second);
    await waitResults([]);
    await closePalette();
  });
}
