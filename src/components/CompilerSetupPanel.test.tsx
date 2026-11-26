import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CompilerSetupPanel } from './CompilerSetupPanel';

const first = 'C:/Scarp/scarp.exe';
const second = 'C:/Downloads/Scarp/scarp.exe';
function render(overrides: Partial<Parameters<typeof CompilerSetupPanel>[0]> = {}) {
  return renderToStaticMarkup(createElement(CompilerSetupPanel, {
    location: 'settings', native: true, busy: false, scanning: false, selecting: false,
    approvedPath: null, compilerInfo: null, candidates: [first, second], selectedCandidate: first,
    onSelectCandidate: () => {}, onScan: () => {}, onDownload: () => {},
    onChoose: () => {}, onConfirm: () => {}, ...overrides,
  }));
}
function button(html: string, label: string): string {
  const found = html.match(new RegExp('<button[^>]*>' + label + '</button>'));
  if (!found) throw new Error('Button missing: ' + label);
  return found[0];
}
describe('shared compiler setup controls', () => {
  it('shows detected candidate separately from session approval', () => {
    const html = render();
    expect(html).toContain('Detected compiler; approval required.');
    expect(html).toContain(first);
    expect(html).not.toContain('Approved executable');
    expect(button(html, 'Yes, confirm this location')).not.toContain('disabled');
  });
  it('shows approved path and version with no redundant confirmation', () => {
    const html = render({ approvedPath: first, compilerInfo: 'Scarp version 0.0.7' });
    expect(html).toContain('Compiler approved for this session.');
    expect(html).toContain('Approved executable');
    expect(html).toContain('Scarp version 0.0.7');
    expect(html).not.toContain('Yes, confirm this location');
  });
  it('allows alternate candidate approval without losing current identity', () => {
    const html = render({ approvedPath: first, selectedCandidate: second });
    expect(html).toContain(first);
    expect(html).toContain(second);
    expect(html).toContain('Candidate is not approved:');
    expect(button(html, 'Yes, confirm this location')).not.toContain('disabled');
  });
  it('disables actions in busy states and browser previews', () => {
    for (const overrides of [{ busy: true }, { native: false }, { scanning: true }, { selecting: true }]) {
      const html = render(overrides);
      expect(button(html, 'Download Compiler')).toContain('disabled');
      expect(button(html, 'Yes, confirm this location')).toContain('disabled');
      expect(html.match(/<select[^>]*>/)?.[0]).toContain('disabled');
    }
    expect(render({ native: false })).toContain('desktop application only');
  });
  it('rejects stale selections and distinguishes duplicate view IDs', () => {
    expect(render({ selectedCandidate: 'C:/not-listed/scarp.exe' })).not.toContain('Yes, confirm this location');
    expect(render()).toContain('id="studio-compiler-candidate-settings"');
    expect(render({ location: 'output' })).toContain('id="studio-compiler-candidate-output"');
    expect(render({ candidates: [], selectedCandidate: null })).toContain('No compiler detected.');
  });
});
