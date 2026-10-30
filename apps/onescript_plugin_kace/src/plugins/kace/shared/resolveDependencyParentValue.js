export const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const objectHasOwn = (obj, key) =>
  Object.prototype.hasOwnProperty.call(obj, key);

export const formioTypeNestsData = (type) =>
  type === 'container' ||
  type === 'editgrid' ||
  type === 'datagrid' ||
  type === 'form' ||
  type === 'tree';

export const formioTypeNestsArray = (type) =>
  type === 'editgrid' || type === 'datagrid';

export const toDependencyPathKeys = (path) => {
  if (!Array.isArray(path)) return [];
  const keys = [];
  for (const segment of path) {
    if (typeof segment === 'string' && segment !== '') {
      keys.push(segment);
      continue;
    }
    if (
      segment &&
      typeof segment === 'object' &&
      typeof segment.key === 'string' &&
      segment.key !== ''
    ) {
      keys.push(segment.key);
    }
  }
  return keys;
};

export const nextDependencyPath = (path, type, key) => {
  const base = Array.isArray(path) ? path : [];
  if (!formioTypeNestsData(type) || typeof key !== 'string' || key === '') {
    return base;
  }
  return [...base, { key, nestsArray: formioTypeNestsArray(type) }];
};

export const dependencyPathFromFormioPath = (formioPath, fieldKey) => {
  if (typeof formioPath !== 'string' || formioPath.trim() === '') return [];
  const segments = formioPath.split('.').flatMap((seg) => {
    const name = seg.replace(/\[\d+\]/g, '');
    return name ? [name] : [];
  });
  if (
    typeof fieldKey === 'string' &&
    segments[segments.length - 1] === fieldKey
  ) {
    segments.pop();
  }
  return segments;
};

const getAtPath = (rootData, path) => {
  let current = rootData;
  for (const segment of path) {
    if (!isPlainObject(current)) return undefined;
    current = current[segment];
  }
  return current;
};

export const resolveDependencyParentScope = (
  rootData,
  path,
  dependsOn,
  localData
) => {
  if (typeof dependsOn !== 'string' || dependsOn === '') {
    return { value: undefined, scope: 'none' };
  }

  const pathArr = toDependencyPathKeys(path);
  const seen = new Set();

  const consider = (obj, scope) => {
    if (!isPlainObject(obj) || seen.has(obj)) return null;
    seen.add(obj);
    if (objectHasOwn(obj, dependsOn)) {
      return { value: obj[dependsOn], scope };
    }
    return null;
  };

  const local =
    localData !== undefined
      ? localData
      : pathArr.length === 0
        ? rootData
        : getAtPath(rootData, pathArr);
  const localScope = pathArr.length === 0 ? 'root' : 'local';
  const localHit = consider(local, localScope);
  if (localHit) return localHit;

  for (let i = pathArr.length - 1; i >= 0; i -= 1) {
    const obj = i === 0 ? rootData : getAtPath(rootData, pathArr.slice(0, i));
    const hit = consider(obj, 'ancestor');
    if (hit) return hit;
  }

  return { value: undefined, scope: 'none' };
};

export const resolveDependencyParentValue = (
  rootData,
  path,
  dependsOn,
  localData
) => resolveDependencyParentScope(rootData, path, dependsOn, localData).value;
