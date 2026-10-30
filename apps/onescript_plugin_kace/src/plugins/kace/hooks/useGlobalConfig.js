import { useCallback, useEffect, useMemo, useState } from 'react';
import { KaceEngine } from '../KaceEngine';
import { GLOBAL_CONFIG_PATHS } from '#plugins/kace/data/constants.js';
import { getValueByPath } from '#plugins/kace/utils/getValueByPath.js';

export { GLOBAL_CONFIG_PATHS };

export function useGlobalConfig(onEvent, path, offEvent) {
  const [data, setData] = useState(null);

  const getConfig = useCallback(() => {
    if (!path || typeof path !== 'string') return undefined;
    try {
      const kaceEngine = KaceEngine();
      const storeService = kaceEngine?.getService?.('storeService');
      if (storeService?.get) {
        const fromStore = storeService.get(path);
        if (fromStore !== undefined) return fromStore;
      }
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('kace_engine_data');
        if (raw) {
          const data = JSON.parse(raw);
          return getValueByPath(data, path);
        }
      }
      return undefined;
    } catch {
      return undefined;
    }
  }, [path]);

  useEffect(() => {
    const initial = getConfig();
    if (initial !== undefined) {
      setData(initial);
    }

    if (typeof onEvent !== 'function') return undefined;

    const onAuth = () => {
      const config = getConfig();
      setData(config);
    };
    onEvent('kaceAuthData', onAuth);
    return () => {
      offEvent?.('kaceAuthData', onAuth);
    };
  }, [getConfig, onEvent, offEvent]);

  return data;
}

export default useGlobalConfig;
