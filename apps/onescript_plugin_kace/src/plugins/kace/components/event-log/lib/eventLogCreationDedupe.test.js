import { describe, expect, it } from 'vitest';
import { dedupeCreationsByEventTime } from './eventLogCreationDedupe.js';

function historyItem(id, createdAtIso, creatorName = 'Ana Pérez') {
  return {
    id,
    entity_id: 'entity-1',
    changed_attributes: {},
    new_attributes: { id: 'entity-1', created_at: createdAtIso },
    original_attributes: {},
    creator_name: creatorName,
  };
}

function creationRow(id, createdAtIso, creatorName) {
  return {
    isCreation: true,
    item: historyItem(id, createdAtIso, creatorName),
    comparison: [],
    hasComparison: false,
  };
}

function changeRow(id, createdAtIso) {
  return {
    isCreation: false,
    item: historyItem(id, createdAtIso),
    comparison: [{ key: 'status', oldValue: 'a', newValue: 'b' }],
    hasComparison: true,
  };
}

const SAME = '2026-10-14T13:59:25.000Z';
const SAME_LATER_MS = '2026-10-14T13:59:25.800Z';
const LATER = '2026-10-14T14:01:00.000Z';

describe('dedupeCreationsByEventTime', () => {
  it('returns an empty list for missing input', () => {
    expect(dedupeCreationsByEventTime(null)).toEqual([]);
    expect(dedupeCreationsByEventTime(undefined)).toEqual([]);
    expect(dedupeCreationsByEventTime([])).toEqual([]);
  });

  it('keeps a single creation unchanged', () => {
    const rows = [creationRow('c1', SAME)];
    expect(dedupeCreationsByEventTime(rows)).toEqual(rows);
  });

  it('keeps only one creation when several share new_attributes.created_at', () => {
    const rows = [
      creationRow('c1', SAME),
      creationRow('c2', SAME),
      creationRow('c3', SAME_LATER_MS),
      creationRow('c4', SAME),
    ];
    const result = dedupeCreationsByEventTime(rows);
    expect(result).toHaveLength(1);
    expect(result[0].item.id).toBe('c1');
  });

  it('keeps one creation per distinct created_at second', () => {
    const rows = [
      creationRow('c1', SAME),
      creationRow('c2', SAME),
      creationRow('c3', LATER),
    ];
    const result = dedupeCreationsByEventTime(rows);
    expect(result.map((row) => row.item.id)).toEqual(['c1', 'c3']);
  });

  it('does not drop non-creation rows, even at the same created_at', () => {
    const rows = [
      changeRow('d1', SAME),
      creationRow('c1', SAME),
      changeRow('d2', SAME),
      creationRow('c2', SAME),
    ];
    const result = dedupeCreationsByEventTime(rows);
    expect(result.map((row) => row.item.id)).toEqual(['d1', 'c1', 'd2']);
  });

  it('keeps two creations at the same second when the author differs', () => {
    const rows = [
      creationRow('h1', SAME, 'Ana Pérez'),
      creationRow('h2', SAME, 'Luis'),
    ];
    const result = dedupeCreationsByEventTime(rows);
    expect(
      result.map((row) => `${row.item.id}/${row.item.creator_name}`)
    ).toEqual(['h1/Ana Pérez', 'h2/Luis']);
  });

  it('does not collapse creations without a resolvable date', () => {
    const rows = [
      creationRow('c1', ''),
      creationRow('c2', 'not-a-date'),
      creationRow('c3', null),
    ];
    expect(dedupeCreationsByEventTime(rows).map((row) => row.item.id)).toEqual([
      'c1',
      'c2',
      'c3',
    ]);
  });

  it('keeps the same creation for any permutation of rows that share a key', () => {
    const shared = [
      creationRow('c2', SAME),
      creationRow('c1', SAME),
      creationRow('c3', SAME_LATER_MS),
    ];
    const permutations = [
      shared,
      [shared[1], shared[0], shared[2]],
      [shared[2], shared[1], shared[0]],
      [shared[0], shared[2], shared[1]],
    ];
    const keptIds = permutations.map((rows) =>
      dedupeCreationsByEventTime(rows).map((row) => row.item.id)
    );
    keptIds.forEach((ids) => {
      expect(ids).toEqual(['c1']);
    });
  });
});
