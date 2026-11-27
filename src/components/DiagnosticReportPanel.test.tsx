import { renderToStaticMarkup } from 'react-dom/server';
import { describe,expect,it } from 'vitest';
import { DiagnosticReportPanel } from './DiagnosticReportPanel';
import type { DiagnosticReport } from '../model/diagnosticReport';

describe('static diagnostic detail initial presentation',()=>{
  it('discloses counts without prematurely rendering private messages or paths',()=>{
    const report:DiagnosticReport={action:'verify',diagnostics:[{id:0,code:'E0015',message:'private text',help:null,
      primary:{path:'C:/private/file.srp',byteStart:0,byteEnd:1,start:{line:1,column:1},end:{line:1,column:2}},
      related:[{message:'private note',location:null}]}]};
    const markup=renderToStaticMarkup(<DiagnosticReportPanel report={report}/>);
    expect(markup).toContain('Review diagnostic detail');
    expect(markup).toContain('1 related note(s)');
    expect(markup).not.toContain('C:/private');
    expect(markup).not.toContain('private text');
    expect(markup).not.toContain('private note');
  });
});
