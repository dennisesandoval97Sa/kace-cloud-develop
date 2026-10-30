/**
 * @typedef {{ [x: string]: any; schema: import('formiojs').ExtendedComponentSchema; }} BuilderInfo
 */

/**
 * @template {{ builderInfo: BuilderInfo }} T
 * @param {Partial<Record<string, T>>} components
 * @returns {Record<string, BuilderInfo>}
 */
export const getComponentsBuilderInfoObject = (components) =>
  Object.entries(components).reduce((acc, [key, component]) => {
    acc[key] = component.builderInfo;
    return acc;
  }, {});

const flattenObject = (obj, parentKey = '', result = {}) =>
  Object.entries(obj).reduce((acc, [key, value]) => {
    const flattenKey = parentKey ? `${parentKey}.${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value))
      flattenObject(value, flattenKey, acc);
    else acc[flattenKey] = value;

    return acc;
  }, result);
