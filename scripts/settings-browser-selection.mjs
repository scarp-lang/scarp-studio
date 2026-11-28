import assert from 'node:assert/strict';

/** Run after the existing browser Settings/Explorer scenarios. These are
 * real UI interactions in the existing isolated Chromium harness. No
 * native compiler invocation, filesystem permission or mocked save occurs.
 */
export async function selectionAndCommandSmoke({ evaluate, wait, visible, click, button, change, category, step, cdp }) {
  const palette = '[aria-label="Scarp Studio commands"]';
  const search = 'input[aria-label="Search editor commands"]';
  const collection = 'select[aria-label="Command palette collection"]';
  const panel = '.selection-edit';
  const commandSettings = '.command-library-settings';
  const openPalette = async () => {
    await click('button[title="Commands (Ctrl+Shift+P)"]');
    await visible(palette);
  };
  const closePalette = async () => {
    await click(palette + ' button[aria-label="Close navigation"]');
    await wait(() => !document.querySelector('[aria-label="Scarp Studio commands"]'), 'command dialog dismissed');
  };
  const resultNames = () => evaluate(() =>
    [...document.querySelectorAll('#studio-navigation-results .nav-result-name')].map(node=>node.textContent));
  const key = async (key, code, virtual, modifiers=0) => {
    const event = {key,code,modifiers,windowsVirtualKeyCode:virtual,nativeVirtualKeyCode:virtual};
    await cdp.send('Input.dispatchKeyEvent',{...event,type:'keyDown'});
    await cdp.send('Input.dispatchKeyEvent',{...event,type:'keyUp'});
  };
  const selectAll = async () => {
    await evaluate(() => document.querySelector('.monaco-editor textarea').focus());
    await key('a','KeyA',65,2);
  };
  const replaceEditor = async text => {
    await selectAll();
    await cdp.send('Input.insertText',{text});
    await wait(expected => document.querySelector('.monaco-editor .view-lines')?.textContent.replace(/\u00a0/g,' ').includes(expected),
      'test source visible',text.split('\n')[0]);
  };
  const textContains = expected => wait(value =>
    document.querySelector('.monaco-editor .view-lines')?.textContent.replace(/\u00a0/g,' ').includes(value),
  'editor contains '+expected,expected);
  const collectionChange = async value => {
    await change(collection,value);
    await wait(value=>document.querySelector('select[aria-label="Command palette collection"]')?.value===value,
      'collection switched',value);
  };

  await step('command palette category isolates built-in compiler commands',async()=>{
    await openPalette();
    await collectionChange('Compiler');
    await wait(() => document.querySelectorAll('#studio-navigation-results [role="option"]').length===6,'compiler command count');
    const names=await resultNames();
    assert.ok(names.includes('Verify Current Scarp Source'));
    assert.ok(names.includes('Select Trusted Scarp Compiler'));
    assert.ok(!names.includes('New Scarp File'));
    await collectionChange('Snippets');
    await change(search,'browser_helper');
    await wait(() => document.querySelector('#studio-navigation-option-0 .nav-result-name')?.textContent===
      'Insert user snippet: Browser helper','user snippet category');
    assert.equal(await evaluate(() => [...document.querySelectorAll('.nav-collection-controls button')].every(node=>node.disabled)),true);
    await closePalette();
  });
  await step('pinning is an explicit non-executing action and pinned filtering retains commands',async()=>{
    await openPalette();
    await change(search,'Toggle Dark / Light Theme');
    await wait(() => document.querySelector('#studio-navigation-option-0 .nav-result-name')?.textContent==='Toggle Dark / Light Theme','theme command');
    const theme=await evaluate(()=>document.documentElement.getAttribute('data-theme'));
    await button('Pin selected',palette);
    await wait(()=>document.querySelector('#studio-navigation-option-0 .nav-result-detail')?.textContent.includes('Pinned'),'pinned label');
    assert.equal(await evaluate(()=>document.documentElement.getAttribute('data-theme')),theme);
    await change(search,'');
    await collectionChange('pinned');
    assert.deepEqual(await resultNames(),['Toggle Dark / Light Theme']);
    await closePalette();
  });
  await step('palette focus cycle includes collection and pin controls without running a command',async()=>{
    await openPalette();
    await change(search,'Open Studio Settings');
    await evaluate(s=>document.querySelector(s).focus(),search);
    await key('Tab','Tab',9);
    assert.equal(await evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Close navigation');
    await key('Tab','Tab',9);
    assert.equal(await evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Command palette collection');
    await key('Tab','Tab',9);
    assert.match(await evaluate(()=>document.activeElement?.textContent),/Pin selected/);
    await key('Tab','Tab',9);
    assert.equal(await evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Search editor commands');
    await key('Tab','Tab',9,8);
    assert.match(await evaluate(()=>document.activeElement?.textContent),/Pin selected/);
    await closePalette();
  });
  await step('recent selection and settings manage exact pinned command order',async()=>{
    await openPalette();
    await change(search,'Open Studio Settings');
    await wait(()=>document.querySelector('#studio-navigation-option-0 .nav-result-name')?.textContent==='Open Studio Settings','settings command');
    await button('Pin selected',palette);
    await click('#studio-navigation-option-0');
    await visible('#editor-settings');
    await category('Keyboard shortcuts');
    await button('Manage command palette collections');
    await wait(()=>document.querySelectorAll('.command-pin-list li').length===2,'two pinned commands');
    await click('button[aria-label="Move Open Studio Settings earlier"]');
    assert.deepEqual(await evaluate(()=>[...document.querySelectorAll('.command-pin-list li > span')].map(node=>node.textContent)),
      ['Open Studio Settings','Toggle Dark / Light Theme']);
    await button('Review clear pinned commands',commandSettings);
    await visible('[aria-label="Review clearing command collection"]');
    await button('Cancel','[aria-label="Review clearing command collection"]');
    assert.equal(await evaluate(()=>document.querySelectorAll('.command-pin-list li').length),2);
    await button('Review clear pinned commands',commandSettings);
    await button('Confirm clear','[aria-label="Review clearing command collection"]');
    await wait(()=>document.querySelectorAll('.command-pin-list li').length===0,'pinned commands cleared');
    await click('.settings-toggle');
    await openPalette();
    await collectionChange('recent');
    assert.equal((await resultNames())[0],'Open Studio Settings');
    await closePalette();
  });
  await step('reviewed selection surround changes only the editor buffer and supports undo',async()=>{
    await replaceEditor('alpha');
    await selectAll();
    await click(panel+' .insights-toggle');
    await button('Capture editor selections',panel);
    await wait(panelSelector=>document.querySelector(panelSelector)?.textContent.includes('1 captured range(s)'),'captured range',panel);
    await button('Review selection transformation',panel);
    await visible('[aria-label="Confirm selection transformation"]');
    const preview=await evaluate(()=>document.querySelector('[aria-label="Confirm selection transformation"]').textContent);
    assert.match(preview,/alpha/);
    assert.match(preview,/\(alpha\)/);
    await button('Confirm selection transformation',panel);
    await textContains('(alpha)');
    await button('Undo last selection transformation',panel);
    await textContains('alpha');
    assert.equal(await evaluate(()=>document.querySelector('.monaco-editor .view-lines')?.textContent),'alpha');
  });
  await step('changed live selection rejects confirmation without touching the source',async()=>{
    await selectAll();
    await button('Capture editor selections',panel);
    await button('Review selection transformation',panel);
    await visible('[aria-label="Confirm selection transformation"]');
    await evaluate(()=>document.querySelector('.monaco-editor textarea').focus());
    await key('ArrowRight','ArrowRight',39);
    await button('Confirm selection transformation',panel);
    await wait(selector=>document.querySelector(selector)?.textContent.includes('Selection edit rejected'),'stale live selection',panel);
    assert.equal(await evaluate(()=>document.querySelector('.monaco-editor .view-lines')?.textContent),'alpha');
  });
}
