import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProjectSearchPresetsPanel, SearchPresetApplyDetails, SearchPresetImportDetails, SearchPresetSettingsView } from './ProjectSearchPresetsPanel';
import {
  addSearchPreset, createSearchPresetLibrary, prepareSearchPresetApply, reviewSearchPresetImport,
  SEARCH_PRESET_FORMAT, type ProjectSearchSettings,
} from '../model/projectSearchPresets';
import { buildProjectScopeInventory, DEFAULT_PROJECT_SEARCH_SCOPE } from '../model/projectSearchScope';

const current: ProjectSearchSettings = {
  query: 'private query', options: { caseSensitive: true, wholeWord: false },
  scope: DEFAULT_PROJECT_SEARCH_SCOPE,
};
const proposed: ProjectSearchSettings = {
  query: 'proposed private query', options: { caseSensitive: false, wholeWord: true },
  scope: { directory: 'src', descendants: true, filename: 'main', batch: 1 },
};
const listed = [
  { name: 'src/main.srp', path: 'C:/private/source/main.srp' },
  { name: 'src/other.srp', path: 'C:/private/source/other.srp' },
];
function library() {
  const result = addSearchPreset(createSearchPresetLibrary(), 'Existing', proposed);
  if (!result.ok) throw Error(result.error);
  return result.value;
}

describe('search preset workbench rendering', () => {
  it('starts collapsed without exposing literal query, source labels or native paths', () => {
    const onApply = vi.fn(() => true);
    const html = renderToStaticMarkup(<ProjectSearchPresetsPanel listed={listed} current={current} busy={false} onApply={onApply}/>);
    expect(html).toContain('Manage search presets');
    expect(html).not.toContain(current.query);
    expect(html).not.toContain('src/main.srp');
    expect(html).not.toContain('C:/private');
    expect(html).not.toContain('Portable search preset backup');
    expect(onApply).not.toHaveBeenCalled();
  });

  it('renders explicit before/after review and does not reveal native paths or unexpanded labels', () => {
    const reviewed = prepareSearchPresetApply(library(), 1, current, buildProjectScopeInventory(listed));
    if (!reviewed.ok) throw Error(reviewed.error);
    const confirm = vi.fn();
    const cancel = vi.fn();
    const html = renderToStaticMarkup(<SearchPresetApplyDetails review={reviewed.value} busy={false}
      onConfirm={confirm} onCancel={cancel}/>);
    expect(html).toContain('Current search settings');
    expect(html).toContain('Proposed search settings');
    expect(html).toContain(current.query);
    expect(html).toContain(proposed.query);
    expect(html).toContain('Explicit batch 1');
    expect(html).toContain('1 selected eligible label(s)');
    expect(html).toContain('does not perform a search');
    expect(html).not.toContain('src/main.srp');
    expect(html).not.toContain('C:/private');
    expect(confirm).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it('disables apply confirmation while busy but still permits cancelling review', () => {
    const reviewed = prepareSearchPresetApply(library(), 1, current, buildProjectScopeInventory(listed));
    if (!reviewed.ok) throw Error(reviewed.error);
    const html = renderToStaticMarkup(<SearchPresetApplyDetails review={reviewed.value} busy
      onConfirm={vi.fn()} onCancel={vi.fn()}/>);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Confirm apply search preset<\/button>/);
    expect(html).toContain('<button type="button">Cancel preset review</button>');
  });

  it('renders an import review without exposing query text until settings are explicitly inspected', () => {
    const text = JSON.stringify({ format: SEARCH_PRESET_FORMAT, version: 1, presets: [
      { name: 'Existing', settings: current }, { name: 'New', settings: proposed },
    ] });
    const reviewed = reviewSearchPresetImport(library(), text);
    if (!reviewed.ok) throw Error(reviewed.error);
    const onSelect = vi.fn();
    const onApply = vi.fn();
    const html = renderToStaticMarkup(<SearchPresetImportDetails review={reviewed.value} selected={[]} busy={false}
      onSelect={onSelect} onApply={onApply} onCancel={vi.fn()}/>);
    expect(html).toContain('Name conflict; existing preset retained');
    expect(html).toContain('New preset');
    expect(html).toContain('Review settings');
    expect(html).toContain('0 selected');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Import selected new presets<\/button>/);
    expect(html).not.toContain(current.query);
    expect(html).not.toContain(proposed.query);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('escapes literal query strings when rendering reviewed settings', () => {
    const html = renderToStaticMarkup(<SearchPresetSettingsView settings={{ ...current, query: '<script>alert(1)</script>' }}/>);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
