import { renderToStaticMarkup } from 'react-dom/server';
import { describe,expect,it } from 'vitest';
import { ProjectScaffoldPanel } from './ProjectScaffoldPanel';
describe('project scaffolding initial UI',()=>{
  it('starts collapsed with no writes or preapproved creation',()=>{
    const html=renderToStaticMarkup(<ProjectScaffoldPanel directories={['practice']} unavailable={[]} busy={false}
      onCreate={async()=>{throw Error('unexpected creation');}}/>);
    expect(html).toContain('New Scarp project');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('Confirm create project');
  });
});
