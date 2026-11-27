import { renderToStaticMarkup } from 'react-dom/server';
import { describe,expect,it } from 'vitest';
import { WorkspaceDiskReviewPanel } from './WorkspaceDiskReviewPanel';
import { initialEditorState } from '../model/editorState';

describe('multi-file disk review initial UI',()=>{
  it('starts collapsed without selecting or reading files',()=>{
    const unexpected=async()=>{throw Error('unexpected native operation');};
    const html=renderToStaticMarkup(<WorkspaceDiskReviewPanel editor={initialEditorState} native={true}
      busy={false} onScan={unexpected} onReload={unexpected}/>);
    expect(html).toContain('Review external file changes');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('Recheck and reload selected clean tabs');
  });
});
