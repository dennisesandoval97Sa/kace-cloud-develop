import { ClassificationsCreateOptions } from '#plugins/kace/shared/ClassificationsCreateOptions.js';

function findTreeNodeByStoredValue(nodes, stored) {
  if (
    !Array.isArray(nodes) ||
    stored === undefined ||
    stored === null ||
    stored === ''
  ) {
    return null;
  }
  const needle = String(stored);
  return (
    nodes.find((o) => String(o.value) === needle) ??
    nodes.find((o) => String(o.label ?? o.value) === needle) ??
    null
  );
}

export function validateSelectionAgainstTree(tree, selection) {
  if (
    !Array.isArray(tree) ||
    !tree.length ||
    !selection ||
    typeof selection !== 'object'
  ) {
    return {};
  }
  const out = {};
  let current = tree;
  for (let i = 1; i <= 64; i++) {
    const key = `nivel${i}`;
    const val = selection[key];
    if (val === undefined || val === null || val === '') break;
    const found = findTreeNodeByStoredValue(current, val);
    if (!found) break;
    out[key] = String(found.value);
    if (!found.options?.length) break;
    current = found.options;
  }
  return out;
}

export function buildLevelLabelsFromTree(tree, selectedOptions) {
  if (
    !Array.isArray(tree) ||
    !tree.length ||
    !selectedOptions ||
    typeof selectedOptions !== 'object'
  ) {
    return {};
  }
  const out = {};
  let current = tree;
  for (let i = 1; i <= 64; i++) {
    const key = `nivel${i}`;
    const val = selectedOptions[key];
    if (val === undefined || val === null || val === '') break;
    const found = findTreeNodeByStoredValue(current, val);
    if (!found) break;
    const label =
      found.label != null && String(found.label).trim() !== ''
        ? String(found.label)
        : String(found.value);
    out[key] = label;
    if (!Array.isArray(found.options) || !found.options.length) break;
    current = found.options;
  }
  return out;
}

export function buildLevelLabelsForOutput(tree, selectedOptions) {
  const fromTree = buildLevelLabelsFromTree(tree, selectedOptions);
  if (Object.keys(fromTree).length) return fromTree;
  return readLevelValuesFromData(selectedOptions);
}

export function resolveSelectionFromData(tree, data, componentKey) {
  return validateSelectionAgainstTree(
    tree,
    readLevelValuesFromData(data, componentKey)
  );
}

export function countStoreClassificationLevels(configLabels) {
  const keys = Object.keys(configLabels || {}).filter((k) =>
    k.startsWith('label_')
  );
  return keys.reduce((max, key) => {
    const num = parseInt(String(key.split('_')[1]), 10);
    return Number.isFinite(num) ? Math.max(max, num) : max;
  }, 0);
}

export function classificationTreeSelectDepth(nodes) {
  if (!Array.isArray(nodes) || !nodes.length) return 0;
  let max = 1;
  for (const o of nodes) {
    if (o.options && o.options.length > 0) {
      max = Math.max(max, 1 + classificationTreeSelectDepth(o.options));
    }
  }
  return max;
}

export function buildLevelKeys(storeLevelKeys, N, overrides = {}) {
  const merged = {};
  for (let i = 1; i <= N; i++) {
    const k = `nivel${i}`;
    const fromStore = storeLevelKeys[k];
    merged[k] = fromStore || `Nivel ${i}`;
    if (overrides[k]) merged[k] = overrides[k];
  }
  return merged;
}

export function readLevelValuesFromData(data, componentKey) {
  if (!data || typeof data !== 'object') return {};
  const out = {};
  const nested =
    componentKey && data[componentKey] && typeof data[componentKey] === 'object'
      ? data[componentKey]
      : null;
  for (let i = 1; i <= 5; i++) {
    const key = `nivel${i}`;
    let val = data[key];
    if ((val === undefined || val === null || val === '') && nested) {
      val = nested[key];
    }
    if (val !== undefined && val !== null && val !== '') {
      out[key] = String(val);
    }
  }
  return out;
}

export function shouldShowClassificationLevel(nivel, tree, selectedOptions) {
  const num = parseInt(String(nivel).replace('nivel', ''), 10);
  if (!Number.isFinite(num) || num <= 1) return true;
  const parentKey = `nivel${num - 1}`;
  const parentValue = selectedOptions[parentKey];
  if (!parentValue) return false;
  let current = tree;
  for (let i = 1; i < num; i++) {
    const key = `nivel${i}`;
    const val = selectedOptions[key];
    if (!val || !Array.isArray(current)) return false;
    const found = findTreeNodeByStoredValue(current, val);
    if (!found) return false;
    if (i === num - 1) {
      return Boolean(found.options?.length);
    }
    current = found.options;
  }
  return false;
}

export function buildOptionsFromClassifications(classifications) {
  return ClassificationsCreateOptions(
    Array.isArray(classifications) ? classifications : []
  );
}
