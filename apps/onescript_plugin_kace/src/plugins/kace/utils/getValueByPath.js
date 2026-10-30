export function getValueByPath(obj, path) {
  if (!obj || !path) return undefined;
  const keys = path.split('.');
  let ref = obj;
  for (const key of keys) {
    if (ref == null || !(key in ref)) return undefined;
    ref = ref[key];
  }
  return ref;
}
