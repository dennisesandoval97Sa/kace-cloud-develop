import { findSchemaForKey } from '#plugins/kace/shared/FindSchemaForKey.js';
import {
  DS_KEY_UI,
  DS_UI_KEY_IS_VISIBLE,
  DS_UI_KEY_MODIFIED,
  DS_UI_KEY_READ_ONLY,
} from '#plugins/kace/shared/kace-events.constants.js';

function normalizeKey(keyOrPath) {
  if (keyOrPath == null) return '';
  const key = String(keyOrPath).trim();
  return key;
}

function findComponentByKey(root, keyOrPath) {
  const key = normalizeKey(keyOrPath);
  if (!root || !key) return null;

  try {
    if (typeof root.getComponent === 'function') {
      const direct = root.getComponent(key);
      if (direct) return direct;
      if (key.includes('.')) {
        const leaf = key.split('.').pop();
        if (leaf) {
          const byLeaf = root.getComponent(leaf);
          if (byLeaf) return byLeaf;
        }
      }
    }
  } catch (_) {}

  let found = null;
  try {
    if (typeof root.everyComponent === 'function') {
      root.everyComponent((comp) => {
        if (found) return;
        const compKey = comp?.component?.key ?? comp?.key;
        if (compKey != null && String(compKey) === key) {
          found = comp;
        }
      });
    }
  } catch (_) {}

  return found;
}

function triggerComponentRedraw(comp, keyOrPath) {
  if (!comp) return false;

  let ok = false;

  try {
    if (typeof comp.renderReactComponent === 'function') {
      comp.renderReactComponent();
      ok = true;
    }
  } catch (_) {}

  try {
    if (typeof comp.redraw === 'function') {
      comp.redraw();
      ok = true;
    }
  } catch (_) {}

  try {
    if (typeof comp.emit === 'function') {
      comp.emit('redraw', { key: normalizeKey(keyOrPath) });
      ok = true;
    }
  } catch (_) {}

  return ok;
}

function resolveValidationRule(dataStructure, key) {
  if (!dataStructure || !key) return null;
  return (
    findSchemaForKey({ data_structure: dataStructure }, key) ??
    findSchemaForKey(dataStructure, key) ??
    (Object.prototype.hasOwnProperty.call(dataStructure, key)
      ? dataStructure[key]
      : null)
  );
}

function mutateValidationRule(dataStructure, key, patch, storeService) {
  const rule = resolveValidationRule(dataStructure, key);
  if (
    !rule ||
    typeof rule !== 'object' ||
    !patch ||
    typeof patch !== 'object'
  ) {
    return false;
  }
  Object.assign(rule, patch);
  if (storeService?.set) {
    try {
      const stored = storeService.get?.('oneScript.validation_schema');
      if (stored && typeof stored === 'object' && stored.data_structure) {
        const storedRule = resolveValidationRule(stored.data_structure, key);
        if (storedRule && typeof storedRule === 'object') {
          Object.assign(storedRule, patch);
        }
      }
    } catch (_) {}
  }
  return true;
}

function applyFieldRequired(comp, required) {
  if (!comp?.component) return false;
  const isRequired = Boolean(required);
  comp.component.validate = {
    ...(comp.component.validate || {}),
    required: isRequired,
  };
  if (
    comp.component.kaceValidation &&
    typeof comp.component.kaceValidation === 'object'
  ) {
    comp.component.kaceValidation = {
      ...comp.component.kaceValidation,
      required: isRequired,
    };
  }
  if (!isRequired) {
    try {
      if (typeof comp.setCustomValidity === 'function') {
        comp.setCustomValidity('');
      }
      if (comp.error) comp.error = null;
    } catch (_) {}
  }
  return triggerComponentRedraw(comp, comp.component?.key);
}

function applyFieldHidden(comp, hidden) {
  if (!comp?.component) return false;
  const isHidden = Boolean(hidden);
  comp.component.hidden = isHidden;

  if (isHidden) {
    if (comp.component._kaceSavedCustomConditional === undefined) {
      comp.component._kaceSavedCustomConditional =
        comp.component.customConditional;
    }
    comp.component.customConditional = 'show = false;';
  } else if (comp.component._kaceSavedCustomConditional !== undefined) {
    comp.component.customConditional =
      comp.component._kaceSavedCustomConditional;
    delete comp.component._kaceSavedCustomConditional;
  }

  try {
    if (typeof comp.setVisible === 'function') {
      comp.setVisible(!isHidden);
    }
  } catch (_) {}

  if (!isHidden) {
    try {
      if (typeof comp.checkConditions === 'function') {
        comp.checkConditions();
      }
    } catch (_) {}
  }

  if (isHidden) {
    try {
      if (typeof comp.setCustomValidity === 'function') {
        comp.setCustomValidity('');
      }
      if (comp.error) comp.error = null;
    } catch (_) {}
  }

  return triggerComponentRedraw(comp, comp.component?.key);
}

function applyFieldDisabled(comp, disabled) {
  if (!comp?.component) return false;
  const isDisabled = Boolean(disabled);
  comp.component.disabled = isDisabled;

  try {
    if ('disabled' in comp) {
      comp.disabled = isDisabled;
    }
  } catch (_) {}

  try {
    if (typeof comp.setDisabled === 'function') {
      comp.setDisabled(isDisabled);
    }
  } catch (_) {}

  return triggerComponentRedraw(comp, comp.component?.key);
}

export function createFormComponentRedrawFns(formRoot, options = {}) {
  const searchNestedFormOnly = options?.searchNestedFormOnly === true;
  const validationSchemaRef = options?.validationSchemaRef ?? null;
  const storeService = options?.storeService ?? null;

  const resolvedRoot = searchNestedFormOnly
    ? (formRoot ?? null)
    : (formRoot?.globalRoot ?? formRoot ?? null);

  const getComponent = (keyOrPath) =>
    findComponentByKey(resolvedRoot, keyOrPath);

  const redrawComponent = (keyOrPath) => {
    const key = normalizeKey(keyOrPath);
    if (!key) return false;
    const comp = findComponentByKey(resolvedRoot, key);
    if (!comp) return false;
    return triggerComponentRedraw(comp, key);
  };

  const redrawComponents = (keys) => {
    const list = Array.isArray(keys) ? keys : [keys];
    return list.map((key) => redrawComponent(key));
  };

  const redrawAll = () => {
    const targets = [];
    if (formRoot) targets.push(formRoot);
    if (resolvedRoot && resolvedRoot !== formRoot) targets.push(resolvedRoot);
    if (!targets.length) return false;

    let ok = false;
    for (const target of targets) {
      try {
        if (typeof target.emit === 'function') {
          target.emit('redraw');
          ok = true;
        }
      } catch (_) {}
    }
    return ok;
  };

  const setFieldRequired = (keyOrPath, required) => {
    const key = normalizeKey(keyOrPath);
    if (!key) return false;
    const comp = findComponentByKey(resolvedRoot, key);
    let ok = comp ? applyFieldRequired(comp, required) : false;
    const dataStructure = validationSchemaRef?.current;
    if (dataStructure) {
      ok =
        mutateValidationRule(
          dataStructure,
          key,
          { required: Boolean(required) },
          storeService
        ) || ok;
    }
    return ok;
  };

  const setFieldHidden = (keyOrPath, hidden) => {
    const key = normalizeKey(keyOrPath);
    if (!key) return false;
    const comp = findComponentByKey(resolvedRoot, key);
    const isHidden = Boolean(hidden);
    let ok = comp ? applyFieldHidden(comp, isHidden) : false;
    const dataStructure = validationSchemaRef?.current;
    if (dataStructure) {
      const rule = resolveValidationRule(dataStructure, key);
      if (rule && typeof rule === 'object') {
        const ui = { ...(rule[DS_KEY_UI] || {}) };
        ui[DS_UI_KEY_IS_VISIBLE] = !isHidden;
        ui[DS_UI_KEY_MODIFIED] = true;
        ok =
          mutateValidationRule(
            dataStructure,
            key,
            { [DS_KEY_UI]: ui },
            storeService
          ) || ok;
      }
    }
    return ok;
  };

  const setFieldDisabled = (keyOrPath, disabled) => {
    const key = normalizeKey(keyOrPath);
    if (!key) return false;
    const comp = findComponentByKey(resolvedRoot, key);
    const isDisabled = Boolean(disabled);
    let ok = comp ? applyFieldDisabled(comp, isDisabled) : false;
    const dataStructure = validationSchemaRef?.current;
    if (dataStructure) {
      const rule = resolveValidationRule(dataStructure, key);
      if (rule && typeof rule === 'object') {
        const ui = { ...(rule[DS_KEY_UI] || {}) };
        ui[DS_UI_KEY_READ_ONLY] = isDisabled;
        ui[DS_UI_KEY_MODIFIED] = true;
        ok =
          mutateValidationRule(
            dataStructure,
            key,
            { [DS_KEY_UI]: ui },
            storeService
          ) || ok;
      }
    }
    return ok;
  };

  const setFieldProperties = (keyOrPath, properties = {}) => {
    if (!properties || typeof properties !== 'object') return false;
    let ok = false;
    if (typeof properties.required !== 'undefined') {
      ok = setFieldRequired(keyOrPath, properties.required) || ok;
    }
    if (typeof properties.hidden !== 'undefined') {
      ok = setFieldHidden(keyOrPath, properties.hidden) || ok;
    }
    if (typeof properties.disabled !== 'undefined') {
      ok = setFieldDisabled(keyOrPath, properties.disabled) || ok;
    }
    return ok;
  };

  return {
    form: formRoot ?? null,
    root: resolvedRoot,
    getComponent,
    redrawComponent,
    redrawComponents,
    redrawAll,
    setFieldRequired,
    setFieldHidden,
    setFieldDisabled,
    setFieldProperties,
  };
}
