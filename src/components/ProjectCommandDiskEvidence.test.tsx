import { renderToStaticMarkup } from 'react-dom/server';
import { describe,expect,it } from 'vitest';
import { ProjectCommandDiskEvidence } from './ProjectCommandDiskEvidence';
describe('project disk evidence',()=>{
  it('distinguishes zero coverage and an unfinished after check',()=>{
    const html=renderToStaticMarkup(<ProjectCommandDiskEvidence historical={true} evidence={{
      folder:'/private/project',before:{status:'matched',checked:0,total:0,rows:[]},after:null}}/>);
    expect(html).toContain('No open file-backed Scarp source buffers');
    expect(html).toContain('After command: not completed');
    expect(html).toContain('not an atomic filesystem snapshot');
    expect(html).not.toContain('/private/project');
  });
});
