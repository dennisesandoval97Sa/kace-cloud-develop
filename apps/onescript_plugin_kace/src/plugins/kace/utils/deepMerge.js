/**
 * Performs a deep merge of objects: does not mutate target; nested objects are recursively merged.
 * Arrays and primitive values from source overwrite those in target.
 *
 * @param {Object} target - Base object
 * @param {Object} source - Object whose properties are merged into target
 * @returns {Object} New object resulting from the merge (target is not modified)
 */
export function deepMerge(target, source) {
  if (source == null || typeof source !== 'object') return target;
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    if (
      srcVal != null &&
      typeof srcVal === 'object' &&
      !Array.isArray(srcVal) &&
      typeof result[key] === 'object' &&
      result[key] != null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], srcVal);
    } else {
      result[key] = srcVal;
    }
  }
  return result;
}
