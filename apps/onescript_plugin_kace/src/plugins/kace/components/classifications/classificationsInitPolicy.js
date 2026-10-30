export function createInitSession() {
  return {
    scriptRan: false,
    pendingDefaults: null,
  };
}

export function markScriptRan(session) {
  return {
    ...session,
    scriptRan: true,
  };
}

/**
 * Auth listo para scripts que leen groups / selected_group_id del store.
 * @param {(path: string) => unknown} readStore
 */
export function isClassificationsAuthReady(readStore) {
  if (typeof readStore !== 'function') return false;
  if (readStore('config.kace_auth_ready') === true) return true;
  const userData =
    readStore('user.user_data') ?? readStore('auth.user_data') ?? null;
  return userData != null && typeof userData === 'object';
}

export function shouldEvaluateUserScript(
  session,
  { caseContextResolved, isEditCase, code, authReady }
) {
  if (!session || session.scriptRan) return false;
  if (!caseContextResolved) return false;
  if (isEditCase) return false;
  if (!authReady) return false;
  if (!code || typeof code !== 'string' || !code.trim()) return false;
  return true;
}

function hasClassificationTree(tree) {
  return Array.isArray(tree) && tree.length > 0;
}

export function queueOrResolveDefaults(
  session,
  selection,
  tree,
  validateSelection
) {
  if (!selection || typeof selection !== 'object') {
    return { kind: 'noop', session };
  }
  if (!hasClassificationTree(tree)) {
    return {
      kind: 'queue',
      session: {
        ...session,
        pendingDefaults: { ...selection },
      },
    };
  }
  const validated = validateSelection(tree, selection);
  return {
    kind: 'apply',
    validated,
    session: {
      ...session,
      pendingDefaults: null,
    },
  };
}

export function consumePendingDefaults(session, tree, validateSelection) {
  if (!session?.pendingDefaults) {
    return { kind: 'noop', session };
  }
  if (!hasClassificationTree(tree)) {
    return { kind: 'noop', session };
  }
  const validated = validateSelection(tree, session.pendingDefaults);
  return {
    kind: 'apply',
    validated,
    session: {
      ...session,
      pendingDefaults: null,
    },
  };
}
