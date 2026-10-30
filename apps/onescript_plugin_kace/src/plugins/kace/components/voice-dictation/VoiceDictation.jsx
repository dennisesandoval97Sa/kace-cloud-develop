import { Mic, MicOff } from 'lucide-react';
import './VoiceDictation.css';
import '#plugins/kace/shared/styles/kace-disabled.css';
import { useKaceDisabled } from '#plugins/kace/hooks/useKaceDisabled.hook.js';

import { KACE_VOICE_TRANSCRIPTION_FINALIZED_EXTERNALLY } from '../edit-grid/index.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import SpeechRecognition from 'react-speech-recognition';

/**
 * @typedef Props
 * @prop {{ [x: string]: unknown }} component - `this.component` properties
 * @prop {(value: any, flags: any, source: any) => any} updateValue - Function to update `this.value` (formio component instance) value
 * @prop {any} [value] - Current value from FormIO
 * @prop {boolean} [disabled=false] - Disables interactions when Form.io sets disable
 * @prop {(inicio: string) => void} [onTranscriptionStart] - Solo dentro de Kace EditGrid: inicio ISO al activar el micrófono
 * @prop {(fin: string, caracteres: number) => void} [onTranscriptionEnd] - Solo dentro de Kace EditGrid: fin ISO y longitud total del campo
 * @prop {string} [formioComponentId] - Id del componente Form.io (detener mic al guardar/cancelar fila desde EditGrid)
 */

/**
 * @param {Props} props
 */
export const VoiceDictation = ({
  component,
  updateValue,
  value,
  disabled = false,
  onTranscriptionStart,
  onTranscriptionEnd,
  formioComponentId,
}) => {
  const {
    disabled: isDisabled,
    readOnlyLock,
    className: disabledClassName,
  } = useKaceDisabled(disabled);
  const c = /** @type {any} */ (component);

  const defaultManager = {
    subscribe: () => {},
    unsubscribe: () => {},
    startListening: (opts) =>
      SpeechRecognition.startListening
        ? SpeechRecognition.startListening(opts)
        : Promise.resolve(),
    stopListening: () =>
      SpeechRecognition.stopListening
        ? SpeechRecognition.stopListening()
        : Promise.resolve(),
    resetTranscript: () =>
      SpeechRecognition.resetTranscript
        ? SpeechRecognition.resetTranscript()
        : undefined,
    listening: false,
    isMicrophoneAvailable: true,
  };

  const managerRef = useRef(
    SpeechRecognition &&
      typeof SpeechRecognition.getRecognitionManager === 'function'
      ? SpeechRecognition.getRecognitionManager()
      : defaultManager
  );
  const [transcript, setTranscript] = useState('');
  const accumulatedRef = useRef('');
  const instanceRef = useRef({
    id: Math.random().toString(36).slice(2),
    started: false,
    requesting: false,
  });
  const isTranscribingRef = useRef(false);
  const charCountRef = useRef(0);
  const onTranscriptionStartRef = useRef(onTranscriptionStart);
  const onTranscriptionEndRef = useRef(onTranscriptionEnd);
  const [listening, setListening] = useState(
    () => managerRef.current.listening
  );
  const [
    browserSupportsSpeechRecognition,
    setBrowserSupportsSpeechRecognition,
  ] = useState(() => SpeechRecognition.browserSupportsSpeechRecognition());
  const [isMicrophoneAvailable, setMicrophoneAvailable] = useState(
    () => managerRef.current.isMicrophoneAvailable
  );

  const resetTranscript = () => {
    try {
      managerRef.current.resetTranscript();
      accumulatedRef.current = '';
      setTranscript('');
    } catch (e) {}
  };

  const normalizeValue = (v) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    return '';
  };

  const [text, setText] = useState(() => normalizeValue(value));
  const baseTextRef = useRef(normalizeValue(value));

  const maxLength = useMemo(() => {
    const raw = c?.kaceValidation?.max ?? c?.maxLength ?? c?.custom?.maxLength;
    if (raw == null || raw === '') return null;
    const n = typeof raw === 'number' ? raw : parseInt(raw, 10);
    return typeof n === 'number' && !Number.isNaN(n) && n > 0 ? n : null;
  }, [c?.kaceValidation?.max, c?.maxLength, c?.custom?.maxLength]);
  const maxLengthRef = useRef(maxLength);
  maxLengthRef.current = maxLength;

  useEffect(() => {
    onTranscriptionStartRef.current = onTranscriptionStart;
    onTranscriptionEndRef.current = onTranscriptionEnd;
  }, [onTranscriptionStart, onTranscriptionEnd]);

  useEffect(() => {
    charCountRef.current = String(text ?? '').length;
  }, [text]);

  useEffect(() => {
    const next = normalizeValue(value);
    setText(next);
    baseTextRef.current = next;
  }, [value]);

  useEffect(() => {
    const base =
      baseTextRef.current?.trimEnd?.() ??
      String(baseTextRef.current ?? '').trimEnd();
    let combined = transcript
      ? base
        ? `${base} ${transcript}`
        : transcript
      : base;
    const limit = maxLengthRef.current;
    if (limit != null && combined.length > limit) {
      combined = combined.slice(0, limit);
    }
    setText(combined);
    updateValue(combined);
  }, [transcript, updateValue]);

  useEffect(() => {
    const manager = managerRef.current;
    const id = Math.random().toString(36).slice(2);
    instanceRef.current.id = id;
    const callbacks = {
      onMicrophoneAvailabilityChange: (val) => setMicrophoneAvailable(!!val),
      onListeningChange: (val) => {
        if (val && instanceRef.current.requesting) {
          instanceRef.current.started = true;
          instanceRef.current.requesting = false;
          setListening(true);
          return;
        }
        if (!val && instanceRef.current.started) {
          instanceRef.current.started = false;
          setListening(false);
        }
      },
      onTranscriptChange: (interim, final) => {
        if (!instanceRef.current.started && !instanceRef.current.requesting)
          return;
        try {
          const finalTrim = final ? String(final).trim() : '';
          const interimTrim = interim ? String(interim).trim() : '';
          if (finalTrim) {
            accumulatedRef.current = accumulatedRef.current
              ? `${accumulatedRef.current} ${finalTrim}`
              : finalTrim;
          }
          const combined = accumulatedRef.current
            ? interimTrim
              ? `${accumulatedRef.current} ${interimTrim}`
              : accumulatedRef.current
            : interimTrim;
          setTranscript(combined || '');
        } catch (e) {
          setTranscript('');
        }
      },
      onClearTranscript: () => {},
      onBrowserSupportsSpeechRecognitionChange: (val) =>
        setBrowserSupportsSpeechRecognition(!!val),
      onBrowserSupportsContinuousListeningChange: () => {},
    };

    try {
      manager.subscribe(id, callbacks);
    } catch (e) {
      //ignore
    }

    const onActiveChanged = (ev) => {
      const activeId = ev && ev.detail ? ev.detail.id : null;
      const myId = instanceRef.current.id;
      if (activeId !== myId) {
        if (instanceRef.current.started || instanceRef.current.requesting) {
          try {
            const onEnd = onTranscriptionEndRef.current;
            if (onEnd && isTranscribingRef.current) {
              onEnd(new Date().toISOString(), charCountRef.current);
              isTranscribingRef.current = false;
            }
          } catch (endErr) {
            if (typeof console !== 'undefined' && console.warn) {
              console.warn(
                '[Kace] VoiceDictation onActiveChanged onTranscriptionEnd',
                endErr
              );
            }
          }
          instanceRef.current.requesting = false;
          instanceRef.current.started = false;
          setListening(false);
          try {
            manager.stopListening && manager.stopListening();
          } catch (e) {
            try {
              SpeechRecognition.stopListening &&
                SpeechRecognition.stopListening();
            } catch (err) {}
          }
        }
      }
    };

    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener(
        'voice-dictation-active-changed',
        onActiveChanged
      );
    }

    return () => {
      try {
        manager.unsubscribe(id);
      } catch (e) {}
      if (typeof window !== 'undefined' && window.removeEventListener) {
        window.removeEventListener(
          'voice-dictation-active-changed',
          onActiveChanged
        );
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      try {
        const onEnd = onTranscriptionEndRef.current;
        if (onEnd && isTranscribingRef.current) {
          onEnd(new Date().toISOString(), charCountRef.current);
          isTranscribingRef.current = false;
        }
      } catch (unmountErr) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(
            '[Kace] VoiceDictation unmount onTranscriptionEnd',
            unmountErr
          );
        }
      }
    };
  }, []);

  /**
   * EditGrid ya persistió métricas: solo detiene el reconocedor y limpia estado UI.
   */
  useEffect(() => {
    if (!formioComponentId) return undefined;

    /**
     * @param {Event} ev
     */
    const onExternalFinalize = (ev) => {
      try {
        const detail =
          ev &&
          /** @type {CustomEvent<{ componentIds?: string[] }>} */ (ev).detail;
        const ids = Array.isArray(detail?.componentIds)
          ? detail.componentIds
          : [];
        if (!ids.includes(formioComponentId)) return;

        isTranscribingRef.current = false;
        instanceRef.current.requesting = false;
        instanceRef.current.started = false;
        setListening(false);
        try {
          if (typeof window !== 'undefined') {
            window.__voiceDictationActiveInstance = null;
            window.dispatchEvent(
              new CustomEvent('voice-dictation-active-changed', {
                detail: { id: null },
              })
            );
          }
        } catch (wErr) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn(
              '[Kace] VoiceDictation external finalize window',
              wErr
            );
          }
        }
        try {
          managerRef.current.stopListening();
        } catch (stopErr) {
          try {
            SpeechRecognition.stopListening &&
              SpeechRecognition.stopListening();
          } catch (innerStop) {
            if (typeof console !== 'undefined' && console.warn) {
              console.warn(
                '[Kace] VoiceDictation external finalize stopListening',
                innerStop
              );
            }
          }
        }
      } catch (extErr) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[Kace] VoiceDictation onExternalFinalize', extErr);
        }
      }
    };

    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener(
        KACE_VOICE_TRANSCRIPTION_FINALIZED_EXTERNALLY,
        onExternalFinalize
      );
    }
    return () => {
      if (typeof window !== 'undefined' && window.removeEventListener) {
        window.removeEventListener(
          KACE_VOICE_TRANSCRIPTION_FINALIZED_EXTERNALLY,
          onExternalFinalize
        );
      }
    };
  }, [formioComponentId]);

  const rollbackTranscriptionRegistration = () => {
    try {
      const onEnd = onTranscriptionEndRef.current;
      if (onEnd && isTranscribingRef.current) {
        onEnd(new Date().toISOString(), charCountRef.current);
        isTranscribingRef.current = false;
      }
    } catch (rollbackErr) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          '[Kace] VoiceDictation rollbackTranscriptionRegistration',
          rollbackErr
        );
      }
    }
  };

  const handleStart = async () => {
    try {
      const onStart = onTranscriptionStartRef.current;
      const onEnd = onTranscriptionEndRef.current;
      if (onStart && isTranscribingRef.current && onEnd) {
        try {
          onEnd(new Date().toISOString(), charCountRef.current);
        } catch (prevErr) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn(
              '[Kace] VoiceDictation handleStart finalize previous',
              prevErr
            );
          }
        }
        isTranscribingRef.current = false;
      }
    } catch (guardErr) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[Kace] VoiceDictation handleStart guard', guardErr);
      }
    }

    baseTextRef.current = String(text ?? '');
    resetTranscript();
    try {
      const onStart = onTranscriptionStartRef.current;
      if (onStart) {
        onStart(new Date().toISOString());
        isTranscribingRef.current = true;
      }
      try {
        if (typeof window !== 'undefined') {
          const myId = instanceRef.current.id;
          window.__voiceDictationActiveInstance = myId;
          window.dispatchEvent(
            new CustomEvent('voice-dictation-active-changed', {
              detail: { id: myId },
            })
          );
        }
      } catch (e) {}
      if (
        managerRef.current &&
        managerRef.current.listening &&
        typeof managerRef.current.stopListening === 'function'
      ) {
        try {
          await managerRef.current.stopListening();
        } catch (e) {}
      }

      instanceRef.current.requesting = true;
      const maybePromise = managerRef.current.startListening({
        continuous: true,
        language: 'es-CO',
      });
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.catch(() => {
          instanceRef.current.requesting = false;
          rollbackTranscriptionRegistration();
        });
      }
    } catch (e) {
      try {
        if (
          SpeechRecognition &&
          typeof SpeechRecognition.stopListening === 'function'
        ) {
          try {
            await SpeechRecognition.stopListening();
          } catch (err) {}
          instanceRef.current.requesting = true;
          SpeechRecognition.startListening({
            continuous: true,
            language: 'es-CO',
          });
        } else {
          instanceRef.current.requesting = false;
          rollbackTranscriptionRegistration();
        }
      } catch (err) {
        instanceRef.current.requesting = false;
        rollbackTranscriptionRegistration();
      }
    }
  };

  const handleStop = () => {
    try {
      const onEnd = onTranscriptionEndRef.current;
      if (onEnd && isTranscribingRef.current) {
        onEnd(new Date().toISOString(), charCountRef.current);
        isTranscribingRef.current = false;
      }
    } catch (stopMetricsErr) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          '[Kace] VoiceDictation handleStop onTranscriptionEnd',
          stopMetricsErr
        );
      }
    }
    instanceRef.current.requesting = false;
    instanceRef.current.started = false;
    setListening(false);
    try {
      if (typeof window !== 'undefined') {
        const myId = instanceRef.current.id;
        if (window.__voiceDictationActiveInstance === myId) {
          window.__voiceDictationActiveInstance = null;
          window.dispatchEvent(
            new CustomEvent('voice-dictation-active-changed', {
              detail: { id: null },
            })
          );
        }
      }
    } catch (e) {}
    try {
      managerRef.current.stopListening();
    } catch (e) {
      try {
        SpeechRecognition.stopListening();
      } catch (err) {}
    }
  };

  const handleChange = (event) => {
    let next = event.target.value;
    if (maxLength != null && next.length > maxLength) {
      next = next.slice(0, maxLength);
    }
    setText(next);
    baseTextRef.current = next;
    updateValue(next);
  };

  if (!browserSupportsSpeechRecognition) {
    return (
      <span className="text-muted">
        Este navegador no soporta el reconocimiento de voz.
      </span>
    );
  }

  const rows = typeof c?.rows === 'number' ? c.rows : 6;
  const placeholder =
    typeof c?.placeholder === 'string'
      ? c.placeholder
      : 'Hable (Iniciar) o escriba aquí…';

  return (
    <div className={`form-group ${disabledClassName}`}>
      <div className="d-flex align-items-center gap-2 mb-2">
        <button
          type="button"
          className={`mic-button mr-2 ${listening ? 'listening' : ''}`}
          aria-pressed={listening}
          onClick={() => (listening ? handleStop() : handleStart())}
          title={listening ? 'Detener grabación' : 'Iniciar grabación'}
          disabled={isDisabled}
        >
          {listening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <small className="text-muted ms-2">
          {listening ? 'Escuchando...' : ''}
        </small>
      </div>

      <textarea
        className="form-control"
        rows={rows}
        value={text}
        onChange={handleChange}
        placeholder={placeholder}
        {...(maxLength != null ? { maxLength } : {})}
        disabled={isDisabled || listening}
      />
      {maxLength != null && (
        <small className="text-muted d-block mt-1">
          {String(text ?? '').length} / {maxLength}
        </small>
      )}
    </div>
  );
};
