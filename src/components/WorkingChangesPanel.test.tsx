import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { WorkingChangesPanel } from './WorkingChangesPanel';
import type { StudioDocument } from '../model/documents';

function doc(savedContent: string, content: string): StudioDocument {
  return {
    id: 'changes', name: 'main.srp', path: 'C:/repo/main.srp',
    content, savedContent, revision: 10,
  };
}

describe('Scarp Working Changes presentation', () => {
  it('stays collapsed without allocating a visible diff by default', () => {
    const markup = renderToStaticMarkup(createElement(WorkingChangesPanel, {
      document: doc('one', 'two'), onNavigate: () => {},
    }));
    expect(markup).toContain('WORKING CHANGES');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('changes-counts');
  });

  it('reports an unchanged snapshot without fake unsaved markers', () => {
    const markup = renderToStaticMarkup(createElement(WorkingChangesPanel, {
      document: doc('same', 'same'), onNavigate: () => {}, initiallyExpanded: true,
    }));
    expect(markup).toContain('No unsaved text changes');
    expect(markup).not.toContain('changes-hunk');
  });

  it('renders additions and removals as escaped read-only markup', () => {
    const markup = renderToStaticMarkup(createElement(WorkingChangesPanel, {
      document: doc('old\nhello', '<script>alert(1)</script>\nhello'),
      onNavigate: () => {}, initiallyExpanded: true,
    }));
    expect(markup).toContain('change group');
    expect(markup).toContain('changes-line-added');
    expect(markup).toContain('changes-line-removed');
    expect(markup).toContain('&lt;script&gt;');
    expect(markup).not.toContain('<script>');
    expect(markup).toContain('Go to line');
  });

  it('handles no active source without making a disk read', () => {
    const markup = renderToStaticMarkup(createElement(WorkingChangesPanel, {
      document: null, onNavigate: () => {}, initiallyExpanded: true,
    }));
    expect(markup).toContain('Open a Scarp file');
    expect(markup).not.toContain('changes-hunk');
  });

  it('displays safe-limits message for a huge edit instead of a partial diff', () => {
    const markup = renderToStaticMarkup(createElement(WorkingChangesPanel, {
      document: doc('', 'x'.repeat(512*1024+1)),
      onNavigate: () => {}, initiallyExpanded: true,
    }));
    expect(markup).toContain('unavailable');
    expect(markup).not.toContain('Go to line');
  });

  it('exposes context visibility as a user-controlled toggle', () => {
    const markup = renderToStaticMarkup(createElement(WorkingChangesPanel, {
      document: doc('start\nbefore\nend', 'start\nafter\nend'),
      onNavigate: () => {}, initiallyExpanded: true,
    }));
    expect(markup).toContain('Show unchanged context');
    expect(markup).toContain('type="checkbox"');
    expect(markup).toContain('changes-line-context');
  });

  it('limits initial rendered change groups for a long edited file', () => {
    const saved: string[] = [], current: string[] = [];
    for (let i = 0; i < 20; i++) {
      saved.push('before ' + i, ...Array.from({ length: 8 }, (_, j) => 'same '+i+'/'+j));
      current.push('after ' + i, ...Array.from({ length: 8 }, (_, j) => 'same '+i+'/'+j));
    }
    const markup = renderToStaticMarkup(createElement(WorkingChangesPanel, {
      document: doc(saved.join('\n'), current.join('\n')),
      onNavigate: () => {}, initiallyExpanded: true,
    }));
    expect((markup.match(/class="changes-hunk"/g) ?? []).length).toBe(8);
    expect(markup).toContain('Show more change groups');
  });
});
