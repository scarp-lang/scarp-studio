import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IntelliSenseSettings } from './IntelliSenseSettings';
import { DEFAULT_INTELLISENSE_PREFERENCES as defaults, INTELLISENSE_PRESETS } from '../model/intelliSensePreferences';

function render(overrides: Partial<Parameters<typeof IntelliSenseSettings>[0]> = {}) {
  return renderToStaticMarkup(createElement(IntelliSenseSettings, {
    preferences: defaults, persistence: 'available', onChange: () => {}, onReset: () => {}, ...overrides,
  }));
}
function tag(html: string, id: string, kind = 'input') {
  const result = html.match(new RegExp('<' + kind + '[^>]*id="' + id + '"[^>]*>'));
  if (!result) throw new Error('Missing control: ' + id);
  return result[0];
}
describe('IntelliSense Settings UI', () => {
  it('renders labeled controls and independent sections', () => {
    const html = render();
    for (const label of ['Completion behavior', 'Suggestion sources', 'Documentation and navigation',
      'Local analysis performance', 'Reset IntelliSense only', 'Balanced preset', 'Saved IntelliSense profiles', 'Export configuration', 'Import configuration', 'IntelliSense preview']) expect(html).toContain(label);
    for (const id of ['mode', 'matching', 'delay', 'limit', 'enter', 'tab', 'hover-delay', 'budget']) {
      expect(html).toContain('for="intellisense-' + id + '"');
      tag(html, 'intellisense-' + id, 'select');
    }
    for (const flag of ['templates', 'builtins', 'keywordsAndTypes', 'localFunctions', 'documentWords',
      'preferLocal', 'conservativeCatalog', 'hover', 'localFunctionHover', 'signatureHelp', 'builtinSignatureHelp', 'goToDefinition', 'documentSymbols']) {
      expect(tag(html, 'intellisense-' + flag)).toContain('aria-describedby="intellisense-' + flag + '-help"');
      expect(html).toContain('id="intellisense-' + flag + '-help"');
    }
  });
  it('preserves disabled source selections in off mode and independent navigation', () => {
    const html = render({ preferences: { ...defaults, completionMode: 'off' } });
    expect(tag(html, 'intellisense-templates')).toContain('checked');
    expect(tag(html, 'intellisense-templates')).toContain('disabled');
    expect(tag(html, 'intellisense-delay', 'select')).toContain('disabled');
    expect(tag(html, 'intellisense-limit', 'select')).toContain('disabled');
    expect(tag(html, 'intellisense-hover')).not.toContain('disabled');
    expect(tag(html, 'intellisense-goToDefinition')).not.toContain('disabled');
    expect(html).toContain('Custom preferences');
  });
  it('shows manual preset and disables only its automatic delay', () => {
    const html = render({ preferences: INTELLISENSE_PRESETS.manual });
    expect(html).toContain('Manual preset');
    expect(tag(html, 'intellisense-delay', 'select')).toContain('disabled');
    expect(tag(html, 'intellisense-limit', 'select')).not.toContain('disabled');
    expect(tag(html, 'intellisense-templates')).not.toContain('disabled');
  });
  it('shows session-only persistence status and disabled hover delay', () => {
    const html = render({ persistence: 'session-only', preferences: { ...defaults, hover: false } });
    expect(html).toContain('local storage is unavailable');
    expect(tag(html, 'intellisense-hover-delay', 'select')).toContain('disabled');
    expect(tag(html, 'intellisense-hover')).not.toContain('checked');
    expect(tag(html, 'intellisense-localFunctionHover')).toContain('disabled');
  });
});


it('preserves the built-in hint choice while master parameter hints are off', () => {
  const html = render({ preferences: { ...defaults, signatureHelp: false, builtinSignatureHelp: true } });
  expect(tag(html, 'intellisense-builtinSignatureHelp')).toContain('checked');
  expect(tag(html, 'intellisense-builtinSignatureHelp')).toContain('disabled');
});
