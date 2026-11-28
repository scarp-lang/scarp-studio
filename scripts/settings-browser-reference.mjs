import assert from 'node:assert/strict';

export async function referenceEditorSmoke({evaluate,wait,visible,click,change,step,cdp}) {
  const tabs = '[aria-label="Open source files"] [role="tab"]';
  const active = tabs + '[aria-selected="true"]';
  const primary = '#scarp-editor-panel';
  const pane = '#scarp-reference-pane';
  const selector = pane + ' [aria-label="Reference source"]';
  const toggle = 'button[aria-controls="scarp-reference-pane"]';
  const editor = primary + ' .monaco-editor textarea';
  const reference = pane + ' .monaco-editor textarea';
  const newButton = '[aria-label="File actions"] button[title^="New ("]';
  const activeName = () => evaluate(s=>document.querySelector(s)?.title,active);
  const count = () => evaluate(s=>document.querySelectorAll(s).length,tabs);
  const tab = name => tabs + '[title=' + JSON.stringify(name) + ']';
  const option = name => evaluate((s,name) => Array.from(document.querySelector(s).options)
    .find(item=>item.textContent.trim()===name || item.textContent.trim()===name+' •')?.value,selector,name);
  async function newTab() {
    const before = await count();
    await click(newButton);
    await wait((s,n)=>document.querySelectorAll(s).length===n,'new reference test tab',tabs,before+1);
    await visible(editor);
    return activeName();
  }
  async function write(text) {
    await evaluate(s=>document.querySelector(s).focus(),editor);
    await cdp.send('Input.insertText',{text});
    await wait((s,text)=>document.querySelector(s+' .view-lines')?.textContent.includes(text),
      'primary buffer text',primary,text);
  }
  async function choose(name) {
    const value = await option(name);
    assert.ok(value,'reference option for '+name);
    await change(selector,value);
  }
  async function hasText(root,text) {
    await wait((s,text)=>document.querySelector(s+' .view-lines')?.textContent.includes(text),
      'visible source '+text,root,text);
  }
  let first,second,empty;
  await step('Reference pane shows an independent live open source',async()=>{
    first=await newTab();
    await write('reference_alpha');
    second=await newTab();
    await write('reference_beta');
    await click(toggle);
    await visible(pane);
    await choose(first);
    await visible(reference);
    await hasText(pane,'reference_alpha');
    await hasText(primary,'reference_beta');
    assert.equal(await activeName(),second);
  });
  await step('Reference editor cannot modify the primary or its own buffer',async()=>{
    await evaluate(s=>document.querySelector(s).focus(),reference);
    await cdp.send('Input.insertText',{text:'FORBIDDEN_INSERT'});
    await hasText(pane,'reference_alpha');
    assert.equal(await evaluate(s=>document.querySelector(s+' .view-lines')?.textContent.includes('FORBIDDEN_INSERT'),pane),false);
    assert.equal(await evaluate(s=>document.querySelector(s+' .view-lines')?.textContent.includes('FORBIDDEN_INSERT'),primary),false);
    assert.equal(await activeName(),second);
  });
  await step('Reference layout and swap keep both source identities and contents',async()=>{
    await change(pane+' [aria-label="Reference layout"]','vertical');
    await visible('.editor-panes.split-vertical');
    await change(pane+' [aria-label="Reference pane size"]','65');
    await wait(s=>document.querySelector(s).style.flexBasis==='65%','reference size',pane);
    await click(pane+' button:not([aria-label])');
    await wait((s,name)=>document.querySelector(s)?.title===name,'reference swap',active,first);
    await hasText(primary,'reference_alpha');
    await hasText(pane,'reference_beta');
  });
  await step('Reference comparison reviews versions and marks edits historical',async()=>{
    const comparison=pane+' [aria-label="Reference snapshot comparison"]';
    const compareButton=pane+' [aria-label="Reference view"] button:nth-child(2)';
    await click(compareButton);
    await visible(comparison);
    await click(comparison+' button');
    await wait(s=>document.querySelector(s)?.textContent.includes('Current reviewed snapshots'),'current comparison',comparison);
    await wait(s=>document.querySelector(s)?.textContent.includes('reference_beta'),'reference difference',comparison);
    await change(comparison+' [aria-label="Compared reference version"]','saved');
    await wait(s=>document.querySelector(s)?.textContent.includes('Historical preview'),'changed version',comparison);
    await click(comparison+' button');
    await wait(s=>document.querySelector(s)?.textContent.includes('Current reviewed snapshots'),'refreshed saved comparison',comparison);
    await write('_edited');
    await wait(s=>document.querySelector(s)?.textContent.includes('Historical preview'),'edited primary snapshot',comparison);
    await click(pane+' [aria-label="Reference view"] button:first-child');
    await visible(reference);
    await hasText(pane,'reference_beta');
  });
  await step('Closing a selected clean tab clears the reference without opening another source',async()=>{
    empty=await newTab();
    await click(tab(first));
    await choose(empty);
    await visible(reference);
    const before=await count();
    await click(tab(empty)+' .tab-close');
    await wait((s,n)=>document.querySelectorAll(s).length===n,'close clean reference',tabs,before-1);
    await wait(s=>document.querySelector(s)?.value==='','reference selection cleared',selector);
    assert.equal(await activeName(),first);
    await click(pane+' [aria-label="Close reference pane"]');
    await wait(s=>!document.querySelector(s),'reference closed',pane);
    await hasText(primary,'reference_alpha');
  });
}
