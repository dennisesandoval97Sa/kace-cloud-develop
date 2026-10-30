import { useCallback, useEffect, useState, useRef } from 'react';
import { KaceEngine } from '#plugins/kace/KaceEngine.js';
import {
  getIgnoreSchemaKeysFromComponent,
  keysNotInSchema,
  DEFAULT_IGNORE_SCHEMA_KEYS,
} from '#plugins/kace/utils/getIgnoreSchemaKeysFromComponent.js';
import { removeKeysFromSubmissionData } from '#plugins/kace/utils/removeKeysFromSubmissionData.js';
import { getJoiMessages } from '#util/esValidationMessages.js';
import { runInFlight } from '#plugins/kace/utils/runInFlight.js';
import { storeService } from '../services/storeService';
import {
  preprocessSchema,
  transformFormioComponents,
} from './useSchema.utils.js';

const UseSchema = ({
  onEvent,
  root,
  updateValue,
  component = /** @type {any} */ ({}),
  initialData = {},
}) => {
  const [components, setComponents] = useState([]);
  const [formName, setFormName] = useState('Formulario Auxiliar');
  const [submission, setSubmission] = useState({ data: initialData });
  const [validationSchema, setValidationSchema] = useState({});
  const [error, setError] = useState(null);
  /** Distingue "todavía no terminó la primera resolución" de "ya terminó pero no hay componentes". */
  const [isLoading, setIsLoading] = useState(true);
  const lastInitialDataRef = useRef(null);
  const latestInitialDataRef = useRef(initialData ?? {});
  const formInitializedRef = useRef(false);
  const hasInitialDataRef = useRef(false);
  const isInternalChangeRef = useRef(false);
  const oneScriptFormIdRef = useRef(null);
  const didBindAuthHandlerRef = useRef(false);
  /** Evita que una petición antigua (p. ej. clasificación previa) sobrescriba componentes y `validationSchema` tras un cambio de `one_script_form_id`. */
  const fetchGenerationRef = useRef(0);

  const componentAny = /** @type {any} */ (component);
  const oneScriptFormId =
    componentAny?.one_script_form_id ??
    componentAny?.oneScriptFormId ??
    componentAny?.data?.one_script_form_id ??
    null;

  const isUpdate = Boolean(storeService.get('cases.case_id'));

  useEffect(() => {
    latestInitialDataRef.current = initialData ?? {};

    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }

    const newData = initialData ?? {};
    const serialized = JSON.stringify(newData);
    const hasData = Object.keys(newData).length > 0;

    if (hasData) {
      hasInitialDataRef.current = true;
    }

    if (lastInitialDataRef.current !== serialized) {
      lastInitialDataRef.current = serialized;
      setSubmission({ data: newData });
      formInitializedRef.current = false;
    }
  }, [initialData]);

  /**
   * @param {string} oneScriptFormIdParam
   * @param {number} [requestGeneration] Si se pasa y deja de coincidir con `fetchGenerationRef`, se ignoran los resultados (petición obsoleta).
   */
  const fetchSchema = useCallback(
    async (oneScriptFormIdParam, requestGeneration) => {
      const isStale = () =>
        requestGeneration != null &&
        requestGeneration !== fetchGenerationRef.current;

      try {
        const kace = KaceEngine();
        const oneScriptService = kace.getService('oneScript');
        const auxService = kace.getService('aux');
        const storeService = kace.getService('storeService');
        if (!oneScriptService)
          throw new Error('El servicio OneScript no está disponible');

        const oneScriptCacheKey = `onescript.forms.${oneScriptFormIdParam}`;
        const cachedOneScript = storeService?.get?.(oneScriptCacheKey);
        let oneScriptData = cachedOneScript?.oneScriptData ?? null;
        let formSchema = cachedOneScript?.formSchema ?? null;

        if (!oneScriptData || !formSchema) {
          const fetched = await runInFlight(
            `onescript:${oneScriptFormIdParam}`,
            async () => {
              const res = await oneScriptService.getSchema({
                oneScriptFormId: oneScriptFormIdParam,
              });
              return res;
            }
          );
          if (isStale()) return;
          oneScriptData = fetched?.oneScriptData ?? null;
          formSchema = fetched?.formSchema ?? null;
          if (storeService?.set) {
            storeService.set(oneScriptCacheKey, { oneScriptData, formSchema });
          }
        }

        const schemaId = oneScriptData?.schema_id ?? null;
        let validationSchemaResponse = null;
        if (schemaId) {
          const auxCacheKey = `aux.forms.${schemaId}`;
          validationSchemaResponse = storeService?.get?.(auxCacheKey) ?? null;
          if (!validationSchemaResponse) {
            validationSchemaResponse = await runInFlight(
              `auxSchema:${schemaId}`,
              async () => {
                return await auxService.fetchAuxSchema({ schemaId });
              }
            );

            storeService.set(auxCacheKey, validationSchemaResponse);
          }
        }

        if (isStale()) return;

        const dataStructure = validationSchemaResponse?.data_structure ?? {};
        const loadedComponents =
          formSchema ?? oneScriptData?.schemaData?.components ?? [];
        const loadedFormName = oneScriptData?.name ?? 'Formulario Auxiliar';

        const transformedComponents = transformFormioComponents(
          loadedComponents || [],
          dataStructure
        );

        if (isStale()) return;

        setValidationSchema(dataStructure);
        setFormName(loadedFormName);
        setComponents(transformedComponents);
        setError(null);
      } catch (err) {
        if (isStale()) return;
        setError(err?.message ?? String(err));
        setComponents([]);
        setFormName('Formulario Auxiliar');
      } finally {
        if (isStale()) return;
        setIsLoading(false);
        if (Object.keys(latestInitialDataRef.current).length > 0) {
          setSubmission({ data: latestInitialDataRef.current });
        }
      }
    },
    [latestInitialDataRef]
  );

  useEffect(() => {
    oneScriptFormIdRef.current = oneScriptFormId;

    if (!oneScriptFormId) {
      fetchGenerationRef.current += 1;
      setIsLoading(false);
    } else {
      const myGen = (fetchGenerationRef.current += 1);
      setIsLoading(true);
      void fetchSchema(oneScriptFormId, myGen);
    }

    if (!onEvent) return;

    if (didBindAuthHandlerRef.current) return;
    didBindAuthHandlerRef.current = true;

    const authHandler = () => {
      const currentId = oneScriptFormIdRef.current;
      if (currentId) {
        const myGen = (fetchGenerationRef.current += 1);
        void fetchSchema(currentId, myGen);
      }
    };

    onEvent('kaceAuthData', authHandler);
  }, [oneScriptFormId, fetchSchema, onEvent]);

  const handleChange = useCallback(
    (changed) => {
      if (!changed?.data) {
        return;
      }

      setSubmission({ data: changed.data });
      try {
        updateValue(changed.data, { modified: true }, 'change');
      } catch (err) {
        console.error('[useSchema] updateValue error', err);
      }

      if (root && typeof root.emit === 'function') {
        try {
          root.emit('schemaDataChanged', { data: changed.data });
        } catch (e) {
          /* ignore */
        }
      }
    },
    [root, updateValue]
  );

  const validateFormData = async (dataStructure, formData) => {
    if (!dataStructure) {
      return { valid: true, errors: [] };
    }

    try {
      const keysToIgnore =
        getIgnoreSchemaKeysFromComponent(componentAny) ??
        DEFAULT_IGNORE_SCHEMA_KEYS;
      // Llaves que sobreviven de una clasificación anterior: el backend las acepta, así que el
      // plugin no puede rechazarlas. Se descartan solo en la raíz, sin el barrido recursivo por
      // nombre de `removeKeysFromSubmissionData`, que borraría homónimas legítimas del schema nuevo.
      const orphanKeys = keysNotInSchema(dataStructure, formData);
      // Clone formData and strip keys that are not in the schema (e.g. kaceSubcases).
      // The schema is not modified; we only pass a cleaned payload to validate() so the validator does not reject unknown keys.
      const payloadForValidation =
        keysToIgnore.length > 0 || orphanKeys.length > 0
          ? (() => {
              const cloned = JSON.parse(JSON.stringify(formData ?? {}));
              if (keysToIgnore.length > 0) {
                removeKeysFromSubmissionData(cloned, keysToIgnore);
              }
              for (const key of orphanKeys) {
                delete cloned[key];
              }
              return cloned;
            })()
          : (formData ?? {});

      const SchemaBuilder = (
        await import('@kace/schemabuilder/src/SchemaBuilder.js')
      ).default;
      // preprocessSchema is imported from useSchema.utils.js

      const processedSchema = preprocessSchema(
        dataStructure,
        payloadForValidation
      );
      const schemaBuilderResult = await SchemaBuilder.build(processedSchema);
      const { error, value } = schemaBuilderResult.validate(
        payloadForValidation,
        { context: { isUpdate }, messages: getJoiMessages() }
      );

      if (error) {
        const errors = error.details.map((detail) => ({
          path: detail.path.join('.'),
          message: detail.message,
          type: detail.type,
        }));
        console.error('[useSchema] Validation errors:', errors);
        return { valid: false, errors, details: error.details };
      }

      return { valid: true, errors: [], value };
    } catch (err) {
      console.error('[useSchema] Validation error:', err);
      return {
        valid: false,
        errors: [{ message: err.message || String(err) }],
      };
    }
  };

  return {
    components,
    formName,
    submission,
    setSubmission,
    handleChange,
    error,
    validationSchema,
    validateFormData,
    isLoading,
  };
};

export default UseSchema;
