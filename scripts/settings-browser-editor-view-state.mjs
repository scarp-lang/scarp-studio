import assert from 'node:assert/strict';

/** Real editor view state across mounted Monaco instances. The fixture uses
 * untitled buffers, so no native source permissions or writes are needed. */
export async function editorViewStateSmoke({ evaluate, wait, visible, click, change, step, cdp }) {
  const tabs = '[aria-label="Open source files"] [role="tab"]';
  const activeTab = tabs + '[aria-selected="true"]';
  const status = 'button[title^="Go to Line ("]';
  const newButton = '[aria-label="File actions"] button[title^="New ("]';
  const editor = '.monaco-editor textarea';
  const palette = '[aria-label="Quick Open Scarp tabs and project sources"]';
  const query = 'input[aria-label="Search open Scarp tabs and listed project files"]';
  const location = 'input[aria-label="Quick Open line and column"]';
  const name = () => evaluate(s => document.querySelector(s)?.title, activeTab);
  const tabSelector = value => tabs + '[title=' + JSON.stringify(value) + ']';
  const key = async (key, code, virtual, modifiers = 0) => {
    const event = { key, code, modifiers, windowsVirtualKeyCode: virtual, nativeVirtualKeyCode: virtual };
    await cdp.send('Input.dispatchKeyEvent', { ...event, type: 'keyDown' });
    await cdp.send('Input.dispatchKeyEvent', { ...event, type: 'keyUp' });
  };

  async function newTab() {
    const before = await evaluate(s => document.querySelectorAll(s).length, tabs);
    await click(newButton);
    await wait((s, count) => document.querySelectorAll(s).length === count, 'new view-state tab', tabs, before + 1);
    await visible(editor);
    return name();
  }

  async function activate(value) {
    await click(tabSelector(value));
    await wait((s, value) => document.querySelector(s)?.title === value, 'active source ' + value, activeTab, value);
    await visible(editor);
  }

  async function cursor(line, column) {
    await wait((s, expected) => document.querySelector(s)?.textContent === expected,
      'cursor ' + line + ':' + column, status, 'Ln ' + line + ', Col ' + column);
  }

  async function focusEditor() {
    await visible(editor);
    await evaluate(s => document.querySelector(s).focus(), editor);
  }

  async function replace(text) {
    await focusEditor();
    await key('a', 'KeyA', 65, 2);
    await cdp.send('Input.insertText', { text });
    await wait(s => !!document.querySelector(s + ' [aria-label="unsaved changes"]'), 'source text changed', activeTab);
  }

  async function jump(value, target) {
    await click('.toolbar-quick-open');
    await visible(palette);
    await change(query, value);
    await change(location, target);
    await wait((s, value) => document.querySelector(s + ' .nav-result-name')?.textContent === value,
      'selected exact source', palette, value);
    await click(palette + ' [role="option"]');
    await wait(s => !document.querySelector(s), 'Quick Open closed', palette);
    await wait((s, value) => document.querySelector(s)?.title === value, 'jump target active', activeTab, value);
  }

  const longText = Array.from({ length: 180 }, (_, index) =>
    'line_' + String(index + 1).padStart(3, '0') + ' = 12345;').join('\n');
  let long;
  let short;

  await step('Editor remembers independent cursor and scroll position across tab switches', async () => {
    long = await newTab();
    await replace(longText);
    await jump(long, '150:8');
    await cursor(150, 8);
    await wait(() => document.querySelector('.monaco-editor .view-lines')?.textContent.includes('line_150'),
      'long source target visible');
    short = await newTab();
    await cursor(1, 1);
    await replace('alpha\nbeta\ngamma');
    await jump(short, '2:3');
    await cursor(2, 3);
    await activate(long);
    await cursor(150, 8);
    await wait(() => document.querySelector('.monaco-editor .view-lines')?.textContent.includes('line_150'),
      'restored long source target visible');
    await activate(short);
    await cursor(2, 3);
  });

  await step('Explicit cross-tab navigation overrides a remembered view', async () => {
    await jump(long, '12:4');
    await cursor(12, 4);
    await wait(() => document.querySelector('.monaco-editor .view-lines')?.textContent.includes('line_012'),
      'explicit jump target visible');
    await activate(short);
    await cursor(2, 3);
    await activate(long);
    await cursor(12, 4);
  });

  await step('Restored editor selection remains available for subsequent editing', async () => {
    await jump(short, '2:2');
    await cursor(2, 2);
    await focusEditor();
    await key('ArrowRight', 'ArrowRight', 39, 8);
    await key('ArrowRight', 'ArrowRight', 39, 8);
    await cursor(2, 4);
    await activate(long);
    await cursor(12, 4);
    await activate(short);
    await cursor(2, 4);
    await focusEditor();
    await cdp.send('Input.insertText', { text: 'XX' });
    await wait(() => document.querySelector('.monaco-editor .view-lines')?.textContent.replace(/\u00a0/g, ' ').includes('bXXa'),
      'restored selection replaced precisely');
    assert.equal(await name(), short);
  });

  await step('New and closed tabs do not inherit another editor cursor', async () => {
    const fresh = await newTab();
    await cursor(1, 1);
    const before = await evaluate(s => document.querySelectorAll(s).length, tabs);
    await click(tabSelector(fresh) + ' .tab-close');
    await wait((s, count) => document.querySelectorAll(s).length === count, 'clean temporary tab closed', tabs, before - 1);
    const other = await newTab();
    assert.notEqual(other, fresh);
    await cursor(1, 1);
    await click(tabSelector(other) + ' .tab-close');
    await activate(long);
    await cursor(12, 4);
  });
}
