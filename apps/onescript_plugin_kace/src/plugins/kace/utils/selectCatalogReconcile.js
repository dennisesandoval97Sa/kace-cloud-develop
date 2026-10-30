export function isSelectValueInCatalog(value, allOptions) {
  if (!Array.isArray(allOptions)) return true;
  if (value === null || value === undefined || value === '') return true;
  return allOptions.some((o) => o && String(o.value) === String(value));
}

export function pruneMultiselectToCatalog(selected, options) {
  if (!Array.isArray(selected)) return [];
  if (!Array.isArray(options)) return selected;
  return selected.filter(
    (s) => s && options.some((o) => o && String(o.value) === String(s.value))
  );
}
