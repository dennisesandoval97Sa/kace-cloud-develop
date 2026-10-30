import { useCallback, useRef } from 'react';
import { makeLoadCacheKey } from '#plugins/kace/utils/kaceScriptSelectLoadKey.js';
import { mergeScriptSelectOptions } from '#plugins/kace/utils/mergeScriptSelectOptions.js';

export function useKaceScriptSelectLoad({
  componentKey,
  refetchOnEveryOpen,
  segmented,
  dependencySignature,
  getContext,
  mergeOptionsForDisplay,
  applyOptions,
  onInfiniteStall,
}) {
  const cacheRef = useRef(new Map());
  const accRef = useRef({ term: '', items: [] });

  const invalidateCache = useCallback(() => {
    cacheRef.current.clear();
    accRef.current = { term: '', items: [] };
  }, []);

  const load = useCallback(
    async (executor) => {
      const ctx = getContext();
      const key = makeLoadCacheKey({
        componentKey,
        page: ctx.page,
        remoteTerm: ctx.remoteTerm,
        dependencySignature,
      });
      if (segmented && !refetchOnEveryOpen && cacheRef.current.has(key)) {
        const cached = cacheRef.current.get(key);
        const snapshot = Array.isArray(cached) ? [...cached] : [];
        accRef.current = {
          term: String(ctx.remoteTerm ?? ''),
          items: snapshot,
        };
        applyOptions(mergeOptionsForDisplay(snapshot));
        return;
      }
      const sessionTerm = String(ctx.remoteTerm ?? '');
      let buffer;
      if (ctx.page === 1) {
        buffer = [];
        accRef.current = { term: sessionTerm, items: [] };
      } else {
        if (accRef.current.term !== sessionTerm) {
          accRef.current = { term: sessionTerm, items: [] };
        }
        buffer = Array.isArray(accRef.current.items)
          ? [...accRef.current.items]
          : [];
      }
      const setOptions = (items, opts) => {
        let append = opts?.append === true;
        if (segmented && ctx.page > 1 && opts?.replace !== true) {
          append = true;
        }
        buffer = mergeScriptSelectOptions(buffer, items, append);
        accRef.current.items = [...buffer];
        applyOptions(mergeOptionsForDisplay([...buffer]));
      };
      const seededLength = buffer.length;
      await executor({
        setOptions,
        kaceSelectPage: ctx.page,
        kaceRemoteSearchTerm: ctx.remoteTerm,
      });
      if (
        segmented &&
        ctx.page > 1 &&
        typeof onInfiniteStall === 'function' &&
        buffer.length <= seededLength
      ) {
        onInfiniteStall();
      }
      if (segmented && !refetchOnEveryOpen) {
        cacheRef.current.set(key, [...buffer]);
      }
    },
    [
      componentKey,
      refetchOnEveryOpen,
      segmented,
      dependencySignature,
      getContext,
      mergeOptionsForDisplay,
      applyOptions,
      onInfiniteStall,
    ]
  );

  return { load, invalidateCache };
}
