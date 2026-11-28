import assert from 'node:assert/strict';
import { selectors as s, labeled } from './search-browser-driver.mjs';

const name = labeled('Search preset name');
const selected = labeled('Selected search preset');
const query = labeled('Fixture query');
const batch = labeled('Project search batch');
const backup = labeled('Portable search preset backup');
const importBox = labeled('Import search preset backup');
const applyGroup = labeled('Review applying search preset');
const importGroup = labeled('Review importing search presets');

async function save(d, title) {
  await d.change(name, title);
  await d.button(s.presets, 'Add current search as preset');
  await d.contains(s.presets, 'Recorded current search settings.');
}

export async function presetScenarios(d, step) {
  await step('save named settings without reading and reject duplicate name', async () => {
    await d.reset();
    await d.noReads(async () => {
      await d.button(s.scope, 'Configure project search scope');
      await d.change(batch, '1');
      await d.button(s.presets, 'Manage search presets');
      await save(d, 'First batch');
      await d.contains(s.presets, '1 / 24 presets');
      await d.change(name, 'first BATCH');
      await d.button(s.presets, 'Add current search as preset');
      await d.contains(s.presets + ' [role=alert]', 'already exists');
      await d.contains(s.presets, '1 / 24 presets');
      await d.absent(backup);
    });
  });

  await step('apply reviews exact settings, labels, and retires prior result', async () => {
    await d.change(batch, '2');
    await d.change(query, 'buffer');
    await d.check(s.settings, 'Fixture case sensitive', false);
    await d.runSearch();
    await d.noReads(async () => {
      await d.button(s.presets, 'Review applying selected preset');
      await d.visible(applyGroup);
      await d.contains(applyGroup, 'Proposed search settings');
      await d.contains(applyGroup, '4 selected eligible label(s)');
      await d.button(applyGroup, 'Review preset scope labels');
      await d.contains(applyGroup, 'src/a-dense.srp');
      assert.ok(!(await d.text(applyGroup)).includes('/fixture-private/'));
      await d.button(applyGroup, 'Confirm apply search preset');
      await d.valueIs(query, 'needle');
      await d.valueIs(batch, '1');
      await d.absent(s.completed);
      await d.absent(applyGroup);
      await d.contains(s.presets, 'Run Search Project explicitly');
    });
  });

  await step('stale preset review refuses changed controls or listing', async () => {
    await d.noReads(async () => {
      await d.button(s.presets, 'Review applying selected preset');
      await d.change(query, 'changed');
      await d.button(applyGroup, 'Confirm apply search preset');
      await d.contains(s.presets + ' [role=alert]', 'current settings changed');
      await d.valueIs(query, 'changed');
      await d.button(s.presets, 'Review applying selected preset');
      await d.button(s.fixture, 'Add fixture source');
      await d.button(applyGroup, 'Confirm apply search preset');
      await d.contains(s.presets + ' [role=alert]', 'eligible listing changed');
      await d.valueIs(query, 'changed');
    });
  });

  await step('reviewed preset replacement cannot overwrite newer controls', async () => {
    await d.noReads(async () => {
      await d.button(s.presets, 'Review replacing selected preset settings');
      await d.change(query, 'another');
      await d.button(s.presets, 'Confirm replace preset settings');
      await d.contains(s.presets + ' [role=alert]', 'proposed search settings changed');
      await d.button(s.presets, 'Cancel replace preset');
      await d.button(s.presets, 'Review replacing selected preset settings');
      await d.button(s.presets, 'Confirm replace preset settings');
      await d.contains(s.presets, 'Replaced preset settings');
      await d.change(name, 'Renamed batch');
      await d.button(s.presets, 'Rename selected preset');
      await d.contains(s.presets, 'Updated preset name');
    });
  });

  await step('backup is opt-in and selective import preserves conflicts', async () => {
    await d.noReads(async () => {
      await d.check(s.presets, 'Show portable backup including search queries and scope settings');
      const exported = JSON.parse(await d.value(backup));
      assert.equal(exported.format, 'scarp-studio-search-presets');
      assert.equal(exported.version, 1);
      assert.equal(exported.presets.length, 1);
      assert.equal(exported.presets[0].name, 'Renamed batch');
      assert.equal(exported.presets[0].settings.query, 'another');
      const settings = exported.presets[0].settings;
      const incoming = {
        ...exported,
        presets: [
          { name: 'Renamed batch', settings: { ...settings, query: 'conflict' } },
          { name: 'Imported batch', settings: { ...settings, query: 'imported' } },
          { name: 'Unselected batch', settings: { ...settings, query: 'unselected' } },
        ],
      };
      await d.change(importBox, JSON.stringify(incoming));
      await d.button(s.presets, 'Review preset backup import');
      await d.contains(importGroup, 'Name conflict; existing preset retained');
      assert.equal(await d.evaluate(selector => document.querySelector(selector).disabled,
        labeled('Import preset Renamed batch')), true);
      await d.click(labeled('Import preset Imported batch'));
      await d.contains(importGroup, '1 selected');
      await d.button(importGroup, 'Import selected new presets');
      await d.contains(s.presets, '2 / 24 presets');
      const merged = JSON.parse(await d.value(backup));
      assert.deepEqual(merged.presets.map(item => item.name), ['Renamed batch', 'Imported batch']);
      assert.equal(merged.presets[0].settings.query, 'another');
      assert.equal(merged.presets[1].settings.query, 'imported');
      assert.ok(!JSON.stringify(merged).includes('/fixture-private/'));
      await d.check(s.presets, 'Show portable backup including search queries and scope settings', false);
      await d.absent(backup);
    });
  });

  await step('invalid backup and confirmed clearing leave live settings unchanged', async () => {
    await d.noReads(async () => {
      await d.change(importBox, '{"version":99}');
      await d.button(s.presets, 'Review preset backup import');
      await d.contains(s.presets + ' [role=alert]', 'Unsupported search preset backup');
      await d.absent(importGroup);
      await d.change(selected, '2');
      await d.button(s.presets, 'Remove selected preset');
      await d.contains(s.presets, '1 / 24 presets');
      await d.button(s.presets, 'Clear all search presets');
      await d.button(s.presets, 'Cancel clear presets');
      await d.contains(s.presets, '1 / 24 presets');
      await d.button(s.presets, 'Clear all search presets');
      await d.button(s.presets, 'Confirm clear presets');
      await d.contains(s.presets, '0 / 24 presets');
      await d.valueIs(query, 'another');
    });
  });
}
