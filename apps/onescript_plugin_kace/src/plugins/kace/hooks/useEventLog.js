import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KaceEngine } from '#plugins/kace/KaceEngine.js';
import {
  EVENT_LOG_DYNAMIC_ROW_PATH_PATTERN,
  getEventLogSessionStorePath,
} from '#plugins/kace/components/event-log/lib/event-log.constants.js';
import { resolveEventLogContext } from '#plugins/kace/components/event-log/lib/resolveEventLogContext.js';
import {
  formatAttributeValue,
  getAttributeComparison,
  getComparisonForFieldPath,
  getValueAtPath,
  hasPathInObject,
  parsePathSegments,
} from '#plugins/kace/utils/eventLogUtils.js';

const LIMIT = 20;

const ERROR = 'Error al cargar el historial';

/**
 * @param {{ entityId: string, primaryEntity: string, fieldPath: string, contextKey: string }} a
 * @param {{ entityId: string, primaryEntity: string, fieldPath: string, contextKey: string }} b
 * @returns {boolean}
 */
function sessionMetaEquals(a, b) {
  if (!a || !b) return false;
  return (
    a.entityId === b.entityId &&
    a.primaryEntity === b.primaryEntity &&
    a.fieldPath === b.fieldPath &&
    a.contextKey === b.contextKey
  );
}

/**
 * @param {string} safeEntityId
 * @param {string} safePrimaryEntity
 * @param {string} fieldPath
 * @param {string|null|undefined} contextCaseId
 * @returns {{ entityId: string, primaryEntity: string, fieldPath: string, contextKey: string }}
 */
function buildSessionMetaParts(
  safeEntityId,
  safePrimaryEntity,
  fieldPath,
  contextCaseId
) {
  return {
    entityId: safeEntityId,
    primaryEntity: safePrimaryEntity,
    fieldPath: typeof fieldPath === 'string' ? fieldPath : '',
    contextKey:
      contextCaseId == null || contextCaseId === ''
        ? ''
        : String(contextCaseId),
  };
}

/**
 * @typedef {Object} UseEventLogOptions
 * @property {string} [fieldPath] - Dot path to filter comparisons (must exist in both new_attributes and original_attributes).
 * @property {string} [componentPath] - Runtime Form.io path (used to resolve edit grid row indexes).
 * @property {string|null} [contextCaseId] - Override entity ID from parent context (e.g. subcase). When truthy, takes precedence over handshake params.
 * @property {string} [eventLogInstanceId] - Form.io component id; isolates storeService session cache per Event Log instance.
 */

/**
 * @param {UseEventLogOptions} [options]
 */
export function useEventLog(options = {}) {
  const rawFieldPath = options.fieldPath;
  const fieldPath = typeof rawFieldPath === 'string' ? rawFieldPath.trim() : '';
  const rawComponentPath = options.componentPath;
  const componentPath =
    typeof rawComponentPath === 'string' ? rawComponentPath : '';
  const contextCaseId = options.contextCaseId ?? null;
  const eventLogInstanceId =
    typeof options.eventLogInstanceId === 'string'
      ? options.eventLogInstanceId.trim()
      : '';

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [authRevision, setAuthRevision] = useState(0);

  const sessionStorePath = useMemo(
    () => getEventLogSessionStorePath(eventLogInstanceId),
    [eventLogInstanceId]
  );
  const wasSheetOpenRef = useRef(false);
  /** When true, in-flight history requests must not mutate React state or the store (sheet closed or unmounted). */
  const sheetHistoryAbortRef = useRef(false);
  const loadMoreInFlightRef = useRef(false);
  const historyGenerationRef = useRef(0);

  const bumpHistoryGeneration = () => {
    historyGenerationRef.current += 1;
    return historyGenerationRef.current;
  };

  const isCurrentHistoryGeneration = (generation) =>
    historyGenerationRef.current === generation &&
    !sheetHistoryAbortRef.current;

  useEffect(() => {
    if (typeof window !== 'undefined' && window['__KACE_AUTH_READY__']) {
      setAuthRevision((n) => n + 1);
    }
    const onReady = () => setAuthRevision((n) => n + 1);
    window.addEventListener('kaceAuthReady', onReady);
    return () => window.removeEventListener('kaceAuthReady', onReady);
  }, []);

  const eventLogContext = useMemo(
    () => resolveEventLogContext({ contextCaseId }),
    [contextCaseId, authRevision]
  );

  const clearPersistedSession = useCallback(() => {
    try {
      if (!eventLogInstanceId) return;
      const kace = KaceEngine();
      const storeService = kace.getService('storeService');
      if (storeService?.set) {
        storeService.set(sessionStorePath, null);
      }
    } catch (err) {
      console.error('[useEventLog] clearPersistedSession', err);
    }
  }, [eventLogInstanceId, sessionStorePath]);

  const markSheetHistoryAborted = useCallback(() => {
    sheetHistoryAbortRef.current = true;
  }, []);

  useEffect(() => {
    try {
      const closing = wasSheetOpenRef.current && !isSheetOpen;
      wasSheetOpenRef.current = isSheetOpen;
      if (!closing) return;

      markSheetHistoryAborted();
      bumpHistoryGeneration();
      loadMoreInFlightRef.current = false;
      clearPersistedSession();
      setItems([]);
      setHasMore(true);
      setError(null);
      setIsLoading(false);
      setIsLoadingMore(false);
    } catch (err) {
      console.error('[useEventLog] sheet close effect', err);
    }
  }, [isSheetOpen, clearPersistedSession, markSheetHistoryAborted]);

  useEffect(() => {
    return () => {
      try {
        markSheetHistoryAborted();
        bumpHistoryGeneration();
        clearPersistedSession();
      } catch (err) {
        console.error('[useEventLog] unmount cleanup', err);
      }
    };
  }, [clearPersistedSession, markSheetHistoryAborted]);

  const fetchHistory = useCallback(async () => {
    const { entityId: safeEntityId, primaryEntity: safePrimaryEntity } =
      resolveEventLogContext({ contextCaseId });

    if (!safeEntityId || !safePrimaryEntity) return;

    const meta = buildSessionMetaParts(
      safeEntityId,
      safePrimaryEntity,
      fieldPath,
      contextCaseId
    );

    let generation = null;
    try {
      const kace = KaceEngine();
      const storeService = kace.getService('storeService');
      const canUseStore = Boolean(
        eventLogInstanceId && storeService?.get && storeService?.set
      );

      if (canUseStore) {
        const existing = storeService.get(sessionStorePath);
        if (
          existing?.status === 'loading' &&
          sessionMetaEquals(existing.meta, meta)
        ) {
          return;
        }
        if (
          existing?.status === 'ready' &&
          sessionMetaEquals(existing.meta, meta)
        ) {
          const cachedItems = Array.isArray(existing.items)
            ? existing.items
            : [];
          setItems(cachedItems);
          setHasMore(Boolean(existing.hasMore));
          setError(null);
          setIsLoading(false);
          return;
        }
        storeService.set(sessionStorePath, { status: 'loading', meta });
      }

      sheetHistoryAbortRef.current = false;
      generation = bumpHistoryGeneration();
      setIsLoading(true);
      setError(null);
      setHasMore(true);
      const auxService = kace.getService('aux');
      const data = await auxService.fetchAuxHistory({
        primary_entity: safePrimaryEntity,
        entity_id: safeEntityId,
        limit: LIMIT,
        offset: 0,
      });
      if (!isCurrentHistoryGeneration(generation)) {
        return;
      }
      const arr = Array.isArray(data) ? data : [];
      setItems(arr);
      setHasMore(arr.length >= LIMIT);

      if (canUseStore && isCurrentHistoryGeneration(generation)) {
        storeService.set(sessionStorePath, {
          status: 'ready',
          meta,
          items: arr,
          hasMore: arr.length >= LIMIT,
        });
      }
    } catch (err) {
      if (generation != null && historyGenerationRef.current !== generation) {
        return;
      }
      try {
        const kace = KaceEngine();
        const storeService = kace.getService('storeService');
        if (eventLogInstanceId && storeService?.set) {
          storeService.set(sessionStorePath, null);
        }
      } catch (storeErr) {
        console.error('[useEventLog] fetchHistory store reset', storeErr);
      }
      setError(err?.message || ERROR);
      setItems([]);
    } finally {
      if (generation == null || historyGenerationRef.current === generation) {
        setIsLoading(false);
      }
    }
  }, [contextCaseId, fieldPath, eventLogInstanceId, sessionStorePath]);

  const loadMore = useCallback(async () => {
    const { entityId: safeEntityId, primaryEntity: safePrimaryEntity } =
      resolveEventLogContext({ contextCaseId });
    if (
      loadMoreInFlightRef.current ||
      isLoadingMore ||
      !hasMore ||
      !safeEntityId ||
      !safePrimaryEntity
    )
      return;
    loadMoreInFlightRef.current = true;
    const generation = bumpHistoryGeneration();

    const meta = buildSessionMetaParts(
      safeEntityId,
      safePrimaryEntity,
      fieldPath,
      contextCaseId
    );

    setIsLoadingMore(true);
    try {
      const kace = KaceEngine();
      const auxService = kace.getService('aux');
      const offset = items.length;
      const data = await auxService.fetchAuxHistory({
        primary_entity: safePrimaryEntity,
        entity_id: safeEntityId,
        limit: LIMIT,
        offset,
      });
      if (!isCurrentHistoryGeneration(generation)) {
        return;
      }
      const arr = Array.isArray(data) ? data : [];
      const merged = [...items, ...arr];
      setItems(merged);
      setHasMore(arr.length >= LIMIT);

      try {
        const storeService = kace.getService('storeService');
        if (
          eventLogInstanceId &&
          storeService?.get &&
          storeService?.set &&
          isCurrentHistoryGeneration(generation)
        ) {
          const existing = storeService.get(sessionStorePath);
          if (
            existing?.status === 'ready' &&
            sessionMetaEquals(existing.meta, meta)
          ) {
            storeService.set(sessionStorePath, {
              ...existing,
              items: merged,
              hasMore: arr.length >= LIMIT,
            });
          }
        }
      } catch (storeErr) {
        console.error('[useEventLog] loadMore store update', storeErr);
      }
    } catch (err) {
      if (historyGenerationRef.current !== generation) return;
      setError(err?.message || ERROR);
    } finally {
      if (historyGenerationRef.current === generation) {
        loadMoreInFlightRef.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [
    contextCaseId,
    fieldPath,
    eventLogInstanceId,
    sessionStorePath,
    isLoadingMore,
    hasMore,
    items,
  ]);

  const toggleSheet = useCallback(() => {
    setIsSheetOpen((prev) => !prev);
  }, []);

  const getActiveRowIndexFromPath = useCallback(() => {
    try {
      if (!componentPath) return null;
      const matches = [...componentPath.matchAll(/\[(\d+)\]/g)];
      if (matches.length === 0) return null;
      const lastMatch = matches[matches.length - 1];
      const rawIndex = lastMatch?.[1];
      const index = Number.parseInt(rawIndex ?? '', 10);
      return Number.isNaN(index) ? null : index;
    } catch (err) {
      console.error('[useEventLog] getActiveRowIndexFromPath', err);
      return null;
    }
  }, [componentPath]);

  const resolveDynamicFieldPath = useCallback(
    (newAttrs, originalAttrs) => {
      try {
        if (!fieldPath) return '';

        const activeRowIndex = getActiveRowIndexFromPath();
        if (activeRowIndex == null) {
          return fieldPath;
        }

        // Allow explicit template markers in path config.
        if (fieldPath.includes('[]')) {
          return fieldPath.replace('[]', `.${activeRowIndex}`);
        }
        if (fieldPath.includes('[*]')) {
          return fieldPath.replace('[*]', `[${activeRowIndex}]`);
        }
        if (fieldPath.includes('{rowIndex}')) {
          return fieldPath.replace('{rowIndex}', String(activeRowIndex));
        }

        // Smart fallback: if first segment points to an array, inject row index.
        const segments = fieldPath
          .split('.')
          .map((s) => s.trim())
          .filter(Boolean);
        if (segments.length < 2) return fieldPath;
        const rootKey = segments[0];
        const newRoot = newAttrs?.[rootKey];
        const oldRoot = originalAttrs?.[rootKey];
        if (!Array.isArray(newRoot) && !Array.isArray(oldRoot)) {
          return fieldPath;
        }

        const hasExplicitNumericSegment = segments.some((seg) =>
          /^\d+$/.test(seg)
        );
        if (hasExplicitNumericSegment) {
          return fieldPath;
        }

        return [rootKey, String(activeRowIndex), ...segments.slice(1)].join(
          '.'
        );
      } catch (err) {
        console.error('[useEventLog] resolveDynamicFieldPath', err);
        return fieldPath;
      }
    },
    [fieldPath, getActiveRowIndexFromPath]
  );

  const isDynamicFieldPath = useMemo(
    () =>
      fieldPath.length > 0 &&
      EVENT_LOG_DYNAMIC_ROW_PATH_PATTERN.test(fieldPath),
    [fieldPath]
  );

  /**
   * Builds path candidates with/without `data.` prefix.
   * @param {string} path
   * @returns {string[]}
   */
  const buildPathCandidates = useCallback((path) => {
    return Array.from(
      new Set(
        [
          path,
          path.replace(/^data\./, ''),
          `data.${path}`.replace(/^data\.data\./, 'data.'),
        ].filter(Boolean)
      )
    );
  }, []);

  /**
   * Finds the first path candidate that produces a non-missing comparison.
   * @param {Object} newAttrs
   * @param {Object} originalAttrs
   * @param {string} path
   * @returns {{ result: Object, matchedCandidate: string } | null}
   */
  const findFirstComparable = useCallback(
    (newAttrs, originalAttrs, path) => {
      for (const candidate of buildPathCandidates(path)) {
        const candidateResult = getComparisonForFieldPath(
          newAttrs,
          originalAttrs,
          candidate
        );
        if (candidateResult.kind !== 'missing') {
          return { result: candidateResult, matchedCandidate: candidate };
        }
      }
      return null;
    },
    [buildPathCandidates]
  );

  /**
   * Compares a single history item.
   * - No `fieldPath` → full attribute comparison (all changes).
   * - Static `fieldPath` → compare only that specific path.
   * - Dynamic `fieldPath` (`[]`, `[*]`, `{rowIndex}`) → resolve row index, compare that path.
   */
  const getComparisonForItem = useCallback(
    (item) => {
      try {
        const newAttrs = item?.new_attributes;
        const originalAttrs = item?.original_attributes;

        if (!fieldPath) {
          return /** @type {const} */ ({
            kind: 'full',
            rows: getAttributeComparison(newAttrs, originalAttrs),
          });
        }

        const targetPath = isDynamicFieldPath
          ? resolveDynamicFieldPath(newAttrs, originalAttrs)
          : fieldPath;

        const found = findFirstComparable(newAttrs, originalAttrs, targetPath);

        if (!found) {
          return /** @type {const} */ ({
            kind: 'field',
            rows: [],
            missing: true,
          });
        }

        const { result: finalResult, matchedCandidate } = found;

        const isCreationForPath =
          !!matchedCandidate &&
          hasPathInObject(newAttrs ?? {}, matchedCandidate) &&
          !hasPathInObject(originalAttrs ?? {}, matchedCandidate);

        let rows = finalResult.rows;

        if (!isDynamicFieldPath && rows.length > 0) {
          const newVal = getValueAtPath(newAttrs, matchedCandidate);
          const oldVal = getValueAtPath(originalAttrs, matchedCandidate);
          const isArrayOrObject =
            Array.isArray(newVal) ||
            Array.isArray(oldVal) ||
            (newVal != null && typeof newVal === 'object') ||
            (oldVal != null && typeof oldVal === 'object');

          if (isArrayOrObject) {
            const segments = parsePathSegments(matchedCandidate);
            const leafKey = segments[segments.length - 1] ?? matchedCandidate;
            /** @type {Array<{ key: string, oldValue: string, newValue: string, details?: unknown }>} */
            const foldedRows = [
              {
                key: leafKey,
                oldValue: formatAttributeValue(oldVal, leafKey),
                newValue: formatAttributeValue(newVal, leafKey),
                details: finalResult.rows,
              },
            ];
            rows = foldedRows;
          }
        }

        return /** @type {const} */ ({
          kind: 'field',
          rows,
          missing: false,
          isCreationForPath,
        });
      } catch (err) {
        console.error('[useEventLog] getComparisonForItem', err);
        return { kind: 'field', rows: [], missing: true };
      }
    },
    [
      fieldPath,
      isDynamicFieldPath,
      resolveDynamicFieldPath,
      findFirstComparable,
    ]
  );

  const state = useMemo(
    () => ({
      items,
      isLoading,
      isLoadingMore,
      hasMore,
      error,
      isSheetOpen,
      entityId: eventLogContext.entityId,
      primaryEntity: eventLogContext.primaryEntity,
      fieldPath,
      isDynamicFieldPath,
    }),
    [
      items,
      isLoading,
      isLoadingMore,
      hasMore,
      error,
      isSheetOpen,
      eventLogContext.entityId,
      eventLogContext.primaryEntity,
      fieldPath,
      isDynamicFieldPath,
    ]
  );

  const actions = useMemo(
    () => ({
      fetchHistory,
      loadMore,
      toggleSheet,
      getComparisonForItem,
    }),
    [fetchHistory, loadMore, toggleSheet, getComparisonForItem]
  );

  return useMemo(() => ({ state, actions }), [state, actions]);
}

export default useEventLog;
