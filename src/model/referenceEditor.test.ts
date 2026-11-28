import { describe, expect, it } from 'vitest';
import { createUntitled, type StudioDocument } from './documents';
import {
  buildReferenceInventory, DEFAULT_REFERENCE_LAYOUT, MAX_REFERENCE_CHOICES,
  MAX_REFERENCE_SOURCE_UNITS, planReferenceSwap, reconcileReferenceSelection,
  referenceShare, resolveReferenceSource, updateReferenceLayout,
} from './referenceEditor';

function source(id: string, content = 'print(1);', savedContent = content): StudioDocument {
  return { id, name: id + '.srp', path: null, content, savedContent, revision: 1 };
}

describe('reference editor selection', () => {
  const a = source('a');
  const b = source('b', 'print(2);', '');
  it('requires an explicit open source selection', () => {
    expect(resolveReferenceSource([a,b], a.id, null)).toEqual({ kind: 'none' });
    expect(resolveReferenceSource([a,b], a.id, 'missing')).toEqual({ kind: 'closed' });
    expect(resolveReferenceSource([a,b], a.id, a.id)).toEqual({ kind: 'same-active' });
  });
  it('returns the exact live working buffer without altering saved text', () => {
    expect(resolveReferenceSource([a,b], a.id, b.id)).toEqual({ kind: 'available', document: b });
    const changed = { ...b, revision: 2, content: 'print(3);' };
    const resolved = resolveReferenceSource([a,changed], a.id, b.id);
    expect(resolved.kind).toBe('available');
    if (resolved.kind === 'available') {
      expect(resolved.document).toBe(changed);
      expect(resolved.document.savedContent).toBe('');
    }
  });
  it('rejects duplicate IDs even when all contents agree', () => {
    expect(resolveReferenceSource([a,b,{ ...b }], a.id, b.id)).toEqual({ kind: 'ambiguous' });
    expect(reconcileReferenceSelection(b.id,[a,b,{ ...b }])).toBeNull();
    expect(planReferenceSwap([a,b,{ ...b }],a.id,b.id)).toBeNull();
  });
  it('clears a closed selection and preserves a live selection on reorder', () => {
    expect(reconcileReferenceSelection(b.id,[b,a])).toBe(b.id);
    expect(reconcileReferenceSelection(b.id,[a])).toBeNull();
    expect(reconcileReferenceSelection(null,[a,b])).toBeNull();
  });
  it('bounds reference text but does not affect the primary source', () => {
    const exact = source('exact','x'.repeat(MAX_REFERENCE_SOURCE_UNITS));
    const huge = source('huge','x'.repeat(MAX_REFERENCE_SOURCE_UNITS + 1));
    expect(resolveReferenceSource([a,exact],a.id,exact.id).kind).toBe('available');
    expect(resolveReferenceSource([a,huge],a.id,huge.id).kind).toBe('too-large');
    expect(planReferenceSwap([huge,a],huge.id,a.id)).toBeNull();
    expect(resolveReferenceSource([huge,a],huge.id,a.id).kind).toBe('available');
  });
  it('can reference an untitled empty source', () => {
    const empty = createUntitled(3);
    expect(resolveReferenceSource([a,empty],a.id,empty.id)).toEqual({kind:'available',document:empty});
  });
});

describe('reference inventory', () => {
  it('labels dirty and active sources without copying their contents', () => {
    const a = source('a');
    const b = source('b','UNSAVED SECRET','');
    const inventory = buildReferenceInventory([a,b],a.id,b.id);
    expect(inventory.choices).toEqual([
      {id:'a',label:'a.srp',active:true,modified:false,unavailable:false},
      {id:'b',label:'b.srp',active:false,modified:true,unavailable:false},
    ]);
    expect(JSON.stringify(inventory)).not.toContain('UNSAVED SECRET');
  });
  it('includes current and selected IDs after large tab reorder', () => {
    const documents = Array.from({length:MAX_REFERENCE_CHOICES + 20},(_,i)=>source('doc-' + i));
    const active = documents.at(-1)!;
    const selected = documents.at(-2)!;
    const result = buildReferenceInventory(documents,active.id,selected.id);
    expect(result.choices).toHaveLength(MAX_REFERENCE_CHOICES);
    expect(result.total).toBe(documents.length);
    expect(result.limited).toBe(true);
    expect(result.choices.at(-1)?.id).toBe(active.id);
    expect(result.choices.at(-2)?.id).toBe(selected.id);
    expect(new Set(result.choices.map(item=>item.id)).size).toBe(MAX_REFERENCE_CHOICES);
  });
  it('omits duplicate identities and reports ambiguity', () => {
    const a = source('a');
    const b = source('b');
    const result = buildReferenceInventory([a,b,{...a}],a.id,b.id);
    expect(result.choices.map(item=>item.id)).toEqual([b.id]);
    expect(result.ambiguous).toBe(true);
    expect(result.total).toBe(1);
  });
  it('reports large buffers as unavailable without discarding other choices', () => {
    const a = source('a');
    const b = source('b','x'.repeat(MAX_REFERENCE_SOURCE_UNITS+1));
    expect(buildReferenceInventory([a,b],a.id,b.id).choices[1].unavailable).toBe(true);
  });
  it('keeps duplicate basenames distinguishable', () => {
    const a = {...source('a'),name:'main.srp',path:'/one/main.srp'};
    const b = {...source('b'),name:'main.srp',path:'/two/main.srp'};
    const result = buildReferenceInventory([a,b],a.id,b.id);
    expect(result.choices[0].label).not.toEqual(result.choices[1].label);
  });
});

describe('reference swap planning', () => {
  const a = source('a','first','');
  const b = source('b','second');
  it('exchanges identities without creating or changing source documents', () => {
    const docs = Object.freeze([Object.freeze(a),Object.freeze(b)]);
    expect(planReferenceSwap(docs,a.id,b.id)).toEqual({primaryId:b.id,referenceId:a.id});
    expect(planReferenceSwap(docs,b.id,a.id)).toEqual({primaryId:a.id,referenceId:b.id});
    expect(docs[0].content).toBe('first');
    expect(docs[1].content).toBe('second');
  });
  it('rejects missing, duplicate and same-active primary references', () => {
    expect(planReferenceSwap([a,b],null,b.id)).toBeNull();
    expect(planReferenceSwap([a,b],'missing',b.id)).toBeNull();
    expect(planReferenceSwap([a,b,{...a}],a.id,b.id)).toBeNull();
    expect(planReferenceSwap([a,b],a.id,a.id)).toBeNull();
    expect(planReferenceSwap([a,b],a.id,null)).toBeNull();
  });
});

describe('reference layout', () => {
  it('normalizes finite and non-finite size requests', () => {
    expect(referenceShare(0)).toBe(25);
    expect(referenceShare(100)).toBe(75);
    expect(referenceShare(42.8)).toBe(43);
    expect(referenceShare(NaN)).toBe(50);
    expect(referenceShare(Infinity)).toBe(50);
  });
  it('preserves layout identity for no-op requests', () => {
    expect(updateReferenceLayout(DEFAULT_REFERENCE_LAYOUT,{})).toBe(DEFAULT_REFERENCE_LAYOUT);
    expect(updateReferenceLayout(DEFAULT_REFERENCE_LAYOUT,{share:50})).toBe(DEFAULT_REFERENCE_LAYOUT);
  });
  it('updates independent layout fields and bounds size', () => {
    const stacked = updateReferenceLayout(DEFAULT_REFERENCE_LAYOUT,{orientation:'vertical'});
    expect(stacked).toEqual({orientation:'vertical',share:50});
    expect(updateReferenceLayout(stacked,{share:90})).toEqual({orientation:'vertical',share:75});
    expect(DEFAULT_REFERENCE_LAYOUT).toEqual({orientation:'horizontal',share:50});
  });
});
