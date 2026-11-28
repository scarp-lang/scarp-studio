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
    expect(markup).toContain('aria-label="Folder Workspace root"');
    expect(markup).toContain('Project ✓');
    expect(markup).toContain('aria-label="Select Scarp project basic_tuple"');
  });

  it('offers the root and every sibling when no target is selected', () => {
    const markup = renderToStaticMarkup(createElement(ProjectExplorer, {
      files: [tuple, loop],
      projectRoots: [{ directory: '' }, { directory: 'basic_tuple' }, { directory: 'loops' }],
      selectedProjectDirectory: null,
      documents: [], activeId: null, busy: false,
      onOpen: noop, onSelectProject: noop,
    }));
    expect(markup).not.toContain('Project ✓');
    expect(markup).toContain('aria-label="Select Scarp project Workspace root"');
    expect(markup).toContain('aria-label="Select Scarp project basic_tuple"');
    expect(markup).toContain('aria-label="Select Scarp project loops"');
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

describe('workspace folder navigation presentation', () => {
  it('offers a bounded folder selector with synthetic intermediate headings', () => {
    const source = {
      name: 'basic_tuple/src/deep/math.srp',
      path: 'C:/Scarp-Practice/basic_tuple/src/deep/math.srp',
    };
    const markup = renderToStaticMarkup(createElement(ProjectExplorer, {
      files: [source, loop], directories: ['loops'],
      documents: [], activeId: null, busy: false, onOpen: noop,
    }));
    expect(markup).toContain('aria-label="Browse listed folder"');
    expect(markup).toContain('value="fbasic_tuple"');
    expect(markup).toContain('value="fbasic_tuple/src"');
    expect(markup).toContain('aria-label="Folder basic_tuple/src"');
    expect(markup).toContain('2 listed files');
    expect(markup).toContain('0 open');
    expect(markup).toContain('0 modified');
  });

  it('reports open and modified descendants and enables active-file reveal', () => {
    const markup = renderToStaticMarkup(createElement(ProjectExplorer, {
      files: [tuple, loop],
      documents: [{
        id: 'active', name: 'main.srp', path: tuple.path,
        content: 'print(2);', savedContent: 'print(1);', revision: 1,
      }],
      activeId: 'active', busy: false, onOpen: noop,
    }));
    expect(markup).toContain('1 open');
    expect(markup).toContain('1 modified');
    expect(markup).toContain('aria-label="Contains active source"');
    expect(markup).toContain('aria-label="1 modified sources in folder tree"');
    const reveal = markup.match(/<button[^>]*>\s*Reveal active file\s*<\/button>/)?.[0];
    expect(reveal).toBeDefined();
    expect(reveal).not.toMatch(/\bdisabled\b/);
  });

  it('disables active-file reveal while busy or when the active tab is not listed', () => {
    const active = {
      id: 'active', name: 'main.srp', path: tuple.path,
      content: '', savedContent: '', revision: 0,
    };
    for (const props of [
      { files: [tuple], busy: true },
      { files: [loop], busy: false },
    ]) {
      const markup = renderToStaticMarkup(createElement(ProjectExplorer, {
        ...props, documents: [active], activeId: 'active', onOpen: noop,
      }));
      const reveal = markup.match(/<button[^>]*>\s*Reveal active file\s*<\/button>/)?.[0];
      expect(reveal).toBeDefined();
      expect(reveal).toMatch(/\bdisabled\b/);
    }
  });
});
