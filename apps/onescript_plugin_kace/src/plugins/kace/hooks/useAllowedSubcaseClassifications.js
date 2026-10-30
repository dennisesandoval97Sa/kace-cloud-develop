import { useCallback, useEffect, useMemo, useState } from 'react';
import { KaceEngine } from '#plugins/kace/KaceEngine.js';

/**
 * Extracts classification id from a relation item (supports id, clasificacion_id, classification_id).
 * @param {Record<string, unknown>} item
 * @returns {string|null}
 */
function getClassificationIdFromItem(item) {
  if (!item || typeof item !== 'object') return null;
  const raw =
    item.id ?? item.clasificacion_id ?? item.classification_id ?? null;
  if (raw == null) return null;
  if (typeof raw === 'string' && raw.trim() !== '') return raw.trim();
  return null;
}

/**
 * Atomic hook: resolves allowed subcase classification IDs for the current parent case.
 * Reads parent case from store, calls fetchGroupClassification(parentClassificationId),
 * normalizes relations to an array of IDs. Used by Subcases modal (dropdown options) and subcase list (table filter).
 * @returns {{ allowedClassificationIds: (string)[], isLoading: boolean, error: string | null }}
 */
export function useAllowedSubcaseClassifications() {
  const [allowedClassificationIds, setAllowedClassificationIds] = useState([]);
  /** Inicia en true: evita un fetch de subcasos antes de resolver clasificaciones permitidas (cambia a false sin API si no hay parent). */
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const kace = useMemo(() => KaceEngine(), []);
  const storeService = useMemo(
    () => kace?.getService('storeService') ?? null,
    [kace]
  );
  const classificationsService = useMemo(
    () => kace?.getService('classifications') ?? null,
    [kace]
  );

  const parentClassificationId = useMemo(() => {
    if (!storeService) return null;
    try {
      const caseData =
        storeService.get('case.case_data') ??
        storeService.get('cases.case_data') ??
        {};
      const caseObj = caseData?.case ?? caseData;
      const id =
        caseObj?.clasificacion_id ?? caseData?.clasificacion_id ?? null;
      if (id == null) return null;
      return typeof id === 'string' ? id.trim() || null : id;
    } catch (_) {
      return null;
    }
  }, [storeService]);

  const fetchAllowed = useCallback(async () => {
    if (!classificationsService || parentClassificationId == null) {
      setAllowedClassificationIds([]);
      setError(null);
      setIsLoading(false);
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const raw = await classificationsService.fetchGroupClassification({
        parentClassificationId,
      });
      const list = Array.isArray(raw) ? raw : [];
      const ids = list
        .map((item) => getClassificationIdFromItem(item))
        .filter((id) => id != null);
      setAllowedClassificationIds(ids);
    } catch (err) {
      console.error(
        '[useAllowedSubcaseClassifications] error fetching allowed classifications',
        err
      );
      setError(err?.message ?? String(err));
      setAllowedClassificationIds([]);
    } finally {
      setIsLoading(false);
    }
  }, [classificationsService, parentClassificationId]);

  useEffect(() => {
    fetchAllowed();
  }, [fetchAllowed]);

  const stableAllowedIds = useMemo(
    () => allowedClassificationIds,
    [allowedClassificationIds]
  );
  const stableLoading = useMemo(() => isLoading, [isLoading]);
  const stableError = useMemo(() => error, [error]);

  return {
    allowedClassificationIds: stableAllowedIds,
    isLoading: stableLoading,
    error: stableError,
  };
}
