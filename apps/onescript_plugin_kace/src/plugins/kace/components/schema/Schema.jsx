import './Schema.css';
import '#plugins/kace/shared/styles/kace-disabled.css';
import '#plugins/kace/shared/styles/kace-error-list.css';
import { Form } from '@formio/react';
import { evaluateKace } from '#plugins/kace/shared/evaluateKace.js';
import useSchema from '#plugins/kace/hooks/useSchema.js';
import { useKaceDisabled } from '#plugins/kace/hooks/useKaceDisabled.hook.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KaceEngine } from '#plugins/kace/KaceEngine.js';
import { deepMerge } from '#plugins/kace/utils/deepMerge.js';
import {
  getIgnoreSchemaKeysFromComponent,
  DEFAULT_IGNORE_SCHEMA_KEYS,
  STORE_KEY_IGNORE_SCHEMA_KEYS,
} from '#plugins/kace/utils/getIgnoreSchemaKeysFromComponent.js';
import { removeKeysFromSubmissionData } from '#plugins/kace/utils/removeKeysFromSubmissionData.js';
import { createFormComponentRedrawFns } from '#plugins/kace/utils/createFormComponentRedrawFns.js';
import {
  attachFocusFormComponent,
  patchAlertSanitizer,
  showWebformErrors,
} from '#plugins/kace/shared/FocusFormComponent.js';
import {
  getFormioMessages,
  localizePatternName,
} from '#util/esValidationMessages.js';

/**
 * @typedef Props
 * @prop {{ [x: string]: unknown }} component - `this.component` properties
 * @prop {(value: any, flags: any, source: any) => any} updateValue - Function to update `this.value` (formio component instance) value
 * @prop {Function} onEvent - Event listener
 * @prop {any} root - Root formio instance to access parent form data
 * @prop {(instance: any) => void} [setFormInstance] - Optional callback to expose the child Form.io instance
 * @prop {{ data: any }} [submission] - Optional external submission data to prefill/control the child form
 * @prop {any} [globalRoot] - Optional explicit global root instance for deeply nested schemas
 * @prop {Function} [emit] - Optional emit function to emit events to the global root
 * @prop {boolean} [disabled=false] - Deshabilita interacciones y aplica la capa atenuada (kace-component--disabled)
 * @prop {boolean} [readOnly=false] - Campos en solo lectura en Form.io sin atenuar la tarjeta; se combina con `disabled` para `options.readOnly`
 * @prop {Record<string, any>} [initialData] - Datos iniciales para el child form
 */

/**
 * @param {Props} props
 */
export const Schema = ({
  component,
  updateValue,
  onEvent,
  offEvent,
  root,
  setFormInstance,
  submission: externalSubmission = null,
  initialData = {},
  globalRoot,
  emit,
  disabled = false,
  readOnly = false,
}) => {
  const {
    disabled: isDisabled,
    readOnlyLock,
    className: disabledClassName,
  } = useKaceDisabled(disabled);
  const formRef = useRef(null);
  const lastAppliedSubmissionRef = useRef(null);
  const didRunOnMountCodeRef = useRef(false);
  const isNestedFormChangeRef = useRef(false);
  const lastConfirmIdRef = useRef(null);
  const lastConfirmTickRef = useRef(0);
  const [globalChangeVersion, setGlobalChangeVersion] = useState(0);
  const [isFormReady, setIsFormReady] = useState(false);
  const validationSchemaRef = useRef(null);
  const validateFormDataRef = useRef(null);
  const currentSubmissionRef = useRef(null);

  const resolvedGlobalRootRef = useRef(null);
  if (!resolvedGlobalRootRef.current) {
    resolvedGlobalRootRef.current =
      globalRoot || root?.globalRoot || root || null;
  }
  const resolvedGlobalRoot = resolvedGlobalRootRef.current;

  const schemaKey = component?.key != null ? String(component.key) : null;
  /** Remount del Form.io al cambiar el formulario OneScript (p. ej. otra clasificación en aux cases). */
  const schemaFormRemountKey = useMemo(() => {
    const oid = component?.one_script_form_id ?? component?.oneScriptFormId;
    return String(oid ?? schemaKey ?? 'kace-schema-form');
  }, [component?.one_script_form_id, component?.oneScriptFormId, schemaKey]);

  const dataFromRoot = useMemo(() => {
    if (!root || schemaKey == null) return undefined;
    return root?.submission?.data?.[schemaKey] ?? root?.data?.[schemaKey];
  }, [
    root,
    schemaKey,
    root?.submission?.data,
    root?.data,
    globalChangeVersion,
  ]);

  const effectiveExternalSubmission = useMemo(() => {
    if (externalSubmission != null) return externalSubmission;
    if (dataFromRoot !== undefined) return { data: dataFromRoot ?? {} };
    return null;
  }, [externalSubmission, dataFromRoot]);

  const effectiveInitialData = useMemo(() => {
    if (effectiveExternalSubmission?.data != null)
      return effectiveExternalSubmission.data;
    if (
      initialData != null &&
      (typeof initialData !== 'object' || Object.keys(initialData).length > 0)
    )
      return initialData;
    return dataFromRoot ?? {};
  }, [effectiveExternalSubmission, initialData, dataFromRoot]);

  const {
    components,
    formName,
    submission,
    setSubmission,
    handleChange,
    error,
    validationSchema,
    validateFormData,
    isLoading: isSchemaLoading,
  } = useSchema({
    component,
    updateValue,
    onEvent,
    root,
    initialData: effectiveInitialData,
  });

  validationSchemaRef.current = validationSchema;
  validateFormDataRef.current = validateFormData;

  const kaceEngine = useMemo(() => KaceEngine(), []);
  const storeService = kaceEngine.getService('storeService');

  const apiUrl = storeService.get('config.api_url');

  const keysToIgnore = useMemo(
    () =>
      getIgnoreSchemaKeysFromComponent(component) ?? DEFAULT_IGNORE_SCHEMA_KEYS,
    [component]
  );

  useEffect(() => {
    const configuredKeys = getIgnoreSchemaKeysFromComponent(component);
    if (!configuredKeys?.length) return;
    try {
      const kace = KaceEngine();
      const store = kace.getService('storeService');
      if (!store?.get || !store?.set) return;
      const current = store.get(STORE_KEY_IGNORE_SCHEMA_KEYS) || [];
      const merged = [...new Set([...current, ...configuredKeys])];
      store.set(STORE_KEY_IGNORE_SCHEMA_KEYS, merged);
    } catch (e) {
      // ignore
    }
  }, [component]);

  const formSubmission = useMemo(() => {
    const data = effectiveExternalSubmission || submission || { data: {} };
    removeKeysFromSubmissionData(data, keysToIgnore);
    return data;
  }, [effectiveExternalSubmission, submission, keysToIgnore]);

  useEffect(() => {
    currentSubmissionRef.current = formSubmission;
  }, [formSubmission]);

  const globalData = useMemo(() => {
    return (
      resolvedGlobalRoot?.submission?.data || resolvedGlobalRoot?.data || {}
    );
  }, [resolvedGlobalRoot]);

  /**
   * `emit` explícito (p. ej. desde el wrapper Form.io) o, si falta, el de la raíz / formulario anidado.
   * Sin esto, el código de las pestañas custom (`onMountCode`, etc.) recibe `emit` undefined.
   */
  const resolvedEmit = useMemo(() => {
    if (typeof emit === 'function') return emit;
    const candidates = [globalRoot, root?.globalRoot, root, formRef.current];
    for (let i = 0; i < candidates.length; i += 1) {
      const target = candidates[i];
      if (target != null && typeof target.emit === 'function') {
        return target.emit.bind(target);
      }
    }
    return undefined;
  }, [emit, globalRoot, root, isFormReady, globalChangeVersion]);

  const buildCustomCodeContext = useCallback(
    () => ({
      kaceEngine,
      apiService: kaceEngine.getService('apiService'),
      url_api: apiUrl,
      globalData,
      emit: resolvedEmit,
      ...createFormComponentRedrawFns(formRef.current, {
        searchNestedFormOnly: true,
        validationSchemaRef,
        storeService,
      }),
    }),
    [kaceEngine, apiUrl, globalData, resolvedEmit, storeService]
  );

  const onFormReady = (instance) => {
    formRef.current = instance;
    if (instance) {
      attachFocusFormComponent(instance);
      patchAlertSanitizer(instance);
    }
    if (instance && resolvedGlobalRoot) {
      instance.globalRoot = resolvedGlobalRoot;
      instance.options = instance.options || {};
      instance.options.globalRoot = resolvedGlobalRoot;
    }
    resolvedGlobalRoot?.emit?.('kaceSchemaFormReady', {
      schemaKey,
      formId:
        component?.one_script_form_id ?? component?.oneScriptFormId ?? null,
    });
    setFormInstance?.(instance);
    setIsFormReady(true);

    // Mensajes de Form.io en español sin tocar `options.language`: cambiarlo dispara
    // `i18next.changeLanguage` + `rebuild()` (carrera con onMountCode) y hace que los
    // campos `kace_calendar` intenten bajar el locale de flatpickr desde un CDN inalcanzable
    // en este ambiente. Sobreescribimos el bundle 'en' en vez de activar 'es'.
    try {
      if (instance?.i18next && !instance.i18next.__kaceEsMessagesApplied) {
        instance.i18next.addResourceBundle(
          'en',
          'translation',
          getFormioMessages(),
          true,
          true
        );
        instance.i18next.__kaceEsMessagesApplied = true;
      }
    } catch {
      //ignore
    }

    if (instance) {
      try {
        const toApply = effectiveExternalSubmission ?? submission;
        if (toApply) {
          const serialized = JSON.stringify(toApply || {});
          lastAppliedSubmissionRef.current = serialized;

          if (typeof instance.setSubmission === 'function') {
            instance.setSubmission(toApply);
          } else if ('submission' in instance) {
            instance.submission = toApply;
            instance.emit?.('change', { submission: instance.submission });
          }
          instance.emit?.('redraw');
        }
      } catch (e) {
        //ignore
      }
    }
  };

  useEffect(() => {
    if (!root || !resolvedGlobalRoot) return;
    if (!root.globalRoot) root.globalRoot = resolvedGlobalRoot;
    if (!root.options) root.options = {};
    if (!root.options.globalRoot) root.options.globalRoot = resolvedGlobalRoot;
  }, [root, resolvedGlobalRoot]);

  useEffect(() => {
    const target = resolvedGlobalRoot;
    if (!target?.on) return undefined;

    const handler = () => {
      setGlobalChangeVersion((prev) => prev + 1);
    };

    target.on('change', handler);
    return () => {
      target.off?.('change', handler);
      target.removeListener?.('change', handler);
    };
  }, [resolvedGlobalRoot]);

  // Guards against a stale `_nestedFormAlertInstance` pointer: on unmount
  // (e.g. the aux-cases classification changes and this schema goes away),
  // drop the pointer only if it's still ours — a newer Schema instance may
  // have already taken over the slot.
  useEffect(() => {
    return () => {
      if (
        resolvedGlobalRoot &&
        resolvedGlobalRoot._nestedFormAlertInstance === formRef.current
      ) {
        resolvedGlobalRoot._nestedFormAlertInstance = null;
      }
    };
  }, [resolvedGlobalRoot]);

  useEffect(() => {
    const inst = formRef.current;
    if (!inst) return;

    try {
      const toApply = effectiveExternalSubmission ?? submission;
      const serialized = JSON.stringify(toApply || {});
      if (lastAppliedSubmissionRef.current === serialized) return;

      if (isNestedFormChangeRef.current) {
        isNestedFormChangeRef.current = false;
        lastAppliedSubmissionRef.current = serialized;
        return;
      }

      lastAppliedSubmissionRef.current = serialized;

      if (typeof inst.setSubmission === 'function') {
        inst.setSubmission(toApply);
      } else if ('submission' in inst) {
        inst.submission = toApply;
        inst.emit?.('change', { submission: inst.submission });
      }
      inst.emit?.('redraw');
    } catch (e) {
      //ignore
    }
  }, [effectiveExternalSubmission, submission]);

  useEffect(() => {
    if (!onEvent) return;
    if (!validationSchema || Object.keys(validationSchema).length === 0) return;
    // Sin guard de "bind once": onEvent/offEvent cambian de identidad en cada redraw de
    // Form.io (this.on.bind(this) nuevo), y el cleanup de abajo se ejecuta con la identidad
    // VIEJA antes de que este efecto vuelva a correr con la nueva — un guard que impidiera
    // re-suscribir aquí dejaría el componente sin listener después del primer redraw.
    const handler = async () => {
      if (resolvedGlobalRoot) {
        resolvedGlobalRoot._nestedFormValidationResult = null;
        resolvedGlobalRoot._nestedFormAlertInstance = null;
      }
      const validationPromise = (async () => {
        const liveData =
          formRef.current?.submission?.data ??
          formRef.current?.data ??
          formSubmission?.data ??
          {};
        const dataToValidate =
          keysToIgnore.length > 0
            ? (() => {
                const cloned = JSON.parse(JSON.stringify(liveData));
                removeKeysFromSubmissionData(cloned, keysToIgnore);
                return cloned;
              })()
            : liveData;
        const validationResult = await validateFormDataRef.current(
          validationSchemaRef.current,
          dataToValidate
        );

        if (!validationResult.valid) {
          const unmatchedErrors = [];
          if (formRef.current && validationResult.details) {
            if (typeof formRef.current.checkValidity === 'function') {
              await formRef.current.checkValidity(
                formRef.current.submission?.data ?? formRef.current.data,
                true
              );
            }

            for (const detail of validationResult.details) {
              const dotPath = detail.path.join('.');
              const leafKey =
                detail.path.length > 1 &&
                typeof detail.path[detail.path.length - 1] === 'string'
                  ? detail.path[detail.path.length - 1]
                  : null;
              const comp =
                (dotPath ? formRef.current.getComponent(dotPath) : null) ??
                (leafKey ? formRef.current.getComponent(leafKey) : null);

              if (
                comp &&
                typeof comp.setCustomValidity === 'function' &&
                !comp.error
              ) {
                comp.setCustomValidity(
                  localizePatternName(detail.message),
                  true
                );
                comp.pristine = false;
              } else if (!comp) {
                unmatchedErrors.push({
                  message: `${dotPath || leafKey}: ${localizePatternName(detail.message)}`,
                });
              }
            }
          } else if (validationResult.errors?.length) {
            for (const e of validationResult.errors) {
              unmatchedErrors.push({
                message: `${e.path ? `${e.path}: ` : ''}${localizePatternName(e.message)}`,
              });
            }
          }

          showWebformErrors(
            formRef.current,
            unmatchedErrors.length ? unmatchedErrors : null
          );

          if (resolvedGlobalRoot) {
            resolvedGlobalRoot._nestedFormAlertInstance = formRef.current;
          }

          return { valid: false };
        }

        if (formRef.current) {
          if (typeof formRef.current.setAlert === 'function') {
            formRef.current.setAlert('danger', '');
          }
          if (typeof formRef.current.everyComponent === 'function') {
            formRef.current.everyComponent((comp) => {
              if (comp && typeof comp.setCustomValidity === 'function') {
                comp.setCustomValidity('');
              }
            });
          } else if (typeof formRef.current.getComponents === 'function') {
            const comps = formRef.current.getComponents() || [];
            comps.forEach((comp) => {
              if (comp && typeof comp.setCustomValidity === 'function') {
                comp.setCustomValidity('');
              }
            });
          }
        }

        if (resolvedGlobalRoot) {
          resolvedGlobalRoot._nestedFormAlertInstance = null;
        }

        return { valid: true };
      })();

      if (resolvedGlobalRoot) {
        resolvedGlobalRoot._nestedFormValidationPromise = validationPromise;
        try {
          const result = await validationPromise;
          resolvedGlobalRoot._nestedFormValidationResult = result;
        } catch (e) {
          resolvedGlobalRoot._nestedFormValidationResult = { valid: false };
        }
      }

      const validationResult = await validationPromise;
      if (!validationResult?.valid) {
        return;
      }
    };

    const handlerConfirm = async (payload = {}) => {
      if (payload?.confirmId != null) {
        if (lastConfirmIdRef.current === payload.confirmId) return;
        lastConfirmIdRef.current = payload.confirmId;
      }
      const now = Date.now();
      if (now - lastConfirmTickRef.current < 50) return;
      lastConfirmTickRef.current = now;

      try {
        const result = resolvedGlobalRoot?._nestedFormValidationResult;
        if (result && result.valid === false) return;
      } catch (e) {
        return;
      }

      if (
        formRef.current &&
        typeof formRef.current.checkValidity === 'function'
      ) {
        const ok = await formRef.current.checkValidity(
          formRef.current.submission?.data ?? formRef.current.data,
          true
        );
        if (!ok) {
          return;
        }
      }

      if (component?.onSubmitCode) {
        try {
          evaluateKace(component.onSubmitCode, {
            ...buildCustomCodeContext(),
            data: formSubmission,
            handleChange,
          });
        } catch (error) {
          //ignore
        }
      }

      if (formRef.current) {
        try {
          await formRef.current.submit();
        } catch (err) {
          //ignore
        }
      }
    };

    onEvent('submitButtonClicked', handler);
    onEvent('submitButtonConfirmed', handlerConfirm);
    return () => {
      offEvent?.('submitButtonClicked', handler);
      offEvent?.('submitButtonConfirmed', handlerConfirm);
    };
  }, [
    onEvent,
    offEvent,
    resolvedGlobalRoot,
    validationSchema,
    formSubmission,
    component?.onSubmitCode,
    buildCustomCodeContext,
    handleChange,
    keysToIgnore,
    formSubmission,
  ]);

  const setDataWrapper = useCallback(
    (newSubmission) => {
      const currentSubmission = currentSubmissionRef.current || { data: {} };

      const mergedData = deepMerge(
        { ...(currentSubmission.data || {}) },
        newSubmission?.data ?? {}
      );

      const mergedSubmission = {
        ...currentSubmission,
        ...newSubmission,
        data: mergedData,
      };

      setSubmission(mergedSubmission);

      const inst = formRef.current;
      if (inst) {
        try {
          if (typeof inst.setSubmission === 'function') {
            inst.setSubmission(mergedSubmission);
          } else if ('submission' in inst) {
            inst.submission = mergedSubmission;
            inst.emit?.('change', { submission: inst.submission });
          }
        } catch (e) {
          //ignore
        }
      }

      const key = component?.key != null ? String(component.key) : null;
      if (root && key != null) {
        try {
          if (!root.submission) root.submission = {};
          if (!root.submission.data) root.submission.data = {};
          root.submission.data[key] = mergedData;
          if (!root.data) root.data = {};
          root.data[key] = mergedData;
          root.emit?.('change', { submission: root.submission });
        } catch (e) {
          //ignore
        }
      }

      try {
        updateValue?.(mergedData, { modified: true }, 'custom');
      } catch (e) {
        //ignore
      }
    },
    [setSubmission, root, component?.key, updateValue]
  );

  const handleChangeWithOnChangeCode = useCallback(
    (changed) => {
      isNestedFormChangeRef.current = true;
      handleChange(changed);
      if (!component?.onChangeCode || !changed?.data) return;
      try {
        evaluateKace(component.onChangeCode, {
          ...buildCustomCodeContext(),
          data: changed,
          setData: setDataWrapper,
          handleChange,
        });
      } catch (e) {
        // ignore
      }
    },
    [
      handleChange,
      component?.onChangeCode,
      buildCustomCodeContext,
      setDataWrapper,
    ]
  );

  useEffect(() => {
    if (didRunOnMountCodeRef.current) return;
    if (!components.length) return;
    if (!component?.onMountCode) return;
    if (!isFormReady) return;

    didRunOnMountCodeRef.current = true;
    try {
      evaluateKace(component.onMountCode, {
        ...buildCustomCodeContext(),
        data: formSubmission,
        setData: setDataWrapper,
        handleChange,
      });
    } catch (error) {
      //ignore
    }
  }, [
    component?.onMountCode,
    components.length,
    formSubmission,
    handleChange,
    isFormReady,
    buildCustomCodeContext,
    setDataWrapper,
  ]);

  if (!components.length) {
    return (
      <div className="card shadow-sm">
        <div className="card-body p-4">
          <h1 className="h3 font-weight-bold mb-2">{formName}</h1>
          {error ? (
            <div className="alert alert-danger">
              Error cargando schema: {error}
            </div>
          ) : isSchemaLoading ? (
            <div className="text-muted">
              Cargando esquema de caso auxiliar...
            </div>
          ) : (
            <div className="text-muted">
              No hay componentes de esquema disponibles.
            </div>
          )}
        </div>
      </div>
    );
  }

  const formIsReadOnly = Boolean(isDisabled || readOnly);

  return (
    <div className={`card shadow-sm ${disabledClassName}`}>
      <div className="card-body p-4">
        <h1 className="h3 font-weight-bold mb-2">{formName}</h1>
        <div className="overflow-auto schema-card">
          {components.length > 0 && (
            <Form
              key={schemaFormRemountKey}
              form={{
                display: 'form',
                type: 'form',
                components,
              }}
              submission={formSubmission}
              onChange={handleChangeWithOnChangeCode}
              formReady={onFormReady}
              options={{
                readOnly: formIsReadOnly,
                ...(resolvedGlobalRoot != null
                  ? { globalRoot: resolvedGlobalRoot }
                  : {}),
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
