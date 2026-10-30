export function mergeScriptSelectOptions(previous, incoming, append) {
  if (append === true) {
    const base = Array.isArray(previous) ? previous : [];
    const inc = Array.isArray(incoming) ? incoming : [];
    const combined = [...base, ...inc];
    const keysSeen = new Set();
    const ordered = [];
    for (let i = combined.length - 1; i >= 0; i -= 1) {
      const o = combined[i];
      if (!o || o.value === undefined) {
        continue;
      }
      const k = String(o.value);
      if (keysSeen.has(k)) {
        continue;
      }
      keysSeen.add(k);
      ordered.push(o);
    }
    return ordered.reverse();
  }
  if (!Array.isArray(incoming)) {
    return [];
  }
  return incoming.map((o) => ({ ...o }));
}
