import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SCHEMA_KEY_STATES_HIDE_CODE,
  SCHEMA_KEY_STATES_ON_CHANGE_CODE,
  SCHEMA_KEY_STATES_ON_MOUNT_CODE,
} from '#plugins/kace/shared/kace-events.constants.js';
import { evaluateStatesCustomCode } from './statesHide.helpers.js';

const useStatesVisibility = ({
  root,
  component,
  states,
  selected,
  defaultState,
  handleChange,
  handleState,
}) => {
  const didRunOnMountRef = useRef(false);

  const onMountCode = component?.[SCHEMA_KEY_STATES_ON_MOUNT_CODE];
  const onChangeCode =
    component?.[SCHEMA_KEY_STATES_ON_CHANGE_CODE] ??
    component?.[SCHEMA_KEY_STATES_HIDE_CODE];

  const evaluateVisible = useCallback(
    (runOnMount = false) => {
      return evaluateStatesCustomCode({
        onMountCode,
        onChangeCode,
        runOnMount,
        root,
        states,
        selected,
        defaultState,
        handleChange,
        handleState,
      });
    },
    [
      onMountCode,
      onChangeCode,
      root,
      states,
      selected,
      defaultState,
      handleChange,
      handleState,
    ]
  );

  const [visibleStates, setVisibleStates] = useState(() =>
    evaluateVisible(false)
  );

  useEffect(() => {
    const shouldRunOnMount =
      !didRunOnMountRef.current &&
      onMountCode &&
      typeof onMountCode === 'string' &&
      onMountCode.trim();
    if (shouldRunOnMount) {
      didRunOnMountRef.current = true;
    }
    setVisibleStates(evaluateVisible(shouldRunOnMount));
  }, [evaluateVisible, onMountCode]);

  useEffect(() => {
    if (!root || typeof root.on !== 'function') return;

    const handleRootChange = () => {
      setVisibleStates(evaluateVisible(false));
    };

    root.on('change', handleRootChange);
    handleRootChange();

    return () => {
      if (typeof root.off === 'function') {
        root.off('change', handleRootChange);
      }
    };
  }, [root, evaluateVisible]);

  return useMemo(() => ({ visibleStates }), [visibleStates]);
};

export default useStatesVisibility;
