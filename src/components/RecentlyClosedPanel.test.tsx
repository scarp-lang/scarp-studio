import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RecentlyClosedPanel } from './RecentlyClosedPanel';

const entries = [
  { sequence: 1, name: 'main.srp', path: 'C:/practice/basic/main.srp' },
  { sequence: 2, name: 'main.srp', path: 'C:/practice/loops/main.srp' },
];
const noop = () => {};
function render(props: Partial<Parameters<typeof RecentlyClosedPanel>[0]> = {}) {
  return renderToStaticMarkup(createElement(RecentlyClosedPanel, {
    entries, busy: false, initiallyExpanded: true,
    onReopen: noop, onForget: noop, onClear: noop, ...props,
  }));
}

describe('recently closed saved source controls', () => {
  it('offers keyboard reopening and distinguishable exact paths', () => {
    const html = render();
    expect(html).toContain('Reopen last closed (Ctrl+Shift+T)');
    expect(html).toContain('Reopen C:/practice/basic/main.srp');
    expect(html).toContain('Reopen C:/practice/loops/main.srp');
    expect(html).toContain('Forget C:/practice/basic/main.srp');
    expect(html).toContain('Clear closed source history');
    expect(html).toContain('2 / 20 saved sources');
  });

  it('explains that unsaved discarded text and history are not persisted', () => {
    const html = render();
    expect(html).toContain('discarded unsaved edits are not retained');
    expect(html).toContain('History ends when Studio exits');
  });

  it('disables native navigation and removal while an operation is in progress', () => {
    const html = render({ busy: true });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Reopen last closed/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Reopen C:\/practice\/basic\/main.srp"/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Clear closed source history/);
  });

  it('shows an empty history without offering a removal action', () => {
    const html = render({ entries: [] });
    expect(html).toContain('No recently closed saved sources');
    expect(html).not.toContain('Clear closed source history');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Reopen last closed/);
  });

  it('does not show closed filenames while collapsed', () => {
    const html = render({ initiallyExpanded: false });
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('C:/practice/basic/main.srp');
  });

  it('renders unusual filenames and paths as escaped text', () => {
    const html = render({ entries: [{ sequence: 1, name: '<script>.srp', path: '/tmp/<script>.srp' }] });
    expect(html).toContain('&lt;script&gt;.srp');
    expect(html).not.toContain('<script>');
  });
});
