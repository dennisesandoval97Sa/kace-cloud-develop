import { useCallback, useEffect, useState } from 'react';
import { storeService } from '#plugins/kace/services/storeService.js';
import {
  useGlobalConfig,
  GLOBAL_CONFIG_PATHS,
} from '#plugins/kace/hooks/useGlobalConfig.js';
import '#plugins/kace/shared/styles/kace-floating-controls.css';
import './CaseTabRefreshFloating.css';
import '#plugins/kace/shared/styles/kace-disabled.css';
import { useKaceDisabled } from '#plugins/kace/hooks/useKaceDisabled.hook.js';

export const CaseTabRefreshFloating = ({
  onEvent,
  offEvent,
  disabled = false,
}) => {
  const {
    disabled: isDisabled,
    readOnlyLock,
    className: disabledClassName,
  } = useKaceDisabled(disabled, { readOnlyStoreKey: null });
  const refreshTabCaseEnabled = useGlobalConfig(
    onEvent,
    GLOBAL_CONFIG_PATHS.REFRESH_TAB_CASE,
    offEvent
  );
  const [isCaseUpdate, setIsCaseUpdate] = useState(() =>
    Boolean(storeService.get('cases.case_id'))
  );

  const syncCaseUpdateFlag = useCallback(() => {
    setIsCaseUpdate(Boolean(storeService.get('cases.case_id')));
  }, []);

  useEffect(() => {
    syncCaseUpdateFlag();
    onEvent('kaceAuthData', syncCaseUpdateFlag);
    return () => {
      offEvent?.('kaceAuthData', syncCaseUpdateFlag);
    };
  }, [onEvent, offEvent, syncCaseUpdateFlag]);

  const shouldShow = refreshTabCaseEnabled === true && isCaseUpdate;

  useEffect(() => {
    const el = document.documentElement;
    if (!shouldShow) {
      el.classList.remove('kace-case-tab-refresh-active');
      return undefined;
    }
    el.classList.add('kace-case-tab-refresh-active');
    return () => el.classList.remove('kace-case-tab-refresh-active');
  }, [shouldShow]);

  const reloadPluginFrame = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, []);

  if (!shouldShow) {
    return null;
  }

  return (
    <div className={disabledClassName || undefined}>
      <button
        type="button"
        className="kace-case-tab-refresh-button"
        onClick={reloadPluginFrame}
        disabled={isDisabled}
        title="Actualizar pestaña del caso"
        aria-label="Actualizar pestaña del caso"
      >
        ↻
      </button>
    </div>
  );
};
