import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { ProjectExplorer } from './ProjectExplorer';

const tuple = {
  name: 'basic_tuple/main.srp',
  path: 'C:/Scarp-Practice/basic_tuple/main.srp',
};
const loop = {
  name: 'loops/main.srp',
  path: 'C:/Scarp-Practice/loops/main.srp',
};
const noop = () => {};

describe('manifest-aware Explorer SSR layout and accessibility', () => {
  it('shows an active-project indicator and explicit selectable sibling project', () => {
    const markup = renderToStaticMarkup(createElement(ProjectExplorer, {
      files: [tuple, loop],
      directories: ['basic_tuple', 'loops'],
      projectRoots: [{ directory: 'basic_tuple' }, { directory: 'loops' }],
      selectedProjectDirectory: 'basic_tuple',
      documents: [], activeId: null, busy: false,
      onOpen: noop, onSelectProject: noop,
    }));
    expect(markup).toContain('Project ✓');
    expect(markup).toContain('aria-label="Select Scarp project loops"');
    expect(markup).not.toContain('aria-label="Select Scarp project basic_tuple"');
    expect(markup).toContain('basic_tuple/');
    expect(markup).toContain('loops/');
  });

  it('exposes the manifest-bearing workspace root even without a root .srp source', () => {
    const markup = renderToStaticMarkup(createElement(ProjectExplorer, {
      files: [],
      projectRoots: [{ directory: '' }, { directory: 'basic_tuple' }],
      selectedProjectDirectory: '',
      documents: [], activeId: null, busy: false,
      onOpen: noop, onSelectProject: noop,
    }));
    expect(markup).toContain('Folder Project root');
    expect(markup).toContain('Project ✓');
    expect(markup).toContain('aria-label="Select Scarp project basic_tuple"');
  });

  it('disables project switching during a native operation', () => {
    const markup = renderToStaticMarkup(createElement(ProjectExplorer, {
      files: [loop],
      projectRoots: [{ directory: 'loops' }],
      selectedProjectDirectory: '',
      documents: [], activeId: null, busy: true,
      onOpen: noop, onSelectProject: noop,
    }));
    const button = markup.match(/<button[^>]*aria-label="Select Scarp project loops"[^>]*>/)?.[0];
    expect(button).toBeDefined();
    expect(button).toMatch(/\bdisabled\b/);
  });
});
