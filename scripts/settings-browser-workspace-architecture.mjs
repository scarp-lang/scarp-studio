import assert from 'node:assert/strict';

/** Browser smoke for the read-only Workspace Architecture Explorer surface. */
export async function workspaceArchitectureSmoke({ evaluate, wait, visible, click, change, step, cdp }) {
  const toolDirectory='[aria-label="Explorer tool directory"]';
  const architecture='[aria-label="Workspace architecture explorer"]';
  const tabs=architecture+' [aria-label="Workspace architecture views"]';
  const editor='#scarp-editor-panel .monaco-editor textarea';
  const openTabs='[aria-label="Open source files"] [role="tab"]';
  const newButton='[aria-label="File actions"] button[title^="New ("]';
  const source=[
    'funcra helper() {',
    '  helper();',
    '}',
    'funcra main() {',
    '  helper();',
    '  missing_architecture_call();',
    '}',
    '',
  ].join('\n');

  await step('Workspace architecture can be revealed through the Explorer tool directory',async()=>{
    await visible(toolDirectory);
    await click(toolDirectory+' button[aria-controls="explorer-tool-directory-index"]');
    await change(toolDirectory+' input[aria-label="Search Explorer tools"]','workspace architecture');
    await wait(s=>Array.from(document.querySelectorAll(s+' .tool-directory-entry strong')).some(
      element=>element.textContent.trim()==='Workspace architecture'),'architecture tool search',toolDirectory);
    await evaluate(s=>{
      const entry=Array.from(document.querySelectorAll(s+' .tool-directory-entry')).find(
        element=>element.querySelector('strong')?.textContent.trim()==='Workspace architecture');
      const button=entry?.querySelector('.tool-directory-reveal');
      if(!button) throw Error('Workspace architecture reveal control missing');
      button.click();
    },toolDirectory);
    await visible(architecture);
    await wait(s=>document.activeElement?.closest(s)!==null,'architecture tool focus',architecture);
  });

  await step('Workspace architecture indexes unsaved open-buffer observations without disk writes',async()=>{
    const before=await evaluate(s=>document.querySelectorAll(s).length,openTabs);
    await click(newButton);
    await wait((s,n)=>document.querySelectorAll(s).length===n,'new architecture source',openTabs,before+1);
    await visible(editor);
    await evaluate(s=>document.querySelector(s).focus(),editor);
    await cdp.send('Input.insertText',{text:source});
    await click(architecture+' .insights-toggle');
    await visible(tabs);
    await wait(s=>document.querySelector(s)?.textContent.includes('Declarations'),'architecture metrics',architecture);
    await wait(s=>document.querySelector(s)?.textContent.includes('Call sites'),'architecture call metrics',architecture);
    await wait(s=>document.querySelector(s)?.textContent.includes('MODULE COUPLING'),'architecture coupling metrics',architecture);
    assert.equal(await evaluate(s=>document.querySelector(s)?.textContent.includes('compiler-resolved edges'),architecture),true);
    assert.equal(await evaluate(s=>document.querySelector(s)?.textContent.includes('No files are read or changed here'),architecture),true);
  });

  await step('Workspace architecture exposes search, review, impact, routes, snapshots and reports',async()=>{
    const labels=['Overview','Search','Review','Impact','Routes','Snapshots','Report'];
    for(const label of labels){
      assert.equal(await evaluate((s,label)=>Array.from(document.querySelectorAll(s+' [role="tab"]')).some(
        button=>button.textContent.trim()===label),tabs,label),true,label+' tab missing');
    }
    await evaluate(s=>{
      const button=Array.from(document.querySelectorAll(s+' [role="tab"]')).find(element=>element.textContent.trim()==='Search');
      button?.click();
    },tabs);
    await visible(architecture+' input[aria-label="Search workspace architecture"]');
    await change(architecture+' input[aria-label="Search workspace architecture"]','name:helper kind:symbol');
    await wait(s=>document.querySelector(s)?.textContent.includes('matching architecture items'),'architecture query result',architecture);
    assert.equal(await evaluate(s=>document.querySelector(s)?.textContent.includes('helper'),architecture),true);
  });

  await step('Workspace architecture report stays local and makes path disclosure opt-in',async()=>{
    await evaluate(s=>{
      const button=Array.from(document.querySelectorAll(s+' [role="tab"]')).find(element=>element.textContent.trim()==='Report');
      button?.click();
    },tabs);
    await visible(architecture+' textarea[aria-label="Generated workspace architecture report"]');
    assert.equal(await evaluate(s=>{
      const label=Array.from(document.querySelectorAll(s+' label')).find(element=>
        element.textContent.includes('Include captured native paths'));
      return label?.querySelector('input[type="checkbox"]')?.checked ?? null;
    },architecture),false,'native path disclosure must be off by default');
    assert.equal(await evaluate(s=>document.querySelector(s)?.textContent.includes('Include captured native paths'),architecture),true);
    assert.equal(await evaluate(s=>document.querySelector(s+' textarea[aria-label="Generated workspace architecture report"]')?.value.includes('[SUMMARY]'),architecture),true);
  });
}
