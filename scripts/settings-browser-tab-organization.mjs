import assert from 'node:assert/strict';

/** Browser acceptance through the actual App and editor reducer. The tests
 * use only local untitled buffers and never request a native file dialog. */
export async function tabOrganizationSmoke({ evaluate, wait, visible, click, button, change, step, cdp }) {
  const panel = '[aria-label="Editor tab organization"]';
  const review = panel + ' [aria-label="Review tab sort"]';
  const tabs = '[aria-label="Open source files"] [role="tab"]';
  const activeTab = tabs + '[aria-selected="true"]';
  const newButton = '[aria-label="File actions"] button[title^="New ("]';
  const orderControl = 'select[aria-label="Unpinned tab sort order"]';
  const names = () => evaluate(s => [...document.querySelectorAll(s)].map(node => node.title), tabs);
  const active = () => evaluate(s => document.querySelector(s)?.title, activeTab);
  const pinned = () => evaluate(s => [...document.querySelectorAll(s + '.pinned')].map(node => node.title), tabs);
  const tabSelector = name => tabs + '[title=' + JSON.stringify(name) + ']';
  const disabled = (label, expected = true) => wait((s, label, expected) =>
    [...document.querySelectorAll(s + ' button')].some(node =>
      node.textContent.trim() === label && node.disabled === expected), 'disabled ' + label, panel, label, expected);
  const key = async (key, code, virtual, modifiers = 0) => {
    const event = { key, code, modifiers, windowsVirtualKeyCode: virtual, nativeVirtualKeyCode: virtual };
    await cdp.send('Input.dispatchKeyEvent', { ...event, type: 'keyDown' });
    await cdp.send('Input.dispatchKeyEvent', { ...event, type: 'keyUp' });
  };
  async function newTab() {
    const before = (await names()).length;
    await click(newButton);
    await wait((s, count) => document.querySelectorAll(s).length === count, 'new tab', tabs, before + 1);
    return active();
  }
  async function waitOrder(expected) {
    await wait((s, expected) => JSON.stringify([...document.querySelectorAll(s)].map(node => node.title)) ===
      JSON.stringify(expected), 'tab order ' + expected.join(', '), tabs, expected);
  }
  async function activate(name) {
    await click(tabSelector(name));
    await wait((s, name) => document.querySelector(s)?.title === name, 'active tab ' + name, activeTab, name);
  }
  async function close(name) {
    const before = (await names()).length;
    await click(tabSelector(name) + ' .tab-close');
    await wait((s, count) => document.querySelectorAll(s).length === count, 'close unpinned tab', tabs, before - 1);
  }

  let first;
  let second;
  let third;
  let original;

  await step('Tab tools pin live editors in a leading protected group', async () => {
    original = await names();
    assert.deepEqual(await pinned(), []);
    first = await newTab();
    second = await newTab();
    third = await newTab();
    await button('Pin active tab', panel);
    await waitOrder([third, ...original, first, second]);
    assert.deepEqual(await pinned(), [third]);
    assert.equal(await active(), third);
    assert.equal(await evaluate(s => document.querySelector(s + ' .tab-close')?.disabled, tabSelector(third)), true);
    await activate(first);
    await button('Pin active tab', panel);
    await waitOrder([third, first, ...original, second]);
    assert.deepEqual(await pinned(), [third, first]);
    assert.equal(await active(), first);
  });

  await step('Pinned tabs cannot be closed by the normal keyboard shortcut', async () => {
    const before = await names();
    await evaluate(s => document.querySelector(s).focus(), activeTab);
    await key('w', 'KeyW', 87, 2);
    await wait(() => document.querySelector('.error-banner')?.textContent.includes('Unpin this editor tab before closing'),
      'pinned close rejected');
    assert.deepEqual(await names(), before);
    assert.equal(await active(), first);
    await button('Organize tabs', panel);
    await visible(panel + ' .tab-organization-body');
    await disabled('Move active right');
    await disabled('Move active left', false);
  });

  await step('Tab movement stays within the pinned prefix and keeps active focus', async () => {
    await button('Move active left', panel);
    await waitOrder([first, third, ...original, second]);
    assert.deepEqual(await pinned(), [first, third]);
    assert.equal(await active(), first);
    await disabled('Move active left');
    await disabled('Move active right', false);
    await button('Move active right', panel);
    await waitOrder([third, first, ...original, second]);
    assert.equal(await active(), first);
    await activate(second);
    await disabled('Move active right');
    await button('Move active left', panel);
    const expected = [third, first, ...original.slice(0, -1), second, original.at(-1)];
    await waitOrder(expected);
    assert.deepEqual(await pinned(), [third, first]);
    assert.equal(await active(), second);
  });

  await step('Sort review previews order without saving or moving a tab until confirmed', async () => {
    const before = await names();
    await change(orderControl, 'name');
    await button('Review tab sort', panel);
    await visible(review);
    assert.deepEqual(await names(), before);
    const proposed = await evaluate(s =>
      [...document.querySelectorAll(s + ' .tab-sort-columns > div:nth-child(2) li')].map(node => node.textContent), review);
    assert.deepEqual(proposed.slice(0, 2), [third + ' (pinned)', first + ' (pinned)']);
    await button('Cancel tab sort', review);
    assert.deepEqual(await names(), before);
    await button('Review tab sort', panel);
    await button('Confirm tab sort', review);
    const expected = [third, first, ...before.slice(2).sort((a, b) =>
      a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }))];
    await waitOrder(expected);
    assert.equal(await active(), second);
  });

  await step('Sort confirmation is invalidated by editor changes after review', async () => {
    await activate(second);
    await button('Move active left', panel);
    const before = await names();
    await button('Review tab sort', panel);
    await visible(review);
    await activate(third);
    await wait(s => document.querySelector(s + ' [role="alert"]')?.textContent.includes('editor changed'),
      'stale sort review', review);
    await disabled('Confirm tab sort');
    assert.deepEqual(await names(), before);
    await button('Cancel tab sort', review);
  });

  await step('Unpin restores explicit close without changing other tabs', async () => {
    await activate(third);
    await button('Unpin active tab', panel);
    assert.deepEqual(await pinned(), [first]);
    assert.equal(await evaluate(s => document.querySelector(s + ' .tab-close')?.disabled, tabSelector(third)), false);
    await close(third);
    await activate(first);
    await button('Unpin active tab', panel);
    assert.deepEqual(await pinned(), []);
    await close(first);
    await close(second);
    assert.deepEqual((await names()).sort(), [...original].sort());
    await button('Hide tab tools', panel);
  });
}
