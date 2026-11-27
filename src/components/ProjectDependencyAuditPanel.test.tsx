import { renderToStaticMarkup } from 'react-dom/server';
import { describe,expect,it } from 'vitest';
import { ProjectDependencyAuditPanel } from './ProjectDependencyAuditPanel';
describe('listed import audit initial UI',()=>{
  it('does not read or open any source without an explicit scan',()=>{
    const html=renderToStaticMarkup(<ProjectDependencyAuditPanel folder="/private" generation={0} busy={false}
      onAudit={async()=>{throw Error('unexpected read');}} onOpen={()=>{throw Error('unexpected open');}}/>);
    expect(html).toContain('Audit listed project imports');
    expect(html).not.toContain('Scan selected project imports');
    expect(html).not.toContain('/private');
  });
});
