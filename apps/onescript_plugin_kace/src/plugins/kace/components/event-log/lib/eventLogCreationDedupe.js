/**
 * @param {Record<string, unknown>} item
 * @returns {unknown}
 */
export function getEventDate(item) {
  return (
    item?.updated_at ??
    item?.new_attributes?.updated_at ??
    item?.new_attributes?.created_at ??
    item?.original_attributes?.updated_at ??
    item?.original_attributes?.created_at
  );
}

/**
 * @param {Record<string, unknown>} item
 * @returns {number}
 */
export function getEventTimeMs(item) {
  const raw = getEventDate(item);
  if (raw == null || raw === '') return 0;
  const t = new Date(String(raw)).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function creationDuplicateKey(item) {
  const ms = getEventTimeMs(item);
  if (ms === 0) return null;
  return `${Math.floor(ms / 1000)}|${item?.creator_name ?? ''}`;
}

function preferredCreation(current, candidate) {
  const currentId = String(current?.item?.id ?? '');
  const candidateId = String(candidate?.item?.id ?? '');
  if (currentId && candidateId && candidateId < currentId) return candidate;
  return current;
}

export function dedupeCreationsByEventTime(rows) {
  const source = Array.isArray(rows) ? rows : [];
  const winnerByKey = new Map();
  source.forEach((row) => {
    if (!row?.isCreation) return;
    const key = creationDuplicateKey(row.item);
    if (key == null) return;
    const current = winnerByKey.get(key);
    winnerByKey.set(key, current ? preferredCreation(current, row) : row);
  });

  const emittedKeys = new Set();
  const result = [];
  source.forEach((row) => {
    if (!row?.isCreation) {
      result.push(row);
      return;
    }
    const key = creationDuplicateKey(row.item);
    if (key == null) {
      result.push(row);
      return;
    }
    if (emittedKeys.has(key)) return;
    emittedKeys.add(key);
    result.push(winnerByKey.get(key));
  });
  return result;
}
