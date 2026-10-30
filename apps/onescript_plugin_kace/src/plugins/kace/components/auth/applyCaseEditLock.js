const AUTH_COMPONENT_TYPE = 'auth';

export function applyCaseEditLock(formRoot, { locked = false } = {}) {
  if (!locked) {
    return { appliedCount: 0, skipped: 'not-locked' };
  }
  if (!formRoot) {
    return { appliedCount: 0, skipped: 'no-root' };
  }

  const root = formRoot.globalRoot ?? formRoot;
  if (typeof root.everyComponent !== 'function') {
    return { appliedCount: 0, skipped: 'no-everyComponent' };
  }

  let appliedCount = 0;
  root.everyComponent((comp) => {
    const type = comp?.component?.type ?? comp?.type;
    if (type === AUTH_COMPONENT_TYPE) return;
    try {
      if (typeof comp.setDisabled === 'function') {
        comp.setDisabled(true);
        appliedCount += 1;
      }
    } catch (_) {}
  });

  return { appliedCount };
}
