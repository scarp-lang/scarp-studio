import assert from 'node:assert/strict';
import { labeled, testId } from './search-browser-driver.mjs';

const fixture = labeled('Explorer interaction fixture');
const explorer = labeled('Explorer under test');
const scope = explorer + ' ' + labeled('Browse listed folder');
const query = explorer + ' ' + labeled('Filter listed Scarp sources');
const filter = explorer + ' ' + labeled('Show project files by editor state');
const root = 'C:/fixture-private-explorer/';
const activePath = root + 'basic_tuple/src/deep/math.srp';
const folder = directory => explorer + ' [data-explorer-row=' + JSON.stringify('folder:' + directory) + ']';
const source = name => explorer + ' [data-explorer-row=' + JSON.stringify('source:' + root + name) + ']';

async function visibleSources(d, expected) {
  await d.wait('visible Explorer sources: ' + expected.join(', '), (parent, names, prefix) => {
    const actual = [...document.querySelectorAll(parent + ' button.explorer-source')]
      .filter(button => !button.closest('[hidden]') && button.getClientRects().length)
      .map(button => button.dataset.explorerRow.slice('source:'.length + prefix.length));
    return JSON.stringify(actual) === JSON.stringify(names);
  }, explorer, expected, root);
}

async function expanded(d, directory, value) {
  await d.wait('folder ' + directory + ' expanded=' + value, (selector, expected) =>
    document.querySelector(selector)?.getAttribute('aria-expanded') === String(expected), folder(directory), value);
}

async function focusIs(d, selector) {
  await d.wait('Explorer focus ' + selector, s => document.activeElement === document.querySelector(s), selector);
}

async function press(d, selector, key, modifiers = {}) {
  await d.visible(selector);
  return d.evaluate((s, key, mods) => {
    const button = document.querySelector(s);
    if (!(button instanceof HTMLButtonElement) || button.disabled) throw Error('Unavailable navigation row');
    button.focus();
    return !button.dispatchEvent(new KeyboardEvent('keydown', {
      key, bubbles: true, cancelable: true, ...mods,
    }));
  }, selector, key, modifiers);
}

async function reset(d) {
  await d.button(fixture, 'Reset Explorer fixture');
  await d.valueIs(scope, 'w');
  await d.contains(testId('explorer-open-requests'), '[]');
}

const tupleFiles = [
  'basic_tuple/main.srp', 'basic_tuple/src/deep/math.srp', 'basic_tuple/src/deep/other.srp',
];

export async function explorerScenarios(d, step) {
  await step('Explorer scope isolates a nested project and excludes prefix siblings', async () => {
    await reset(d);
    await d.noReads(async () => {
      await d.contains(explorer, '7 listed files');
      await d.contains(explorer, '2 open');
      await d.contains(explorer, '1 modified');
      await d.change(scope, 'fbasic_tuple');
      await visibleSources(d, tupleFiles);
      await d.absent(folder('basic_tuple_extra'));
      await d.visible(folder('basic_tuple/src'));
      await d.check(explorer, 'Include subfolders', false);
      await visibleSources(d, ['basic_tuple/main.srp']);
      await d.absent(folder('basic_tuple/src'));
      await d.check(explorer, 'Include subfolders', true);
      await visibleSources(d, tupleFiles);
      await d.change(filter, 'modified');
      await visibleSources(d, ['basic_tuple/src/deep/math.srp']);
      await d.change(filter, 'all');
      await d.change(query, 'other');
      await visibleSources(d, ['basic_tuple/src/deep/other.srp']);
      await d.button(explorer, 'Clear filters');
      await visibleSources(d, tupleFiles);
      assert.equal(await d.text(testId('explorer-open-requests')), '[]');
    });
  });

  await step('Explorer reveal clears incompatible filters and opens only active ancestors', async () => {
    await reset(d);
    await d.noReads(async () => {
      await d.button(explorer, 'Collapse all');
      await expanded(d, 'basic_tuple', false);
      await expanded(d, 'loops', false);
      await d.change(scope, 'floops');
      await d.change(query, 'main');
      await visibleSources(d, ['loops/main.srp']);
      await d.button(explorer, 'Reveal active file');
      await d.valueIs(scope, 'w');
      await d.valueIs(query, '');
      await expanded(d, 'basic_tuple', true);
      await expanded(d, 'basic_tuple/src', true);
      await expanded(d, 'basic_tuple/src/deep', true);
      await focusIs(d, source('basic_tuple/src/deep/math.srp'));
      await expanded(d, 'basic_tuple_extra', false);
      assert.equal(await d.text(testId('explorer-open-requests')), '[]');
    });
  });

  await step('Explorer stale scopes do not silently broaden to other projects', async () => {
    await reset(d);
    await d.noReads(async () => {
      await d.change(scope, 'fbasic_tuple/src');
      await visibleSources(d, ['basic_tuple/src/deep/math.srp', 'basic_tuple/src/deep/other.srp']);
      await d.button(fixture, 'Remove tuple folder');
      await d.contains(explorer, 'The selected folder is no longer listed');
      await d.valueIs(scope, 'fbasic_tuple/src');
      await visibleSources(d, []);
      await d.buttonDisabled(explorer, 'Reveal active file');
      await d.change(scope, 'w');
      await visibleSources(d, ['main.srp', 'basic_tuple_extra/main.srp', 'loops/main.srp', 'loops/tests/check.srp']);
      await d.button(fixture, 'Restore tuple folder');
      await d.change(scope, 'fbasic_tuple/src');
      await visibleSources(d, ['basic_tuple/src/deep/math.srp', 'basic_tuple/src/deep/other.srp']);
      await d.buttonDisabled(explorer, 'Reveal active file', false);
    });
  });

  await step('Explorer keyboard movement follows visible rows and collapsed descendants', async () => {
    await reset(d);
    await d.noReads(async () => {
      await d.change(scope, 'fbasic_tuple');
      assert.equal(await press(d, folder('basic_tuple'), 'ArrowLeft'), true);
      await expanded(d, 'basic_tuple', false);
      await d.absent(folder('basic_tuple/src'));
      assert.equal(await press(d, folder('basic_tuple'), 'ArrowRight'), true);
      await expanded(d, 'basic_tuple', true);
      await press(d, folder('basic_tuple'), 'ArrowRight');
      await focusIs(d, source('basic_tuple/main.srp'));
      await press(d, source('basic_tuple/main.srp'), 'ArrowDown');
      await focusIs(d, folder('basic_tuple/src'));
      await press(d, folder('basic_tuple/src'), 'End');
      await focusIs(d, source('basic_tuple/src/deep/other.srp'));
      await press(d, source('basic_tuple/src/deep/other.srp'), 'ArrowLeft');
      await focusIs(d, folder('basic_tuple/src/deep'));
      await press(d, folder('basic_tuple/src/deep'), 'Home');
      await focusIs(d, folder('basic_tuple'));
      assert.equal(await press(d, folder('basic_tuple'), 'ArrowDown', { ctrlKey: true }), false);
      await focusIs(d, folder('basic_tuple'));
      assert.equal(await d.text(testId('explorer-open-requests')), '[]');
    });
  });

  await step('Explorer keyboard search skips disabled headings and does not open files', async () => {
    await reset(d);
    await d.noReads(async () => {
      await d.change(query, 'main');
      await visibleSources(d, ['main.srp', 'basic_tuple/main.srp', 'basic_tuple_extra/main.srp', 'loops/main.srp']);
      await press(d, source('main.srp'), 'ArrowDown');
      await focusIs(d, source('basic_tuple/main.srp'));
      await press(d, source('basic_tuple/main.srp'), 'End');
      await focusIs(d, source('loops/main.srp'));
      await press(d, source('loops/main.srp'), 'Home');
      await focusIs(d, source('main.srp'));
      assert.equal(await d.text(testId('explorer-open-requests')), '[]');
      await d.click(source('loops/main.srp'));
      await d.contains(testId('explorer-open-requests'), root + 'loops/main.srp');
      assert.deepEqual(JSON.parse(await d.text(testId('explorer-open-requests'))), [root + 'loops/main.srp']);
    });
  });

  await step('Explorer busy guards preserve project selection and block source activation', async () => {
    await reset(d);
    await d.noReads(async () => {
      await d.check(fixture, 'Explorer native operation busy');
      await d.buttonDisabled(explorer, 'Reveal active file');
      await d.wait('source disabled while busy', s => document.querySelector(s)?.disabled, source('main.srp'));
      await d.wait('project switch disabled while busy', s => document.querySelector(s)?.disabled,
        explorer + ' ' + labeled('Select Scarp project loops'));
      await press(d, folder('basic_tuple'), 'ArrowDown');
      await focusIs(d, folder('basic_tuple/src'));
      assert.equal(await d.text(testId('explorer-selected-project')), 'basic_tuple');
      assert.equal(await d.text(testId('explorer-open-requests')), '[]');
      await d.check(fixture, 'Explorer native operation busy', false);
      await d.click(explorer + ' ' + labeled('Select Scarp project loops'));
      await d.contains(testId('explorer-selected-project'), 'loops');
      await d.button(explorer, 'Reveal active file');
      await focusIs(d, source('basic_tuple/src/deep/math.srp'));
      assert.equal(await d.text(testId('explorer-selected-project')), 'loops');
      assert.equal(await d.text(testId('explorer-open-requests')), '[]');
      assert.equal(await d.evaluate(s => document.activeElement?.dataset.explorerRow === 'source:' + s, activePath), true);
    });
  });
}
