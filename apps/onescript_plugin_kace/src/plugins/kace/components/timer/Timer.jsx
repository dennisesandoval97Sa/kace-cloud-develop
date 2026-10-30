import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './component/button';
import { KaceEngine } from '#plugins/kace/KaceEngine.js';
import { postMessageToParent } from '#plugins/kace/shared/postMessageToParent.util.js';
import './Timer.css';
import '#plugins/kace/shared/styles/kace-floating-controls.css';
import '#plugins/kace/shared/styles/kace-disabled.css';
import { useKaceDisabled } from '#plugins/kace/hooks/useKaceDisabled.hook.js';
import { PauseReasonModal } from './component/modal';
import {
  useGlobalConfig,
  GLOBAL_CONFIG_PATHS,
} from '#plugins/kace/hooks/useGlobalConfig.js';

/**
 * @param {{ component: { [x: string]: unknown }, updateValue: Function, onEvent: Function, offEvent?: Function, root: any, disabled?: boolean }} props
 */
export const Timer = ({
  component,
  updateValue,
  onEvent,
  offEvent,
  root,
  disabled = false,
}) => {
  const {
    disabled: isDisabled,
    readOnlyLock,
    className: disabledClassName,
  } = useKaceDisabled(disabled, { readOnlyStoreKey: null });
  const kaceEngine = KaceEngine();
  const showTimeCounter = useGlobalConfig(
    onEvent,
    GLOBAL_CONFIG_PATHS.SHOW_TIME_COUNTER,
    offEvent
  );
  const auxService = kaceEngine.getService('aux');
  const caseService = kaceEngine.getService('cases');
  const storeService = kaceEngine.getService('storeService');
  const [displayMode, setDisplayMode] = useState('drawer');
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timerId, setTimerId] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [pausedElapsedMs, setPausedElapsedMs] = useState(0);
  const intervalRef = useRef(null);
  const intervalStartRef = useRef(null);
  const pauseIntervalRef = useRef(null);
  const pauseStartRef = useRef(null);

  const [isSubmitInProgress, setIsSubmitInProgress] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseReasonList, setPauseReasonList] = useState([]);
  const [pauseReason, setPauseReason] = useState([]);
  const [caseId, setCaseId] = useState(false);
  const [isLocalTimer, setIsLocalTimer] = useState(false);

  const hasId = useMemo(() => !!caseId, [caseId]);

  useEffect(() => {
    const fetchCaseData = async () => {
      try {
        const caseData = await caseService.get('cases.case_data');
        setCaseId(caseData.id);

        const caseTimerRaw =
          typeof window !== 'undefined'
            ? localStorage.getItem('caseTimer')
            : null;
        if (caseTimerRaw) {
          try {
            const caseTimer = JSON.parse(caseTimerRaw);
            const now = Date.now();
            if (
              caseTimer.started &&
              now - caseTimer.started < 30 * 60 * 1000 &&
              caseTimer.caseId === caseData.id
            ) {
              setTimerId(caseTimer.timerId);
              setIsLocalTimer(Boolean(caseTimer.localOnly));
              setIsRunning(!caseTimer.paused);
              setIsPaused(!!caseTimer.paused);
              setElapsedMs(now - caseTimer.started);
              setPauseReason(caseTimer.justification || '');

              if (caseTimer.paused) {
                setPausedElapsedMs(now - caseTimer.paused);
              } else {
                setPausedElapsedMs(0);
              }

              intervalStartRef.current = caseTimer.started;
              if (caseTimer.paused) pauseStartRef.current = caseTimer.paused;

              return;
            } else {
              localStorage.removeItem('caseTimer');
            }
          } catch (e) {
            localStorage.removeItem('caseTimer');
          }
        }
      } catch (err) {
        const fallbackId =
          storeService?.get?.('cases.case_id') ||
          storeService?.get?.('cases.generated_case_id');
        if (fallbackId) {
          setCaseId(fallbackId);
        }
      }
    };

    fetchCaseData();
  }, [caseService, storeService]);

  useEffect(() => {
    if (!caseId) return;
    if (!setTimerId || (!isRunning && !isPaused)) {
      startTimer();
    }
  }, [setTimerId, isRunning, isPaused, caseId]);

  useEffect(() => {
    const fetchReasons = async () => {
      try {
        const res = await auxService.get('aux.aux_motivos');
        setPauseReasonList(res.map((item) => ({ motivo: item })));
      } catch (err) {
        //ignore
      }
    };

    fetchReasons();
  }, [auxService]);

  useEffect(() => {
    const target = root?.globalRoot || root;
    if (!target?.on) return undefined;

    const handler = (inProgress) => {
      setIsSubmitInProgress(Boolean(inProgress));
      if (!inProgress) {
        setIsSaving(false);
      }
    };

    try {
      target.on('submitButtonState', handler);
    } catch (e) {
      // ignore
    }
    return () => {
      try {
        target.off?.('submitButtonState', handler);
        target.removeListener?.('submitButtonState', handler);
      } catch (e) {
        // ignore
      }
    };
  }, [root]);

  const clearElapsedInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    intervalStartRef.current = null;
  }, []);

  const clearPauseInterval = useCallback(() => {
    if (pauseIntervalRef.current) {
      clearInterval(pauseIntervalRef.current);
      pauseIntervalRef.current = null;
    }
    pauseStartRef.current = null;
  }, []);

  const startElapsedInterval = useCallback(() => {
    clearElapsedInterval();
    intervalStartRef.current = Date.now() - elapsedMs;
    intervalRef.current = setInterval(() => {
      if (intervalStartRef.current !== null) {
        setElapsedMs(Date.now() - intervalStartRef.current);
      }
    }, 1000);
  }, [clearElapsedInterval, elapsedMs]);

  const startPauseInterval = useCallback(() => {
    clearPauseInterval();
    pauseStartRef.current = Date.now() - pausedElapsedMs;
    pauseIntervalRef.current = setInterval(() => {
      if (pauseStartRef.current !== null) {
        setPausedElapsedMs(Date.now() - pauseStartRef.current);
      }
    }, 1000);
  }, [clearPauseInterval, pausedElapsedMs]);

  useEffect(() => {
    if (isRunning || isPaused) {
      startElapsedInterval();
    } else {
      clearElapsedInterval();
    }
    if (isPaused) {
      startPauseInterval();
    } else {
      clearPauseInterval();
    }
    return () => {
      clearElapsedInterval();
      clearPauseInterval();
    };
  }, [
    isRunning,
    isPaused,
    startElapsedInterval,
    clearElapsedInterval,
    startPauseInterval,
    clearPauseInterval,
  ]);

  const toggleDisplayMode = useCallback(() => {
    setDisplayMode((prev) => {
      const newMode = prev === 'draggable' ? 'drawer' : 'draggable';
      if (typeof window !== 'undefined') {
        localStorage.setItem('kace-timer-display-mode', newMode);
      }
      if (newMode === 'drawer') {
        setIsDrawerOpen(true);
      }
      return newMode;
    });
  }, []);

  const toggleDrawerOpen = useCallback(() => {
    setIsDrawerOpen((prev) => !prev);
  }, []);

  const [isMinimized, setIsMinimized] = useState(false);
  const toggleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev);
  }, []);

  const [position, setPosition] = useState({ x: 100, y: 300 });
  const draggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((event) => {
    const target = event.currentTarget;
    const rect = target.parentElement.getBoundingClientRect();
    draggingRef.current = true;
    offsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };

    const handleMouseMove = (moveEvent) => {
      if (!draggingRef.current) return;
      const nextX = moveEvent.clientX - offsetRef.current.x;
      const nextY = moveEvent.clientY - offsetRef.current.y;
      setPosition({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      draggingRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const formatMs = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600)
      .toString()
      .padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const formattedTime = formatMs(elapsedMs);
  const formattedPauseTime = formatMs(pausedElapsedMs);

  const startTimer = async () => {
    setIsStarting(true);
    setIsFinished(false);
    const timerResponse = await caseService.startTimerSession();
    const localOnly = Boolean(timerResponse?.data?.localOnly);
    setIsLocalTimer(localOnly);
    setTimerId(timerResponse.data.id);
    setIsRunning(true);
    setIsStarting(false);
    setPausedElapsedMs(0);
    startElapsedInterval();

    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'caseTimer',
        JSON.stringify({
          timerId: timerResponse.data.id,
          started: intervalStartRef.current,
          paused: null,
          caseId,
          localOnly,
        })
      );
    }
  };

  const resumeTimer = async () => {
    if (isLocalTimer) {
      clearPauseInterval();
      setIsPaused(false);
      setIsRunning(true);
      setShowPauseModal(false);
      startElapsedInterval();

      if (typeof window !== 'undefined') {
        const caseTimerRaw = localStorage.getItem('caseTimer');
        if (caseTimerRaw) {
          try {
            const caseTimer = JSON.parse(caseTimerRaw);
            localStorage.setItem(
              'caseTimer',
              JSON.stringify({
                ...caseTimer,
                paused: null,
                justification: '',
              })
            );
          } catch (e) {
            //ignore
          }
        }
      }
      return;
    }

    const resumeResponse = await caseService.updateTimer(
      timerId,
      'VIEW',
      pauseReason
    );
    setTimerId(resumeResponse.data.id);
    clearPauseInterval();
    setIsPaused(false);
    setIsRunning(true);
    setShowPauseModal(false);

    if (typeof window !== 'undefined') {
      const caseTimerRaw =
        typeof window !== 'undefined'
          ? localStorage.getItem('caseTimer')
          : null;
      if (caseTimerRaw) {
        try {
          const caseTimer = JSON.parse(caseTimerRaw);
          localStorage.setItem(
            'caseTimer',
            JSON.stringify({
              ...caseTimer,
              timerId: resumeResponse.data.id,
              paused: null,
              justification: '',
            })
          );
        } catch (e) {
          //ignore
        }
      }
    }
  };

  const stopTimer = () => {
    clearPauseInterval();
    clearElapsedInterval();
    setIsPaused(false);
    setIsRunning(false);
    setTimerId(null);
    setIsFinished(true);
    setIsSaving(false);
    setIsCancelling(false);
    localStorage.setItem('caseTimer', null);
    setTimeout(() => {
      goBack();
    }, 500);
  };

  const goBack = useCallback(() => {
    postMessageToParent({ type: 'ONESCRIPT_GO_BACK' });
  }, []);

  const cancelTimer = async () => {
    setIsCancelling(true);
    if (!isLocalTimer) {
      await caseService.updateTimer(
        timerId,
        'CANCELLED',
        'Formulario Cancelado'
      );
    }
    stopTimer();
  };

  const pauseTimer = async (eventType, justification) => {
    setIsPausing(true);
    if (isLocalTimer) {
      setIsPaused(true);
      setIsRunning(false);
      setIsPausing(false);
      setShowPauseModal(false);
      clearElapsedInterval();
      startPauseInterval();

      if (typeof window !== 'undefined') {
        const caseTimerRaw = localStorage.getItem('caseTimer');
        if (caseTimerRaw) {
          try {
            const caseTimer = JSON.parse(caseTimerRaw);
            localStorage.setItem(
              'caseTimer',
              JSON.stringify({
                ...caseTimer,
                paused: pauseStartRef.current,
                justification,
              })
            );
          } catch (e) {
            //ignore
          }
        }
      }
      return;
    }

    const pauseResponse = await caseService.updateTimer(
      timerId,
      eventType,
      justification
    );
    setTimerId(pauseResponse.data.id);
    setIsPaused(true);
    setIsRunning(false);
    setIsPausing(false);
    setShowPauseModal(false);
    clearElapsedInterval();
    startPauseInterval();

    if (typeof window !== 'undefined') {
      const caseTimerRaw =
        typeof window !== 'undefined'
          ? localStorage.getItem('caseTimer')
          : null;
      if (caseTimerRaw) {
        try {
          const caseTimer = JSON.parse(caseTimerRaw);
          localStorage.setItem(
            'caseTimer',
            JSON.stringify({
              ...caseTimer,
              timerId: pauseResponse.data.id,
              paused: pauseStartRef.current,
              justification,
            })
          );
        } catch (e) {
          //ignore
        }
      }
    }
  };

  const handlePauseReasonChange = (event) => {
    setPauseReason(event.target.value);
  };

  if (!hasId) return null;
  if (showTimeCounter !== true) return null;

  return (
    <div className={disabledClassName}>
      {displayMode === 'drawer' && !isDrawerOpen && (
        <button
          type="button"
          className="kace-timer-toggle-button"
          onClick={toggleDrawerOpen}
          title="Abrir Timer"
          aria-label="Timer"
          disabled={isDisabled}
        >
          <span className="kace-timer-toggle-text">Timer</span>
        </button>
      )}

      {(displayMode === 'draggable' || isDrawerOpen) && (
        <div
          className={`kace-timer-overlay ${isMinimized ? 'kace-timer-overlay--minimized' : ''} ${displayMode === 'drawer' ? 'kace-timer-overlay--drawer' : ''}`}
          style={
            displayMode === 'draggable'
              ? {
                  left: `${position.x}px`,
                  top: `${position.y}px`,
                }
              : {}
          }
        >
          <div
            className="kace-timer-header"
            onMouseDown={
              displayMode === 'draggable' ? handleMouseDown : undefined
            }
            style={{ cursor: displayMode === 'draggable' ? 'move' : 'default' }}
          >
            <span className="kace-timer-title">{'Timer'}</span>
            <div className="kace-timer-header-actions">
              <Button
                className="kace-timer-icon-button"
                onClick={toggleDisplayMode}
                isDisabled={isDisabled}
                title={
                  displayMode === 'draggable'
                    ? 'Cambiar a modo drawer'
                    : 'Cambiar a modo arrastrable'
                }
              >
                {displayMode === 'draggable' ? '⇄' : '↔'}
              </Button>
              {displayMode === 'draggable' && (
                <Button
                  className="kace-timer-icon-button"
                  onClick={toggleMinimize}
                  isDisabled={isDisabled}
                >
                  {isMinimized ? '□' : '−'}
                </Button>
              )}
              {displayMode === 'drawer' && (
                <Button
                  className="kace-timer-icon-button"
                  onClick={toggleDrawerOpen}
                  title="Cerrar"
                  isDisabled={isDisabled}
                >
                  →
                </Button>
              )}
              <Button
                className="kace-timer-icon-button kace-timer-icon-button--danger"
                onClick={() => cancelTimer()}
                isDisabled={
                  isDisabled ||
                  isSubmitInProgress ||
                  !isRunning ||
                  isPaused ||
                  isSaving ||
                  isCancelling
                }
              >
                ×
              </Button>
            </div>
          </div>

          {!isMinimized && (
            <div className="kace-timer-body">
              <div className="kace-timer-time">
                {isPaused ? (
                  <>
                    <div className="kace-timer-pause-label">
                      Tiempo de pausa
                    </div>
                    <div>{formattedPauseTime}</div>
                  </>
                ) : (
                  formattedTime
                )}
              </div>
              <div className="kace-timer-actions">
                {!isRunning && !elapsedMs && (
                  <Button
                    className="btn btn-primary btn-sm kace-timer-action-btn kace-timer-action-btn--start"
                    onClick={startTimer}
                    isDisabled={isDisabled || isStarting}
                    title={isStarting ? 'Iniciando' : 'Iniciar'}
                    aria-label={
                      isStarting
                        ? 'Iniciando temporizador'
                        : 'Iniciar temporizador'
                    }
                  >
                    {isStarting ? 'Iniciando...' : 'Iniciar'}
                  </Button>
                )}

                {isFinished && <span className="text-danger">Finalizado</span>}

                {!isFinished && elapsedMs > 0 && (
                  <>
                    <Button
                      className={`btn btn-secondary btn-sm kace-timer-action-btn ${isPaused ? 'kace-timer-action-btn--resume' : 'kace-timer-action-btn--pause'}`}
                      onClick={
                        isPaused ? resumeTimer : () => setShowPauseModal(true)
                      }
                      isDisabled={
                        isDisabled ||
                        isSubmitInProgress ||
                        isSaving ||
                        isCancelling
                      }
                      title={isPaused ? 'Reanudar' : 'Pausar'}
                      aria-label={
                        isPaused
                          ? 'Reanudar temporizador'
                          : 'Pausar temporizador'
                      }
                    >
                      {isPaused ? 'Reanudar' : 'Pausar'}
                    </Button>

                    <Button
                      className="btn btn-outline-danger btn-sm kace-timer-action-btn kace-timer-action-btn--cancel-form"
                      onClick={() => cancelTimer()}
                      isDisabled={
                        isDisabled ||
                        isSubmitInProgress ||
                        !isRunning ||
                        isPaused ||
                        isSaving ||
                        isCancelling
                      }
                      title={
                        isCancelling ? 'Cancelando' : 'Cancelar formulario'
                      }
                      aria-label={
                        isCancelling
                          ? 'Cancelando temporizador'
                          : 'Cancelar formulario y temporizador'
                      }
                    >
                      {isCancelling ? 'Cancelando...' : 'Cancelar'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {showPauseModal && (
        <PauseReasonModal
          onResume={() => setShowPauseModal(false)}
          onPauseReasonChange={handlePauseReasonChange}
          formattedTime={formattedTime}
          formattedPauseTime={formattedPauseTime}
          pauseReasonList={pauseReasonList}
          isSaving={isPausing}
          isLoading={isPausing}
          handleConfirmPause={pauseTimer}
          error={null}
          pauseReason={pauseReason}
          disabled={isDisabled}
        />
      )}
    </div>
  );
};
