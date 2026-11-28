import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TOOL_DIRECTORY,
  EXPLORER_TOOLS,
  filterExplorerTools,
  isExplorerToolId,
  reduceToolDirectory,
} from './explorerToolDirectory';

describe('Workspace Architecture Explorer tool registration', () => {
  it('registers a stable workspace-architecture identity', () => {
    expect(isExplorerToolId('workspace-architecture')).toBe(true);
    const tool = EXPLORER_TOOLS.find(item => item.id === 'workspace-architecture');
    expect(tool).toBeDefined();
    expect(tool?.category).toBe('analysis');
    expect(tool?.label).toBe('Workspace architecture');
  });

  it('describes the tool as source analysis instead of an editing command', () => {
    const tool = EXPLORER_TOOLS.find(item => item.id === 'workspace-architecture')!;
    expect(tool.description.toLowerCase()).toContain('architecture');
    expect(tool.keywords.toLowerCase()).toContain('graph');
    expect(tool.keywords.toLowerCase()).toContain('impact');
    expect(tool.category).not.toBe('editing');
  });

  it('finds the tool by architecture search text', () => {
    const state = reduceToolDirectory(DEFAULT_TOOL_DIRECTORY, { type: 'query', value: 'workspace architecture' });
    expect(filterExplorerTools(state).map(item => item.id)).toContain('workspace-architecture');
  });

  it('finds the tool by graph and impact keywords', () => {
    for (const query of ['graph impact', 'dependency route', 'coupling metrics']) {
      const state = reduceToolDirectory(DEFAULT_TOOL_DIRECTORY, { type: 'query', value: query });
      expect(filterExplorerTools(state).map(item => item.id)).toContain('workspace-architecture');
    }
  });

  it('appears in the analysis category filter', () => {
    const state = reduceToolDirectory(DEFAULT_TOOL_DIRECTORY, { type: 'filter', value: 'analysis' });
    expect(filterExplorerTools(state).map(item => item.id)).toContain('workspace-architecture');
  });

  it('can be pinned independently of the current category', () => {
    let state = reduceToolDirectory(DEFAULT_TOOL_DIRECTORY, { type: 'toggle-pin', id: 'workspace-architecture' });
    expect(state.pinned).toContain('workspace-architecture');
    state = reduceToolDirectory(state, { type: 'filter', value: 'pinned' });
    expect(filterExplorerTools(state).map(item => item.id)).toContain('workspace-architecture');
  });

  it('can be revealed from an incompatible filter and becomes recent', () => {
    let state = reduceToolDirectory(DEFAULT_TOOL_DIRECTORY, { type: 'filter', value: 'editing' });
    state = reduceToolDirectory(state, { type: 'reveal', id: 'workspace-architecture' });
    expect(state.filter).toBe('all');
    expect(state.recent[0]).toBe('workspace-architecture');
  });

  it('keeps the registration identity unique', () => {
    expect(EXPLORER_TOOLS.filter(item => item.id === 'workspace-architecture')).toHaveLength(1);
  });
});
