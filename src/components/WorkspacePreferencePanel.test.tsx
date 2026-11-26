import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WorkspacePreferencePanel } from './WorkspacePreferencePanel';
import { createWorkspacePreferenceStore } from '../model/workspacePreferences';
import { DEFAULT_STUDIO_PORTABLE } from '../model/studioPreferenceTransfer';
describe('workspace preference panel', () => {
  it('does not expose selected paths or apply any preference during collapsed render', () => {
    const html = renderToStaticMarkup(createElement(WorkspacePreferencePanel, {
      root: 'C:/Private/Workspace', current: DEFAULT_STUDIO_PORTABLE,
      store: createWorkspacePreferenceStore(null), onApply: () => { throw Error('unexpected apply'); },
    }));
    expect(html).toContain('Workspace preference associations');
    expect(html).not.toContain('C:/Private/Workspace');
    expect(html).not.toContain('Confirm workspace preference action');
  });
});
