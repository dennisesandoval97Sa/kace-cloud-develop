import { evaluateKace } from '#plugins/kace/shared/evaluateKace.js';
import { buildStatesCustomCodeContext } from './buildStatesCustomCodeContext.js';

export function normalizeHideArgs(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function createHideHelpers(states, hiddenStateIds, hiddenTransitionIds) {
  const hideById = (value) => {
    for (const id of normalizeHideArgs(value)) {
      hiddenStateIds.add(String(id));
    }
  };

  const hideByName = (value) => {
    for (const rawName of normalizeHideArgs(value)) {
      const normalized = String(rawName).trim().toLowerCase();
      if (!normalized) continue;
      for (const state of states) {
        if (String(state.nombre).trim().toLowerCase() === normalized) {
          hiddenStateIds.add(String(state.state_id));
        }
      }
    }
  };

  const hideByTransitionId = (value) => {
    for (const id of normalizeHideArgs(value)) {
      hiddenTransitionIds.add(String(id));
    }
  };

  return { hideById, hideByName, hideByTransitionId };
}

export function filterVisibleStates(
  states,
  hiddenStateIds,
  hiddenTransitionIds
) {
  return states.filter((state) => {
    const stateId = String(state.state_id);
    const transitionId = String(state.transition_id);
    if (hiddenStateIds.has(stateId)) return false;
    if (hiddenTransitionIds.has(transitionId)) return false;
    return true;
  });
}

function runCustomScript(code, context) {
  if (!code || typeof code !== 'string' || !code.trim()) {
    return true;
  }
  try {
    evaluateKace(code, context);
    return true;
  } catch (error) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('[States] custom code error:', error);
    }
    return false;
  }
}

export function evaluateStatesCustomCode({
  onMountCode,
  onChangeCode,
  runOnMount = false,
  root,
  states,
  selected,
  defaultState,
  handleChange,
  handleState,
}) {
  const hasOnMount =
    runOnMount &&
    onMountCode &&
    typeof onMountCode === 'string' &&
    onMountCode.trim();
  const hasOnChange =
    onChangeCode && typeof onChangeCode === 'string' && onChangeCode.trim();

  if (!hasOnMount && !hasOnChange) {
    return states;
  }

  const hiddenStateIds = new Set();
  const hiddenTransitionIds = new Set();
  const hideHelpers = createHideHelpers(
    states,
    hiddenStateIds,
    hiddenTransitionIds
  );

  const buildContext = () =>
    buildStatesCustomCodeContext({
      root,
      states,
      selected,
      defaultState,
      handleChange,
      handleState,
      hideHelpers,
    });

  if (hasOnMount) {
    const ok = runCustomScript(onMountCode, buildContext());
    if (!ok) return states;
  }

  if (hasOnChange) {
    const ok = runCustomScript(onChangeCode, buildContext());
    if (!ok) return states;
  }

  return filterVisibleStates(states, hiddenStateIds, hiddenTransitionIds);
}

export function evaluateStatesHideCode({
  code,
  states,
  selected,
  defaultState,
  formData,
  root,
  handleChange,
  handleState,
}) {
  return evaluateStatesCustomCode({
    onChangeCode: code,
    root: root ?? { data: formData ?? {} },
    states,
    selected,
    defaultState,
    handleChange,
    handleState,
  });
}
