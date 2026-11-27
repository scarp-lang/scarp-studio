import assert from 'node:assert/strict';

/** Exercises real controls in the isolated browser used by settings-browser-smoke.
 * The preceding scenarios leave a blank untitled buffer and known preferences.
 * No native filesystem or compiler operation is invoked.
 */
export async function advancedSettingsSmoke({ evaluate, wait, visible, click, button, change, category, stored, step, cdp }) {
  const disabledButton = (scope, label) => wait((scope, label) =>
    [...document.querySelectorAll(scope + ' button')].some(node =>
      node.textContent.trim() === label && node.disabled && !node.closest('[hidden]')),
  'disabled ' + label, scope, label);
  const textValue = selector => evaluate(s => document.querySelector(s).value, selector);
  let shortcutBackup;
  let snippetBackup;
  const snippetBody = 'bind {{1:name}} = 42;\nprint({{1}});{{0}}';

  await step('shortcut backup rejects changes to fixed commands', async () => {
    await category('Keyboard shortcuts');
    await button('Manage shortcut backup');
    await button('Export shortcuts');
    shortcutBackup = JSON.parse(await textValue('#studio-shortcut-export'));
    assert.equal(shortcutBackup.format, 'scarp-studio.shortcuts');
    assert.equal(shortcutBackup.bindings.new, 'Ctrl+Alt+Shift+K');
    const bad = structuredClone(shortcutBackup);
    bad.bindings.settings = null;
    await change('#studio-shortcut-import', JSON.stringify(bad));
    await button('Review shortcut import');
    await visible('.shortcut-transfer-panel [role="alert"]');
    assert.equal(await evaluate(() => !!document.querySelector('[aria-label="Confirm shortcut transfer"]')), false);
    await stored('studio.shortcuts.v1', ['bindings', 'new'], 'Ctrl+Alt+Shift+K');
  });

  await step('shortcut backup applies reviewed changes and restores previous bindings', async () => {
    const incoming = structuredClone(shortcutBackup);
    incoming.bindings.save = 'Ctrl+Alt+Shift+Y';
    incoming.bindings.open = null;
    await change('#studio-shortcut-import', JSON.stringify(incoming));
    await button('Review shortcut import');
    await visible('[aria-label="Confirm shortcut transfer"]');
    await button('Confirm shortcut import');
    await stored('studio.shortcuts.v1', ['bindings', 'save'], 'Ctrl+Alt+Shift+Y');
    await stored('studio.shortcuts.v1', ['bindings', 'open'], null);
    await button('Review undo shortcut import');
    await button('Confirm shortcut undo');
    await stored('studio.shortcuts.v1', ['bindings', 'save'], shortcutBackup.bindings.save);
    await stored('studio.shortcuts.v1', ['bindings', 'open'], shortcutBackup.bindings.open);
    await stored('studio.shortcuts.v1', ['bindings', 'new'], 'Ctrl+Alt+Shift+K');
  });

  await step('snippet editor validates reserved prefixes and previews numbered placeholders', async () => {
    await category('IntelliSense and language assistance');
    await button('Manage snippet library');
    await change('#user-snippet-prefix', 'print');
    await change('#user-snippet-name', 'Browser helper');
    await change('#user-snippet-description', 'Disposable smoke fixture');
    await change('#user-snippet-body', snippetBody);
    await disabledButton('.user-snippet-panel', 'Review save snippet');
    await change('#user-snippet-prefix', 'browser_helper');
    await wait(() => document.querySelector('.snippet-preview pre')?.textContent === 'bind name = 42;\nprint(name);',
      'expanded snippet preview');
    await button('Review save snippet');
    await visible('[aria-label="Confirm snippet library changes"]');
    await button('Confirm snippet action');
    await stored('studio.userSnippets.v1', ['snippets', '0', 'prefix'], 'browser_helper');
    await button('Export snippet library');
    snippetBackup = JSON.parse(await textValue('#user-snippet-export'));
    assert.equal(snippetBackup.snippets.length, 1);
    assert.equal(snippetBackup.snippets[0].body, snippetBody);
  });

  await step('snippet import preserves existing text when prefixes conflict', async () => {
    const incoming = structuredClone(snippetBackup);
    incoming.snippets[0].body = 'print(999);';
    incoming.snippets.push({
      prefix: 'browser_other',
      name: 'Other browser helper',
      description: 'Second disposable fixture',
      body: 'print(123);',
      enabled: true,
    });
    await button('Import snippets');
    await change('#user-snippet-import', JSON.stringify(incoming));
    await button('Review snippet import');
    await wait(() => document.querySelector('[aria-label="Confirm snippet library changes"]')?.textContent.includes('1 additions · 1 conflicts'),
      'snippet merge conflict review');
    await button('Confirm snippet action');
    await stored('studio.userSnippets.v1', ['snippets', '0', 'body'], snippetBody);
    await stored('studio.userSnippets.v1', ['snippets', '1', 'prefix'], 'browser_other');
    await button('Edit browser_other');
    await click('.snippet-editor input[type="checkbox"]');
    await button('Review save snippet');
    await button('Confirm snippet action');
    await stored('studio.userSnippets.v1', ['snippets', '1', 'enabled'], false);
  });

  await step('selective preference audit reset preserves unselected settings', async () => {
    await category('Studio preference transfer');
    await button('Inspect portable preferences');
    await change('#preference-audit-search', 'line height');
    await click('input[aria-label="Reset Line height"]');
    await button('Review selected preference reset');
    await visible('[aria-label="Confirm selected preference reset"]');
    await button('Confirm selected reset');
    await category('Code editor');
    if (!await evaluate(() => !document.querySelector('#editor-experience-content').hidden)) {
      await button('Configure advanced editor experience');
    }
    await wait(() => document.querySelector('#editor-experience-lineHeight')?.value === '0',
      'line height restored');
    await category('Appearance');
    assert.equal(await textValue('#studio-theme'), 'light');
    assert.equal(await textValue('#studio-contrast'), 'high');
    await category('Files and Auto Save');
    assert.equal(await evaluate(() => document.querySelector('#studio-auto-save').checked), false);
    await category('Studio preference transfer');
    await button('Show copyable preference report');
    const report = await textValue('#preference-audit-report');
    assert.match(report, /Scope: allowlisted portable preferences only/);
    assert.doesNotMatch(report, /browser_helper|Disposable smoke fixture|print\(name\)/);
  });

  await step('history field restore preserves subsequent edits in the same category', async () => {
    await category('Code editor');
    const initialFont = await textValue('#editor-font-size');
    const changedFont = initialFont === '18' ? '20' : '18';
    await change('#editor-font-size', changedFont);
    if (!await evaluate(() => !document.querySelector('#editor-experience-content').hidden)) {
      await button('Configure advanced editor experience');
    }
    await change('#editor-experience-lineHeight', 28);
    await category('Studio preference transfer');
    if (await evaluate(() => document.querySelector('#preference-history-content').hidden)) {
      await button('Browse preference history');
    }
    await wait(() => Array.from(document.querySelectorAll('.history-entries button')).some(
      b => b.querySelector('strong')?.textContent === 'Font size'), 'font-size history entry');
    await evaluate(() => Array.from(document.querySelectorAll('.history-entries button')).find(
      b => b.querySelector('strong')?.textContent === 'Font size').click());
    await change('#history-endpoint', 'before');
    await button('Review recorded fields only');
    const review = '[aria-label="Confirm historical preference restore"]';
    await visible(review);
    const changes = await evaluate(s => Array.from(document.querySelectorAll(s + ' li')).map(node => node.textContent), review);
    assert.equal(changes.length, 1);
    assert.match(changes[0], /Font size/);
    assert.doesNotMatch(changes[0], /Line height/);
    await button('Confirm historical restore');
    await category('Code editor');
    assert.equal(await textValue('#editor-font-size'), initialFont);
    if (!await evaluate(() => !document.querySelector('#editor-experience-content').hidden)) {
      await button('Configure advanced editor experience');
    }
    assert.equal(await textValue('#editor-experience-lineHeight'), '28');
  });

  await step('explicit snippet insertion edits the active buffer and can be undone', async () => {
    await click('.settings-toggle');
    await visible('.monaco-editor .view-lines');
    await click('button[title="Commands (Ctrl+Shift+P)"]');
    await change('input[aria-label="Search editor commands"]', 'browser_helper');
    await wait(() => document.querySelector('#studio-navigation-option-0 .nav-result-name')?.textContent ===
      'Insert user snippet: Browser helper', 'snippet command result');
    await click('#studio-navigation-option-0');
    await wait(() => document.querySelector('.status-notice')?.textContent.includes('Inserted user snippet defaults: browser_helper'),
      'snippet inserted status');
    const editorText = () => evaluate(() => document.querySelector('.monaco-editor .view-lines')?.textContent.replace(/\u00a0/g, ' '));
    await wait(() => document.querySelector('.monaco-editor .view-lines')?.textContent.replace(/\u00a0/g, ' ').includes('bind name = 42;'),
      'expanded text in editor');
    assert.match(await editorText(), /print\(name\);/);
    const event = { key: 'z', code: 'KeyZ', modifiers: 2, windowsVirtualKeyCode: 90, nativeVirtualKeyCode: 90 };
    await cdp.send('Input.dispatchKeyEvent', { ...event, type: 'keyDown' });
    await cdp.send('Input.dispatchKeyEvent', { ...event, type: 'keyUp' });
    await wait(() => !document.querySelector('.monaco-editor .view-lines')?.textContent.includes('bind'),
      'editor undo');
  });
  await step('source quality cleanup reviews selected changes and supports guarded undo', async () => {
    // Use a real editor input event, not a synthetic internal App state write.
    await cdp.send('Input.insertText', { text: 'print(7);  ' });
    const panel = '.quality-panel';
    // The disclosure includes a decorative arrow, so use its stable selector.
    if (await evaluate(() => document.querySelector('#scarp-explorer').classList.contains('sidebar-hidden'))) {
      await click('button[aria-controls="scarp-explorer"]');
    }
    await click(panel + ' .insights-toggle');
    await wait(() => document.querySelector('.quality-findings')?.textContent.includes('Trailing whitespace'),
      'source quality finds trailing spaces');
    await button('Select matching cleanup', panel);
    await button('Review selected cleanup', panel);
    const confirmation = '[aria-label="Confirm source quality cleanup"]';
    await visible(confirmation);
    await wait(selector => document.querySelector(selector)?.textContent.includes('2 cleanup finding(s)'),
      'two reviewed changes', confirmation);
    await button('Confirm cleanup', panel);
    await wait(() => document.querySelector('.quality-findings')?.textContent.includes('No matching observations'),
      'cleaned editor source');
    await button('Undo last quality cleanup', panel);
    await wait(() => document.querySelector('.quality-findings')?.textContent.includes('Trailing whitespace'),
      'cleanup restored');
    await button('Show copyable quality report', panel);
    const report = await textValue('textarea[aria-label="Source quality report"]');
    assert.match(report, /Trailing whitespace/);
    assert.doesNotMatch(report, /print\(7\)/);
  });

  await step('workspace symbol explorer indexes declarations and call-like sites without editing source', async () => {
    // Reuse the existing open buffer after the quality test. Navigate to
    // the editor and replace its disposable text using real input events.
    await evaluate(() => document.querySelector('.monaco-editor textarea').focus());
    const selectAll = { key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65 };
    await cdp.send('Input.dispatchKeyEvent', { ...selectAll, type: 'keyDown' });
    await cdp.send('Input.dispatchKeyEvent', { ...selectAll, type: 'keyUp' });
    await cdp.send('Input.insertText', { text: 'funcra helper() { print(1); }\nhelper();\nbind count = 1;\n' });
    const scope = '.workspace-symbols';
    await click(scope + ' .insights-toggle');
    await wait(() => document.querySelector('.symbol-list')?.textContent.includes('helper'), 'helper declaration indexed');
    await change('input[aria-label="Search workspace symbols"]', 'count');
    await wait(() => document.querySelector('.symbol-list')?.textContent.includes('count') &&
      !document.querySelector('.symbol-list')?.textContent.includes('helper'), 'symbol search filters declaration list');
    await change('input[aria-label="Search workspace symbols"]', '');
    await button('Call sites', scope);
    await change('input[aria-label="Search workspace symbols"]', 'helper');
    await wait(() => document.querySelector('.symbol-list')?.textContent.includes('One matching function name'), 'call name candidate');
    await click('.symbol-list button');
    await visible('[aria-label="Selected symbol name details"]');
    assert.match(await evaluate(() => document.querySelector('.symbol-detail').textContent), /Outside indexed function body/);
    await button('Declarations', scope);
    await button('Show copyable symbol report', scope);
    const exported = await textValue('textarea[aria-label="Workspace symbol report"]');
    assert.match(exported, /Function helper/);
    assert.doesNotMatch(exported, /print\(1\)/);
  });

  await step('session checkpoint capture, reviewed restore, undo and removal use open buffers only', async () => {
    const panel = '.source-checkpoints';
    await click(panel + ' .insights-toggle');
    await change('input[aria-label="Checkpoint label"]', 'Before browser edit');
    await button('Review checkpoint capture', panel);
    await button('Confirm checkpoint capture', panel);
    await wait(() => document.querySelector('.checkpoint-list')?.textContent.includes('Before browser edit'), 'checkpoint captured');
    await evaluate(() => document.querySelector('.monaco-editor textarea').focus());
    const selectAll = { key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65 };
    await cdp.send('Input.dispatchKeyEvent', { ...selectAll, type: 'keyDown' });
    await cdp.send('Input.dispatchKeyEvent', { ...selectAll, type: 'keyUp' });
    await cdp.send('Input.insertText', { text: 'print(99);\n' });
    await wait(() => document.querySelector('.monaco-editor .view-lines')?.textContent.includes('print(99)'), 'checkpoint test changed source');
    await click('.checkpoint-list button');
    await button('Review checkpoint restore', panel);
    await visible('[aria-label="Confirm checkpoint restore"]');
    await button('Confirm checkpoint restore', panel);
    await wait(() => document.querySelector('.monaco-editor .view-lines')?.textContent.includes('helper'), 'checkpoint restored');
    await button('Undo last checkpoint restore', panel);
    await wait(() => document.querySelector('.monaco-editor .view-lines')?.textContent.includes('print(99)'), 'checkpoint restore undone');
    await button('Review checkpoint removal', panel);
    await button('Confirm checkpoint removal', panel);
    await wait(() => !document.querySelector('.checkpoint-list'), 'checkpoint removed');
    assert.match(await evaluate(() => document.querySelector('.monaco-editor .view-lines').textContent), /print\(99\)/);
  });

  await step('compiler activity history requires explicit recording mode and stays off after reload', async () => {
    await button('History', '.results-view-switch');
    const panel = '.compiler-activity-panel';
    await visible(panel);
    assert.match(await evaluate(() => document.querySelector('.compiler-activity-panel').textContent), /Recording off/);
    await change('#compiler-activity-mode', 'output');
    await visible('[aria-label="Confirm compiler activity mode"]');
    await button('Cancel recording mode', panel);
    assert.equal(await textValue('#compiler-activity-mode'), 'off');
    await change('#compiler-activity-mode', 'metadata');
    await button('Confirm recording mode', panel);
    assert.equal(await textValue('#compiler-activity-mode'), 'metadata');
    await button('Show metadata report', panel);
    const report = await textValue('textarea[aria-label="Compiler activity metadata report"]');
    assert.match(report, /Records shown: 0/);
    assert.match(report, /No source text, input, executable paths or raw output included/);
    await cdp.send('Page.reload', { ignoreCache: true });
    await wait(() => document.readyState === 'complete' && !!document.querySelector('.results-view-switch'), 'reload for activity privacy');
    await button('History', '.results-view-switch');
    await wait(() => document.querySelector('#compiler-activity-mode')?.value === 'off', 'history disabled after reload');
    assert.match(await evaluate(() => document.querySelector('.compiler-activity-panel').textContent), /No matching recorded invocations/);
  });

  await step('session input presets review apply and undo without starting a compiler', async () => {
    await change('#scarp-stdin', '42\nfirst reply\n');
    await button('Manage input presets', '.input-presets');
    const scope = '.input-presets';
    await change('input[aria-label="Input preset label"]', 'Practice fixture');
    await button('Review save input preset', scope);
    await button('Confirm input preset capture', scope);
    await wait(() => document.querySelector('.input-preset-list')?.textContent.includes('Practice fixture'), 'input preset saved');
    await change('#scarp-stdin', 'new reply');
    await button('Review apply input preset', scope);
    await button('Confirm apply input preset', scope);
    await wait(() => document.querySelector('#scarp-stdin')?.value === '42\nfirst reply\n', 'preset applied');
    await button('Undo last preset apply', scope);
    await wait(() => document.querySelector('#scarp-stdin')?.value === 'new reply', 'input undo');
    await button('Review remove input preset', scope);
    await button('Confirm remove input presets', scope);
    await wait(() => document.querySelector('.input-preset-list')?.textContent.includes('No matching session presets'), 'input preset removed');
    assert.equal(await textValue('#scarp-stdin'), 'new reply');
  });

  await step('navigation trail replays requested symbol jumps and clears only after review', async () => {
    await visible('.monaco-editor .view-lines');
    await evaluate(() => document.querySelector('.monaco-editor textarea').focus());
    await cdp.send('Input.insertText', { text: 'bind first = 1;\nbind second = 2;\nbind third = 3;\n' });
    if (await evaluate(() => document.querySelector('#scarp-explorer').classList.contains('sidebar-hidden'))) {
      await click('button[aria-controls="scarp-explorer"]');
    }
    await click('.workspace-symbols .insights-toggle');
    await wait(() => document.querySelectorAll('.workspace-symbols .symbol-entry').length === 3, 'three indexed declarations');
    await click('.workspace-symbols .symbol-entry:nth-child(1)');
    await click('.workspace-symbols .symbol-entry:nth-child(2)');
    const panel = '.navigation-trail';
    await click(panel + ' .insights-toggle');
    await wait(() => document.querySelector('.trail-list button[aria-current="location"] strong')?.textContent.includes(':2:'), 'second declaration recorded');
    await button('Back in navigation trail', panel);
    await wait(() => document.querySelector('.trail-list button[aria-current="location"] strong')?.textContent.includes(':1:'), 'back selects first declaration');
    await button('Forward in navigation trail', panel);
    await wait(() => document.querySelector('.trail-list button[aria-current="location"] strong')?.textContent.includes(':2:'), 'forward selects second declaration');
    await button('Review clear navigation trail', panel);
    await visible('[aria-label="Confirm clear navigation trail"]');
    await button('Confirm clear navigation trail', panel);
    await wait(() => document.querySelector('.navigation-trail-current')?.textContent === 'No recorded location', 'trail cleared');
    assert.match(await evaluate(() => document.querySelector('.monaco-editor .view-lines').textContent), /third/);
  });

  await step('output inspection searches displayed output without creating diagnostics', async () => {
    await button('Output', '.results-view-switch');
    const before = await evaluate(() => document.querySelector('.compiler-output')?.textContent);
    await button('Inspect', '.results-view-switch');
    await visible('.output-inspection-panel');
    await change('input[aria-label="Find compiler output text"]', 'zz-no-such-output-match-zz');
    await wait(() => document.querySelector('.output-search-summary')?.textContent.includes('0 occurrence(s)'), 'literal output search');
    await button('Clear output search', '.output-inspection-panel');
    await button('Review copyable output excerpt', '.output-inspection-panel');
    await visible('textarea[aria-label="Selected compiler output excerpt"]');
    const excerpt = await textValue('textarea[aria-label="Selected compiler output excerpt"]');
    assert.ok(before.includes(excerpt));
    await button('Output', '.results-view-switch');
    assert.equal(await evaluate(() => document.querySelector('.compiler-output')?.textContent), before);
  });

  await step('reviewed line transformation applies and undoes exact selected source', async () => {
    await evaluate(() => document.querySelector('.monaco-editor textarea').focus());
    const selectAll = { key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65 };
    await cdp.send('Input.dispatchKeyEvent', { ...selectAll, type: 'keyDown' });
    await cdp.send('Input.dispatchKeyEvent', { ...selectAll, type: 'keyUp' });
    await cdp.send('Input.insertText', { text: '// zebra\n// apple\n// outside\n' });
    const panel = '.line-range-tools';
    await click(panel + ' .insights-toggle');
    await change('input[aria-label="First transformation line"]', '1');
    await change('input[aria-label="Last transformation line"]', '2');
    await button('Review line transformation', panel);
    await visible('[aria-label="Confirm line transformation"]');
    assert.match(await evaluate(() => document.querySelector('[aria-label="After transformation"]').textContent), /apple.*zebra/s);
    await button('Confirm line transformation', panel);
    await wait(() => /apple.*zebra.*outside/s.test(document.querySelector('.monaco-editor .view-lines')?.textContent ?? ''), 'selected lines sorted');
    await button('Undo last line transformation', panel);
    await wait(() => /zebra.*apple.*outside/s.test(document.querySelector('.monaco-editor .view-lines')?.textContent ?? ''), 'exact original source restored');
  });
  await step('selected identifier edits leave comments and string literals unchanged and support undo', async () => {
    await evaluate(() => document.querySelector('.monaco-editor textarea').focus());
    const selectAll = { key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65 };
    await cdp.send('Input.dispatchKeyEvent', { ...selectAll, type: 'keyDown' });
    await cdp.send('Input.dispatchKeyEvent', { ...selectAll, type: 'keyUp' });
    await cdp.send('Input.insertText', { text: 'bind old_counter = 1;\nprint(old_counter);\n// old_counter\nprint("old_counter");\n' });
    const panel = '.identifier-edit';
    await click(panel + ' .insights-toggle');
    await change('input[aria-label="Existing code identifier"]', 'old_counter');
    await change('input[aria-label="Replacement code identifier"]', 'new_counter');
    await button('Scan identifier sites', panel);
    await wait(() => document.querySelectorAll('.identifier-site').length === 2, 'two code token sites');
    await button('Select all reviewed sites', panel);
    await button('Review selected identifier edits', panel);
    await click('[aria-label="Confirm identifier edits"] input[type="checkbox"]');
    await button('Confirm identifier edits', panel);
    await wait(() => /new_counter.*new_counter.*old_counter.*old_counter/s.test(document.querySelector('.monaco-editor .view-lines')?.textContent ?? ''), 'literal identifier edits');
    await button('Undo last identifier edits', panel);
    await wait(() => !document.querySelector('.monaco-editor .view-lines')?.textContent.includes('new_counter'), 'identifier edits undone');
  });
  await step('open-buffer comparison transfers selected text from a second open source', async () => {
    // Compare with the initial empty saved snapshot of the unsaved browser tab.
    const panel = '.open-buffer-comparison';
    await click(panel + ' .insights-toggle');
    const target = await textValue('select[aria-label="Target buffer"]');
    await change('select[aria-label="Reference buffer"]', target);
    await change('select[aria-label="Reference version"]', 'saved');
    await button('Compare selected snapshots', panel);
    await button('Review exact transfer blocks', panel);
    await visible('.buffer-transfer-block');
    await button('Select all transfer blocks', panel);
    await button('Review selected transfer', panel);
    await button('Confirm buffer transfer', panel);
    await wait(() => !document.querySelector('.monaco-editor .view-lines')?.textContent.includes('old_counter'), 'working text replaced by saved snapshot');
    await button('Undo last buffer transfer', panel);
    await wait(() => document.querySelector('.monaco-editor .view-lines')?.textContent.includes('old_counter'), 'working buffer restored');
  });
}
