/**
 * @fileoverview Pure utility functions extracted from useSchema hook.
 * These functions are stateless and depend only on their arguments,
 * making them independently unit-testable.
 */

import {
  isPlainObject,
  nextDependencyPath,
  resolveDependencyParentScope,
  toDependencyPathKeys,
} from '#plugins/kace/shared/resolveDependencyParentValue.js';
import {
  DS_KEY_UI,
  DS_UI_INPUT_TYPE_CURRENCY,
  DS_UI_INPUT_TYPE_TEXT,
  DS_UI_KEY_CSS,
  DS_UI_KEY_INPUT_TYPE,
  DS_UI_KEY_IS_VISIBLE,
  DS_UI_KEY_LABEL,
  DS_UI_KEY_MODIFIED,
  DS_UI_KEY_READ_ONLY,
  FORMIO_NUMBER_COMPONENT_TYPES,
} from '#plugins/kace/shared/kace-events.constants.js';

/**
 * Parses a comma-separated dependency value string into an array of typed values.
 * Mirrors the logic of DependencyHelper.#parseDependencyValues on the backend.
 *
 * @param {string} rawValue
 * @returns {string[]}
 */
export const parseDependencyValues = (rawValue) => {
  const raw = typeof rawValue === 'string' ? rawValue : '';
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v);
};

/**
 * Evaluates whether a dependent field should be active (visible/validated)
 * given the current form data.
 * Mirrors the condition logic in DependencyHelper.applyConditionalRequired.
 *
 * @param {object} rule - The data_structure rule for the field.
 * @param {unknown} parentValue - The current value of the parent field (rule.dependsOn).
 * @returns {boolean}
 */
export const evaluateDependency = (rule, parentValue) => {
  if (!rule.dependency || !rule.dependsOn) return true;

  if (rule.dependencyValueValidation) {
    const rawValue =
      typeof rule.dependencyValue === 'string' ? rule.dependencyValue : '';

    if (rawValue.includes(',')) {
      const expectedValues = parseDependencyValues(rawValue);
      return (
        parentValue != null &&
        parentValue !== '' &&
        expectedValues.includes(String(parentValue))
      );
    }

    return (
      parentValue != null &&
      parentValue !== '' &&
      (parentValue == rule.dependencyValue ||
        String(parentValue) == String(rule.dependencyValue))
    );
  }

  return (
    parentValue !== undefined && parentValue !== null && parentValue !== ''
  );
};

const toPathSegments = (path) => {
  if (!Array.isArray(path)) return [];
  const segments = [];
  for (const segment of path) {
    if (typeof segment === 'string' && segment !== '') {
      segments.push({ key: segment, nestsArray: false });
      continue;
    }
    if (
      segment &&
      typeof segment === 'object' &&
      typeof segment.key === 'string' &&
      segment.key !== ''
    ) {
      segments.push({
        key: segment.key,
        nestsArray: Boolean(segment.nestsArray),
      });
    }
  }
  return segments;
};

const lastGridIndex = (segments) => {
  let index = -1;
  for (let i = 0; i < segments.length; i += 1) {
    if (segments[i].nestsArray) index = i;
  }
  return index;
};

const buildDependencyValueAccessor = (dependsOn, path, isInEditGrid) => {
  const segments = toPathSegments(path);
  const keys = segments.map((segment) => segment.key);
  const gridIndex = lastGridIndex(segments);
  const rowSuffix = gridIndex >= 0 ? keys.slice(gridIndex + 1) : [];
  const keyLit = JSON.stringify(dependsOn);

  const lines = [];
  if (isInEditGrid) {
    if (rowSuffix.length > 0) {
      lines.push(`consider(at(row,${JSON.stringify(rowSuffix)}));`);
    }
    lines.push('consider(row);');
  }
  for (let i = keys.length; i >= 0; i -= 1) {
    if (i === 0) {
      lines.push('consider(data);');
    } else {
      lines.push(`consider(at(data,${JSON.stringify(keys.slice(0, i))}));`);
    }
  }

  return `(function(){var at=function(o,p){for(var i=0;i<p.length;i++){if(o==null||typeof o!=='object')return undefined;o=o[p[i]];}return o;};var has=function(obj,key){return obj!=null&&typeof obj==='object'&&!Array.isArray(obj)&&Object.prototype.hasOwnProperty.call(obj,key);};var value;var found=false;var consider=function(obj){if(!found&&has(obj,${keyLit})){value=obj[${keyLit}];found=true;}};${lines.join('')}return value;})()`;
};

/**
 * Generates the Form.io `customConditional` JS expression string for a dependent field.
 *
 * @param {object} rule - The data_structure rule for the field.
 * @param {string} key - The field key (unused directly, kept for API symmetry).
 * @param {boolean} [isInEditGrid=false] - Whether the field is inside an editgrid/datagrid.
 * @param {string[]} [path=[]] - Nested data path segments for resolving the parent field value.
 * @returns {string|null} The JS expression string, or null if the field has no dependency.
 */
export const buildCustomConditional = (
  rule = {},
  key,
  isInEditGrid = false,
  path = []
) => {
  const dependsOn = rule.dependsOn;
  if (!rule.dependency || !dependsOn) return null;

  const valueAccessor = buildDependencyValueAccessor(
    dependsOn,
    path,
    isInEditGrid
  );

  if (rule.dependencyValueValidation) {
    const rawValue =
      typeof rule.dependencyValue === 'string' ? rule.dependencyValue : '';

    if (rawValue.includes(',')) {
      const list = parseDependencyValues(rawValue);
      return `const value = ${valueAccessor}; const normalizedValue = value != null && value !== '' ? String(value) : ''; show = [${list.map((v) => JSON.stringify(v)).join(',')}].includes(normalizedValue);`;
    }

    const expected = JSON.stringify(rule.dependencyValue);
    return `const value = ${valueAccessor}; show = value != null && value !== '' && (value == ${expected} || String(value) == String(${expected}));`;
  }

  return `const value = ${valueAccessor}; show = value !== undefined && value !== null && value !== '';`;
};

/**
 * Returns the required validation flag for a Form.io component based on its data_structure rule.
 *
 * Returns `false` (not `null`) when `required` is not defined in the rule, so that any
 * `validate.required = true` coming from the original Form.io JSON is overridden and the
 * component does not stay visible/required when its dependency condition is not met.
 *
 * @param {object} [rule={}]
 * @returns {boolean|null} `null` only when `rule` itself is absent/invalid (no data_structure entry for this key).
 */
export const buildRequiredValidation = (rule = {}) => {
  if (!rule || typeof rule !== 'object') return null;
  if (typeof rule.required === 'undefined') return false;
  return Boolean(rule.required);
};

/**
 * Merges `data_structure` UI overrides onto a Form.io component when `ui.ui_modified === true`.
 *
 * @param {Record<string, unknown>|null|undefined} rule - Rule for `data_structure[component.key]`.
 * @param {Record<string, unknown>} component - Mutable Form.io component clone.
 */
export const applyUiOverrides = (rule, component) => {
  try {
    const ui = rule?.[DS_KEY_UI];
    if (!ui || typeof ui !== 'object' || ui[DS_UI_KEY_MODIFIED] !== true) {
      return;
    }

    if (
      typeof ui[DS_UI_KEY_LABEL] === 'string' &&
      String(ui[DS_UI_KEY_LABEL]).trim() !== ''
    ) {
      component.label = ui[DS_UI_KEY_LABEL];
    }

    if (typeof ui[DS_UI_KEY_CSS] === 'string') {
      component.customClass = ui[DS_UI_KEY_CSS];
    }

    if (typeof ui[DS_UI_KEY_IS_VISIBLE] !== 'undefined') {
      component.hidden = !ui[DS_UI_KEY_IS_VISIBLE];
    }

    if (typeof ui[DS_UI_KEY_READ_ONLY] !== 'undefined') {
      component.disabled = Boolean(ui[DS_UI_KEY_READ_ONLY]);
    }

    const inputType = ui[DS_UI_KEY_INPUT_TYPE];
    if (inputType === DS_UI_INPUT_TYPE_TEXT || inputType == null) {
      return;
    }

    if (inputType === DS_UI_INPUT_TYPE_CURRENCY) {
      const compType = component?.type;
      if (FORMIO_NUMBER_COMPONENT_TYPES.includes(compType)) {
        // Display-only: Form.io Number strips thousandsSeparator/decimalSymbol on read via
        // parseNumber() -> parseFloat; submission.data keeps a JS number, not the masked string.
        component.delimiter = true;
        component.thousandsSeparator = ',';
        component.decimalSymbol = '.';
      }
    }
  } catch (err) {
    console.error('[useSchema] applyUiOverrides error', err);
  }
};

/**
 * Recursively walks a Form.io `components` tree, injecting `customConditional`,
 * `kaceValidation`, `validate.required` and UI overrides derived from the
 * `data_structure` rules. `path` accumulates the nested data keys crossed so
 * far (only `container`/`editgrid`/`datagrid` lengthen it, per
 * `nextDependencyPath`), so nested `customConditional` expressions can read
 * the right sibling/ancestor object at runtime.
 *
 * @param {Array<Record<string, unknown>>} list - Form.io components array.
 * @param {Record<string, object>} ds - `data_structure` scoped to this level.
 * @param {boolean} [isInEditGrid=false] - Whether this level is inside an editgrid/datagrid.
 * @param {string[]} [path=[]] - Nested data path segments accumulated so far.
 * @returns {Array<Record<string, unknown>>}
 */
export const transformFormioComponents = (
  list,
  ds,
  isInEditGrid = false,
  path = []
) => {
  if (!Array.isArray(list)) return list;
  return list.map((comp) => {
    const copy = { ...comp };
    const rule = ds?.[copy.key];
    const customConditional = buildCustomConditional(
      rule,
      copy.key,
      isInEditGrid,
      path
    );
    if (customConditional) {
      copy.customConditional = customConditional;
    }
    if (rule) {
      copy.kaceValidation = rule;
    }

    const requiredValidation = buildRequiredValidation(rule);
    if (requiredValidation !== null) {
      copy.validate = {
        ...(copy.validate || {}),
        required: requiredValidation,
      };
    }

    applyUiOverrides(rule, copy);

    const nestedDataStructure = rule?.data_structure ?? ds;
    const isGridComponent =
      copy.type === 'editgrid' || copy.type === 'datagrid';
    const childPath = nextDependencyPath(path, copy.type, copy.key);
    const childInGrid = isGridComponent || isInEditGrid;

    if (Array.isArray(copy.components) && copy.components.length) {
      copy.components = transformFormioComponents(
        copy.components,
        nestedDataStructure,
        childInGrid,
        childPath
      );
    }

    if (Array.isArray(copy.columns) && copy.columns.length) {
      copy.columns = copy.columns.map((col) => ({
        ...col,
        components: transformFormioComponents(
          col.components || [],
          nestedDataStructure,
          childInGrid,
          childPath
        ),
      }));
    }

    if (Array.isArray(copy.tabs) && copy.tabs.length) {
      copy.tabs = copy.tabs.map((tab) => ({
        ...tab,
        components: transformFormioComponents(
          tab.components || [],
          nestedDataStructure,
          childInGrid,
          childPath
        ),
      }));
    }

    if (Array.isArray(copy.rows) && copy.rows.length) {
      copy.rows = copy.rows.map((row) => {
        if (Array.isArray(row)) {
          return row.map((col) => ({
            ...col,
            components: transformFormioComponents(
              col.components || [],
              nestedDataStructure,
              childInGrid,
              childPath
            ),
          }));
        }
        return row;
      });
    }

    if (
      isGridComponent &&
      Array.isArray(copy.components) &&
      copy.components.length
    ) {
      copy.components = transformFormioComponents(
        copy.components,
        nestedDataStructure,
        true,
        childPath
      );
    }

    return copy;
  });
};

/**
 * Keys that survive when a dependent field is inactive.
 * Everything else (validators: min, max, required, email…) is dropped automatically,
 * so no explicit validator list needs to be maintained.
 */
const STRUCTURAL_KEYS = new Set([
  'type',
  'dependency',
  'dependsOn',
  'dependencyValue',
  'dependencyValueValidation',
  'ui',
  'sources',
  'data_structure',
  'unique',
]);

/**
 * Pre-processes a data_structure schema by evaluating dependency conditions against
 * the current form data.
 *
 * - **Inactive fields**: every key not in `STRUCTURAL_KEYS` is deleted, so neither
 *   Form.io nor the Joi SchemaBuilder applies any constraint on them. New validators
 *   are suppressed automatically without touching the code.
 *   Structural keys (`type`, `dependency`, `dependsOn`, …) are preserved so
 *   SchemaBuilder can still emit the correct `Joi.when()` wrapper.
 * - **Active fields**: dependency keys are dropped only when the parent was
 *   resolved from an ancestor. Local/root siblings keep `dependsOn` so
 *   SchemaBuilder can emit `Joi.when(Joi.ref(...))` (correct inside the same
 *   object and inside `array.items`). Ancestor hits cannot use that ref.
 *
 * @param {Record<string, object>} schema - A data_structure object.
 * @param {Record<string, unknown>} data - Current form/submission data for this level.
 * @param {boolean} [isInArray=false] - When true, local (declared-sibling) dependencies are left to Joi.when per row.
 * @param {{ rootData?: object, path?: string[] }} [ctx={}] - Root data and payload path for nested dependency resolution.
 * @returns {Record<string, object>} Processed schema copy.
 */
export const preprocessSchema = (schema, data, isInArray = false, ctx = {}) => {
  if (!schema || typeof schema !== 'object') return schema;

  const rootData = isPlainObject(ctx.rootData)
    ? ctx.rootData
    : isPlainObject(data)
      ? data
      : {};
  const path = Array.isArray(ctx.path) ? ctx.path : [];
  const processed = {};

  for (const [key, fieldSchema] of Object.entries(schema)) {
    if (!fieldSchema || typeof fieldSchema !== 'object') {
      processed[key] = fieldSchema;
      continue;
    }

    const copy = { ...fieldSchema };
    const declaredSibling =
      typeof copy.dependsOn === 'string' &&
      Object.prototype.hasOwnProperty.call(schema, copy.dependsOn);
    const deferLocal = isInArray && declaredSibling;
    const { value: parentValue, scope: resolvedScope } =
      resolveDependencyParentScope(rootData, path, copy.dependsOn, data);
    const scope = deferLocal ? 'local' : resolvedScope;

    if (!deferLocal) {
      const isActive = evaluateDependency(copy, parentValue);
      if (!isActive) {
        for (const k of Object.keys(copy)) {
          if (!STRUCTURAL_KEYS.has(k)) delete copy[k];
        }
      } else if (scope === 'ancestor') {
        delete copy.dependency;
        delete copy.dependsOn;
        delete copy.dependencyValue;
        delete copy.dependencyValueValidation;
      }
    }

    if (copy.data_structure) {
      const childPath = [...toDependencyPathKeys(path), key];
      if (copy.type === 'array') {
        copy.data_structure = preprocessSchema(
          fieldSchema.data_structure,
          {},
          true,
          {
            rootData,
            path: childPath,
          }
        );
      } else {
        const nested = /** @type {Record<string, unknown>} */ (
          data?.[key] ?? {}
        );
        copy.data_structure = preprocessSchema(
          copy.data_structure,
          nested,
          false,
          {
            rootData,
            path: childPath,
          }
        );
      }
    }

    processed[key] = copy;
  }

  return processed;
};
