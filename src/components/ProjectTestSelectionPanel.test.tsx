import { renderToStaticMarkup } from 'react-dom/server';
import { describe,expect,it } from 'vitest';
import { ProjectTestSelectionPanel } from './ProjectTestSelectionPanel';
describe('filtered project test initial presentation',()=>{
  it('starts collapsed and never invokes a command automatically',()=>{
    const html=renderToStaticMarkup(<ProjectTestSelectionPanel folder="/private/project" busy={false}
      report={null} onCommand={()=>{throw Error('unexpected execution');}}/>);
    expect(html).toContain('Select tests by filename');
    expect(html).not.toContain('Confirm filtered run');
    expect(html).not.toContain('/private/project');
  });
});
