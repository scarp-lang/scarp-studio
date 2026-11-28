import type { StudioDocument } from '../model/documents';
import type { ListedProjectSource } from '../model/projectQuickOpen';
import { buildWorkspaceArchitecture, type WorkspaceArchitecture } from '../model/workspaceArchitecture';

export function studioDocument(
  id: string,
  name: string,
  path: string | null,
  content: string,
  revision = 1,
): StudioDocument {
  return { id, name, path, content, savedContent: content, revision };
}

export function listed(name: string, path: string): ListedProjectSource {
  return { name, path };
}

export interface ArchitectureFixture {
  readonly documents: readonly StudioDocument[];
  readonly listing: readonly ListedProjectSource[];
  readonly architecture: WorkspaceArchitecture;
}

export function smallArchitectureFixture(): ArchitectureFixture {
  const documents = [
    studioDocument('main', 'main.srp', 'C:\\work\\main.srp', [
      'import "src/service.srp" as service;',
      'funcra main() {',
      '  load();',
      '  render();',
      '  missing_call();',
      '}',
      'pub funcra public_entry() {',
      '  load();',
      '}',
      '',
    ].join('\n')),
    studioDocument('service', 'service.srp', 'C:\\work\\src\\service.srp', [
      'import "util.srp" as util;',
      'pub funcra load() {',
      '  normalize();',
      '  render();',
      '}',
      'funcra service_only() {',
      '  load();',
      '}',
      '',
    ].join('\n')),
    studioDocument('util', 'util.srp', 'C:\\work\\src\\util.srp', [
      'import "service.srp" as service;',
      'funcra normalize() {',
      '  helper();',
      '}',
      'funcra helper() {',
      '  normalize();',
      '}',
      'funcra render() {',
      '}',
      '',
    ].join('\n')),
    studioDocument('alt', 'alt.srp', 'C:\\work\\alt.srp', [
      'funcra render() {',
      '  print("alternative");',
      '}',
      'record Payload {',
      '  value: integer;',
      '}',
      '',
    ].join('\n')),
  ];
  const listing = [
    listed('main.srp', 'C:\\work\\main.srp'),
    listed('src/service.srp', 'C:\\work\\src\\service.srp'),
    listed('src/util.srp', 'C:\\work\\src\\util.srp'),
    listed('alt.srp', 'C:\\work\\alt.srp'),
  ];
  return { documents, listing, architecture: buildWorkspaceArchitecture(documents, listing, 'main') };
}

export function linearArchitectureFixture(length = 6): ArchitectureFixture {
  const count = Math.max(2, Math.min(24, Math.trunc(length)));
  const documents: StudioDocument[] = [];
  const listing: ListedProjectSource[] = [];
  for (let index = 0; index < count; index++) {
    const next = index + 1 < count ? 'step_' + (index + 1) : null;
    const name = 'step_' + index + '.srp';
    const path = 'C:\\linear\\' + name;
    const lines = [
      'funcra step_' + index + '() {',
      ...(next ? ['  ' + next + '();'] : ['  print("end");']),
      '}',
      '',
    ];
    documents.push(studioDocument('step-' + index, name, path, lines.join('\n')));
    listing.push(listed(name, path));
  }
  return { documents, listing, architecture: buildWorkspaceArchitecture(documents, listing, documents[0].id) };
}

export function importChainFixture(length = 6, cycle = false): ArchitectureFixture {
  const count = Math.max(2, Math.min(24, Math.trunc(length)));
  const documents: StudioDocument[] = [];
  const listing: ListedProjectSource[] = [];
  for (let index = 0; index < count; index++) {
    const name = 'module' + index + '.srp';
    const path = 'C:\\imports\\' + name;
    let target: string | null = null;
    if (index + 1 < count) target = 'module' + (index + 1) + '.srp';
    else if (cycle) target = 'module0.srp';
    const content = [
      ...(target ? ['import "' + target + '" as next;'] : []),
      'funcra module_' + index + '() {',
      '  print(' + index + ');',
      '}',
      '',
    ].join('\n');
    documents.push(studioDocument('module-' + index, name, path, content));
    listing.push(listed(name, path));
  }
  return { documents, listing, architecture: buildWorkspaceArchitecture(documents, listing, documents[0].id) };
}

export function ambiguousCallFixture(): ArchitectureFixture {
  const documents = [
    studioDocument('caller', 'caller.srp', 'C:\\ambiguous\\caller.srp', [
      'funcra main() {',
      '  calculate();',
      '  calculate();',
      '}',
      '',
    ].join('\n')),
    studioDocument('one', 'one.srp', 'C:\\ambiguous\\one.srp', 'funcra calculate() { return; }\n'),
    studioDocument('two', 'two.srp', 'C:\\ambiguous\\two.srp', 'funcra calculate() { return; }\n'),
  ];
  const listing = documents.map(document => listed(document.name, document.path!));
  return { documents, listing, architecture: buildWorkspaceArchitecture(documents, listing, 'caller') };
}

export function shadowedCallFixture(): ArchitectureFixture {
  const documents = [
    studioDocument('caller', 'caller.srp', 'C:\\shadow\\caller.srp', [
      'funcra main() {',
      '  target();',
      '}',
      'bind target = 1;',
      '',
    ].join('\n')),
    studioDocument('function', 'function.srp', 'C:\\shadow\\function.srp', 'funcra target() { return; }\n'),
  ];
  const listing = documents.map(document => listed(document.name, document.path!));
  return { documents, listing, architecture: buildWorkspaceArchitecture(documents, listing, 'caller') };
}

export function deepNestedFixture(depth = 8): ArchitectureFixture {
  const count = Math.max(2, Math.min(20, Math.trunc(depth)));
  const lines: string[] = ['funcra root() {'];
  for (let index = 1; index < count; index++) lines.push('  '.repeat(index) + 'funcra nested_' + index + '() {');
  lines.push('  '.repeat(count) + 'print("deep");');
  for (let index = count - 1; index >= 1; index--) lines.push('  '.repeat(index) + '}');
  lines.push('}', '');
  const document = studioDocument('deep', 'deep.srp', 'C:\\deep\\deep.srp', lines.join('\n'));
  const listing = [listed('deep.srp', document.path!)];
  return { documents: [document], listing, architecture: buildWorkspaceArchitecture([document], listing, 'deep') };
}

export function manySymbolsFixture(count = 48): ArchitectureFixture {
  const total = Math.max(8, Math.min(120, Math.trunc(count)));
  const content = Array.from({ length: total }, (_, index) =>
    (index % 3 === 0 ? 'pub ' : '') + 'funcra function_' + index + '() { return; }').join('\n') + '\n';
  const document = studioDocument('many', 'many.srp', 'C:\\many\\many.srp', content);
  const listing = [listed('many.srp', document.path!)];
  return { documents: [document], listing, architecture: buildWorkspaceArchitecture([document], listing, 'many') };
}

export function repeatedPublicNamesFixture(): ArchitectureFixture {
  const documents = ['a', 'b', 'c'].map(name => studioDocument(
    name,
    name + '.srp',
    'C:\\public\\' + name + '.srp',
    'pub funcra shared_api() { return; }\nfuncra local_' + name + '() { return; }\n',
  ));
  const listing = documents.map(document => listed(document.name, document.path!));
  return { documents, listing, architecture: buildWorkspaceArchitecture(documents, listing, 'a') };
}

export function changedFixture(fixture: ArchitectureFixture): ArchitectureFixture {
  const documents = fixture.documents.map((document, index) => index === 0 ? {
    ...document,
    revision: document.revision + 1,
    content: document.content + '\nfuncra newly_added() { return; }\n',
  } : document);
  return {
    documents,
    listing: fixture.listing,
    architecture: buildWorkspaceArchitecture(documents, fixture.listing, documents[0]?.id ?? null),
  };
}

export function functionId(architecture: WorkspaceArchitecture, name: string, documentId?: string): string {
  const symbol = architecture.symbols.find(item => item.kind === 'function' && item.name === name &&
    (!documentId || item.documentId === documentId));
  if (!symbol) throw new Error('Fixture function not found: ' + name + (documentId ? ' in ' + documentId : ''));
  return symbol.id;
}

export function moduleId(architecture: WorkspaceArchitecture, documentId: string): string {
  const module = architecture.modules.find(item => item.documentId === documentId);
  if (!module) throw new Error('Fixture module not found: ' + documentId);
  return module.id;
}
