import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DraftRecoveryPanel } from './DraftRecoveryPanel';
import type { RecoveryView } from '../model/draftRecoveryJournal';

const base: RecoveryView = {
  available: true, enabled: false, blocked: false, paused: false,
  previous: null, checkpointTime: null, checkpointCount: 0, error: null,
};
const noop = () => {};
function render(view: Partial<RecoveryView> = {}, blocked = false): string {
  return renderToStaticMarkup(createElement(DraftRecoveryPanel, {
    view: { ...base, ...view }, blocked,
    onEnable: noop, onDisable: noop, onRestore: noop, onDiscard: noop, onCheckpoint: noop,
  }));
}
const previous = {
  version: 1 as const, createdAt: 1700000000000,
  drafts: [{ name: 'secret.srp', content: 'private source never rendered by this panel' }],
};

describe('local recovery controls', () => {
  it('explains opt-in, local storage, no encryption, and no original file writes', () => {
    const html = render();
    expect(html).toContain('Off by default');
    expect(html).toContain('Not encrypted');
    expect(html).toContain('Enable local recovery');
    expect(html).not.toContain('Checkpoint now');
    expect(html).not.toContain('Restore as unsaved copies');
  });

  it('offers checkpoint and removal only after opt-in', () => {
    const html = render({ enabled: true, checkpointTime: 1700000000000, checkpointCount: 2 });
    expect(html).toContain('Last checkpoint:');
    expect(html).toContain('2 draft(s)');
    expect(html).toContain('Checkpoint now');
    expect(html).toContain('Turn off and remove local recovery');
    expect(html).not.toContain('Enable local recovery');
  });

  it('pauses checkpoint creation while prior-session drafts await explicit review', () => {
    const html = render({ enabled: true, previous, checkpointCount: 1 });
    expect(html).toContain('1 draft(s) from a previous session');
    expect(html).toContain('Restore as unsaved copies');
    expect(html).toContain('Discard previous drafts');
    expect(html).toContain('paused until review');
    expect(html).not.toContain('Checkpoint now');
    expect(html).not.toContain('secret.srp');
    expect(html).not.toContain(previous.drafts[0].content);
  });

  it('shows storage failures without pretending a new copy was saved', () => {
    const html = render({ enabled: true, error: 'Recovery storage write failed.' });
    expect(html).toContain('role="alert"');
    expect(html).toContain('Recovery storage write failed.');
  });

  it('disables recovery writes when native operations are blocked', () => {
    expect(render({}, true)).toContain('disabled=""');
    const html = render({ enabled: true, previous }, true);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Restore as unsaved copies/);
  });

  it('does not offer enable or restore when stored data requires explicit review', () => {
    const html = render({ blocked: true, error: 'Unrecognized local recovery record.' });
    expect(html).toContain('Review required');
    expect(html).toContain('Turn off and remove local recovery');
    expect(html).not.toContain('Enable local recovery');
  });

  it('reports unavailable storage and disables opt-in', () => {
    const html = render({ available: false });
    expect(html).toContain('Recovery storage is unavailable');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Enable local recovery/);
  });

  it('does not render private source text in the markup', () => {
    const html = render({ enabled: true, previous: {
      ...previous, drafts: [{ name: 'x.srp', content: '<script>private()</script>' }],
    } });
    expect(html).not.toContain('private()');
    expect(html).not.toContain('<script>');
  });
});
