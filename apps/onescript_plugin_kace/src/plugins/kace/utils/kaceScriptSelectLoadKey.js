export function makeLoadCacheKey({
  componentKey,
  page,
  remoteTerm,
  dependencySignature,
}) {
  const key = String(componentKey ?? '');
  const p = Number(page) || 1;
  const term = String(remoteTerm ?? '');
  const dep =
    dependencySignature === undefined || dependencySignature === null
      ? ''
      : String(dependencySignature);
  return `${key}\u001f${p}\u001f${term}\u001f${dep}`;
}
