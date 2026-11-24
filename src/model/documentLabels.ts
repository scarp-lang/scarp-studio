import type { StudioDocument } from './documents';

/** Show the shortest distinct folder suffix for similarly named sources.
 * Only display labels change, never source ids or save paths. */
export function disambiguateDocumentNames(
  documents: readonly Pick<StudioDocument, 'id' | 'name' | 'path'>[],
): Map<string, string> {
  const labels = new Map(documents.map(document => [document.id, document.name]));
  const groups = new Map<string, typeof documents[number][]>();
  for (const document of documents) {
    const key = document.name.toLowerCase();
    const group = groups.get(key) ?? [];
    group.push(document);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const segments = group.map(document => document.path
      ? document.path.replace(/\\/g, '/').split('/').filter(Boolean)
      : [document.name]);
    const maxDepth = Math.max(...segments.map(parts => parts.length));
    let unique = false;
    for (let depth = 2; depth <= maxDepth; depth++) {
      const candidates = segments.map(parts => parts.slice(-depth).join('/'));
      if (new Set(candidates.map(label => label.toLowerCase())).size === group.length) {
        group.forEach((document, index) => labels.set(document.id, candidates[index]));
        unique = true;
        break;
      }
    }
    if (!unique) group.forEach((document, index) => {
      labels.set(document.id, document.name + ' (' + (index + 1) + ')');
    });
  }
  return labels;
}
