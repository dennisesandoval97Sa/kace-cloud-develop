import { KaceEngine } from '../KaceEngine.js';
import { deepMerge } from '#plugins/kace/utils/deepMerge.js';

export function resolveStatesEmit(root) {
  const candidates = [root?.globalRoot, root];
  for (const target of candidates) {
    if (target != null && typeof target.emit === 'function') {
      return target.emit.bind(target);
    }
  }
  return undefined;
}

export function buildStatesCustomCodeContext({
  root,
  states,
  selected,
  defaultState,
  handleChange,
  handleState,
  hideHelpers = {},
}) {
  let kaceEngine = null;
  try {
    kaceEngine = KaceEngine();
  } catch (_) {}

  const globalRoot = root?.globalRoot ?? root ?? null;
  const data = root?.data ?? root?.submission?.data ?? {};
  const globalData = globalRoot?.submission?.data ?? globalRoot?.data ?? {};
  const storeService = kaceEngine?.getService?.('storeService') ?? null;
  const apiUrl = storeService?.get?.('config.api_url') ?? null;
  const apiService = kaceEngine?.getService?.('apiService') ?? null;
  const emit = resolveStatesEmit(root);

  const setData = (patch) => {
    if (!root || patch == null || typeof patch !== 'object') return;
    const merged = deepMerge(data, patch);
    if (root.data) root.data = merged;
    if (root.submission?.data) root.submission.data = merged;
    emit?.('change', { data: merged });
  };

  return {
    data,
    row: data,
    globalData,
    kaceEngine,
    apiService,
    url_api: apiUrl,
    setData,
    handleChange,
    handleState,
    emit,
    states,
    selected,
    defaultState,
    ...hideHelpers,
  };
}
