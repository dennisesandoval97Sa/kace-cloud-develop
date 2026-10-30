import { useEffect, useMemo, useRef, useState } from 'react';
import { evaluateKace } from '#plugins/kace/shared/evaluateKace.js';
import { BULK_ACTIONS_CONTEXT_POLL_MS } from '../lib/bulk-actions-context.constants.js';
import {
  buildBulkActionsEvaluationContext,
  normalizeBulkActionsResolverResult,
} from '../lib/bulkActionsContext.helpers.js';

/**
 * @param {{ bulkActions?: unknown[], bulkActionsContextCode?: string }} component
 */
function getInitialResolvedBulkActions(component) {
  const code = component?.bulkActionsContextCode;
  const hasCode = typeof code === 'string' && code.trim().length > 0;
  if (hasCode) return [];
  return Array.isArray(component?.bulkActions) ? component.bulkActions : [];
}

/**
 * Evalúa `component.bulkActionsContextCode` (opcional) para obtener la lista final
 * de acciones masivas y si deben deshabilitarse por completo (p. ej. según grupo).
 *
 * Contexto disponible en el código (ver documentación en pestaña Acciones del builder):
 * `kaceEngine`, `apiService`, `userService`, `groupService`, `storeService`, `component`,
 * `baseBulkActions`, `getCurrentGroupId`, `getUserDataSync`, `getCurrentGroupSync`,
 * `getCurrentGroupConfigurationIdSync`.
 *
 * Valor de retorno del script: objeto `{ bulkActions?: array, disableBulkActions?: boolean }`,
 * un array (equivalente a `bulkActions`), o vacío para usar solo `baseBulkActions`.
 *
 * @param {{ bulkActions?: unknown[], bulkActionsContextCode?: string }} component
 * @param {object | null | undefined} kaceEngine - Instancia devuelta por KaceEngine()
 * @param {unknown} apiService
 * @returns {{ resolvedBulkActions: unknown[], bulkActionsGloballyDisabled: boolean }}
 */
export function useDataTableBulkActionsResolution(
  component,
  kaceEngine,
  apiService
) {
  const [resolvedBulkActions, setResolvedBulkActions] = useState(() =>
    getInitialResolvedBulkActions(component)
  );
  const [bulkActionsGloballyDisabled, setBulkActionsGloballyDisabled] =
    useState(false);
  const [resolverTick, setResolverTick] = useState(0);
  const componentRef = useRef(component);
  componentRef.current = component;

  const baseBulkActions = useMemo(
    () => (Array.isArray(component?.bulkActions) ? component.bulkActions : []),
    [component?.bulkActions]
  );

  const contextCode = component?.bulkActionsContextCode;
  const hasContextCode =
    typeof contextCode === 'string' && contextCode.trim().length > 0;

  useEffect(() => {
    if (!hasContextCode) return undefined;
    const id = setInterval(() => {
      setResolverTick((n) => n + 1);
    }, BULK_ACTIONS_CONTEXT_POLL_MS);
    return () => clearInterval(id);
  }, [hasContextCode]);

  useEffect(() => {
    let canceled = false;

    const run = async () => {
      try {
        if (!hasContextCode) {
          if (!canceled) {
            setResolvedBulkActions(baseBulkActions);
            setBulkActionsGloballyDisabled(false);
          }
          return;
        }

        const ctx = buildBulkActionsEvaluationContext({
          kaceEngine,
          apiService,
          component: componentRef.current,
        });

        let result = evaluateKace(contextCode.trim(), ctx);
        if (result != null && typeof result.then === 'function') {
          result = await result;
        }
        if (canceled) return;

        const normalized = normalizeBulkActionsResolverResult(
          result,
          baseBulkActions
        );
        setResolvedBulkActions(normalized.bulkActions);
        setBulkActionsGloballyDisabled(normalized.disableBulkActions);
      } catch (err) {
        console.warn(
          '[DataTable] bulkActionsContextCode:',
          err?.message ?? err
        );
        if (!canceled) {
          setResolvedBulkActions(baseBulkActions);
          setBulkActionsGloballyDisabled(false);
        }
      }
    };

    run();
    return () => {
      canceled = true;
    };
  }, [
    baseBulkActions,
    hasContextCode,
    contextCode,
    kaceEngine,
    apiService,
    resolverTick,
  ]);

  return useMemo(
    () => ({
      resolvedBulkActions,
      bulkActionsGloballyDisabled,
    }),
    [resolvedBulkActions, bulkActionsGloballyDisabled]
  );
}
