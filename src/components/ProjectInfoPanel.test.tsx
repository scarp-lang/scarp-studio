import { renderToStaticMarkup } from 'react-dom/server';
import { describe,expect,it } from 'vitest';
import { ProjectInfoPanel } from './ProjectInfoPanel';
import type { ProjectInfoSnapshot,EntryState } from '../model/projectInfo';
const snapshot:ProjectInfoSnapshot={folder:'C:/private/root',info:{name:'Legacy <app>',type:'application',version:null,
  format:'legacy-v1',manifest:'Scarp.project',entry:'src/main.srp'}};
function markup(entry:EntryState){
  const unexpected=()=>{throw Error('unexpected operation');};
  return renderToStaticMarkup(<ProjectInfoPanel snapshot={snapshot} entry={entry} baseline={null} busy={false}
    onOpen={unexpected} onBaseline={unexpected} onHide={unexpected}/>);
}
describe('saved project metadata presentation',()=>{
  it('renders legacy metadata and escapes labels without auto-migrating',()=>{
    const html=markup({kind:'not-listed',reason:'Not in current listing'});
    expect(html).toContain('Legacy &lt;app&gt;');
    expect(html).toContain('Unspecified (legacy manifest)');
    expect(html).toContain('No automatic migration');
    expect(html).not.toContain('Open listed entry');
    expect(html).not.toContain('C:/private');
  });
  it('labels dirty entry navigation and leaves export and review collapsed',()=>{
    const html=markup({kind:'listed',path:'C:/private/root/src/main.srp',name:'src/main.srp',open:true,dirty:true});
    expect(html).toContain('Open with unsaved edits');
    expect(html).toContain('Focus listed entry');
    expect(html).not.toContain('Confirm metadata baseline change');
    expect(html).not.toContain('Project metadata report"');
    expect(html).not.toContain('C:/private');
  });
});
