import assert from 'node:assert/strict';

export async function sourceBreadcrumbsSmoke({evaluate,wait,visible,click,change,step,cdp}) {
  const primary='#scarp-editor-panel';
  const editor=primary+' .monaco-editor textarea';
  const crumbs='[aria-label="Source navigation breadcrumbs"]';
  const outline='#source-breadcrumb-outline';
  const tabs='[aria-label="Open source files"] [role="tab"]';
  const active=tabs+'[aria-selected="true"]';
  const newButton='[aria-label="File actions"] button[title^="New ("]';
  const text=[
    'funcra outer() {',
    '  funcra inner() {',
    '    print(1);',
    '  }',
    '  inner();',
    '}',
    'funcra separate() {}',
    '',
  ].join('\n');
  const cursor='button[title^="Go to Line ("]';
  const expectCursor=(line,column)=>wait((s,value)=>document.querySelector(s)?.textContent===value,
    'breadcrumb cursor',cursor,'Ln '+line+', Col '+column);
  await step('Source outline lists declarations and navigates to their exact names',async()=>{
    const before=await evaluate(s=>document.querySelectorAll(s).length,tabs);
    await click(newButton);
    await wait((s,n)=>document.querySelectorAll(s).length===n,'new breadcrumb source',tabs,before+1);
    await visible(editor);
    await evaluate(s=>document.querySelector(s).focus(),editor);
    await cdp.send('Input.insertText',{text});
    await wait(s=>!!document.querySelector(s+' [aria-label="unsaved changes"]'),'breadcrumb source edited',active);
    await click(crumbs+' .source-breadcrumb-toggle');
    await visible(outline);
    await wait(s=>document.querySelector(s)?.textContent.includes('3 matching declarations'),'indexed declarations',outline);
    await change(outline+' [aria-label="Filter breadcrumb declarations"]','inner');
    await wait(s=>document.querySelectorAll(s+' li').length===1,'filtered inner declaration',outline);
    await click(outline+' li button');
    await expectCursor(2,10);
    await wait(s=>Array.from(document.querySelectorAll(s+' .source-breadcrumb-segment button')).map(b=>b.textContent).join('/')==='outer/inner','nested breadcrumb path',crumbs);
  });
  await step('Breadcrumb parent and file navigation preserve working source',async()=>{
    await click(crumbs+' .source-breadcrumb-segment button');
    await expectCursor(1,8);
    await wait(s=>Array.from(document.querySelectorAll(s+' .source-breadcrumb-segment button')).map(b=>b.textContent).join('/')==='outer','outer breadcrumb',crumbs);
    await click(crumbs+' .source-breadcrumb-file');
    await expectCursor(1,1);
    await wait(s=>document.querySelector(s)?.textContent.includes('File scope'),'file scope',crumbs);
    assert.equal(await evaluate(s=>!!document.querySelector(s+' [aria-label="unsaved changes"]'),active),true);
    await wait(s=>document.querySelector(s+' .view-lines')?.textContent.includes('separate'), 'source retained',primary);
  });
}
