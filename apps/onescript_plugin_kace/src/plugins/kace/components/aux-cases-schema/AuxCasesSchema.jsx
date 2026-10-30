import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Schema } from '../schema/Schema.jsx';
import { KaceEngine } from '#plugins/kace/KaceEngine.js';
import '#plugins/kace/shared/styles/kace-disabled.css';
import { useKaceDisabled } from '#plugins/kace/hooks/useKaceDisabled.hook.js';

/**
 * Nombres de campo que el `data_structure` de un esquema auxiliar admite para una
 * clave de formulario dada. Replica el mismo criterio plano/anidado que ya usa
 * `caseService.validateCaseFields` (`isSingleWrappedKey`) para no introducir una
 * segunda interpretación de la forma del `data_structure`.
 * @param {Record<string, unknown> | null} dataStructure
 * @param {string | null} formKey
 * @returns {string[]}
 */
function getAllowedAuxFieldNames(dataStructure, formKey) {
  if (!dataStructure || typeof dataStructure !== 'object') return [];
  const nested = formKey != null ? dataStructure[formKey] : null;
  if (nested && typeof nested === 'object') return Object.keys(nested);
  return Object.keys(dataStructure);
}

/**
 * @typedef Props
 * @prop {{ [x: string]: unknown }} component - `this.component` properties
 * @prop {(value: any, flags: any, source: any) => any} updateValue - Function to update `this.value` (formio component instance) value
 * @prop {Function} onEvent - Event listener
 * @prop {Function} [offEvent] - Baja del listener. Sin ella, cada tecla en el schema anidado apila otro `submitButtonClicked`.
 * @prop {any} root - Root formio instance to access parent form data
 * @prop {Function} setFormInstance - Optional, for parent to get formio instance
 * @prop {string} [schemaId] - Optional external schema id to use instead of `component` fields
 * @prop {string} [oneScriptFormId] - Optional external oneScript form id alias
 * @prop {Record<string, unknown> | null} [initialSubmission] - Datos iniciales para precarga (objeto keyed por primaryKey); usado en modo edición con schema externo.
 * @prop {boolean} [isSubcase=false] - Si es true, el schema se guarda en aux_subcases_schema; si no, en aux_cases_schema.
 * @prop {number} [subcaseSchemaRefreshNonce=0] - Modal de subcasos: al cambiar `clasificacion_id` el padre incrementa; fuerza de nuevo `GET` de reglas/defs.
 *   El caso **padre** (formulario OneScript) usa un contador interno y el evento `kaceClassificationsChange` (no pasa prop).
 * @prop {any} [globalRoot] - Raíz global Form.io (la establece el wrapper `kace_aux_cases_schema`).
 * @prop {Function} [emit] - Para `onMountCode` / `onChangeCode` / `onSubmitCode` del Schema (eventos del formulario).
 * @prop {string} [primaryKey] - Clave primaria del formulario.
 * @prop {boolean} [disabled=false] - Deshabilitado global del formulario (capa atenuada)
 * @prop {boolean} [readOnly=false] - Solo lectura sin atenuar (p. ej. ver subcaso)
 */

export const AuxCasesSchema = ({
  component,
  updateValue,
  onEvent,
  offEvent,
  root,
  setFormInstance,
  schemaId: externalSchemaId,
  oneScriptFormId: externalOneScriptFormId,
  initialSubmission,
  isSubcase = false,
  subcaseSchemaRefreshNonce = 0,
  globalRoot: globalRootProp,
  emit: emitProp,
  primaryKey: externalPrimaryKey,
  disabled = false,
  readOnly = false,
}) => {
  const {
    disabled: isDisabled,
    readOnlyLock,
    className: disabledClassName,
  } = useKaceDisabled(disabled);
  const [formData, setFormData] = useState(null);
  const [error, setError] = useState(null);
  const [oneScriptForm, setOneScriptForm] = useState(null);
  const [primaryKey, setPrimaryKey] = useState(externalPrimaryKey ?? null);
  const [classificationId, setClassificationId] = useState(null);
  const classificationIdRef = useRef(classificationId);
  classificationIdRef.current = classificationId;
  const [shouldHide, setShouldHide] = useState(false);
  const [hasSchemaId, setHasSchemaId] = useState(false);
  const formInstanceRef = useRef(null);
  const initialSyncDoneRef = useRef(false);
  /** Invalida resultados si el usuario cambia de clasificación mientras hay peticiones en curso. */
  const auxSchemaFetchGenerationRef = useRef(0);
  /** Espeja `formData` para leerlo sin añadir dependencias que reactiven otros efectos/callbacks. */
  const formDataRef = useRef(formData);
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);
  /** `data_structure` del esquema auxiliar actualmente resuelto (para el `primaryKey` vigente). */
  const schemaDataStructureRef = useRef(null);
  /** Captura de los datos vivos del formulario justo antes de `clearForm()`, para conservar
   * (por nombre de campo) los valores compatibles con el siguiente formulario al reclasificar
   * encadenadamente (A→B→C), en vez de recurrir siempre al snapshot original persistido. */
  const preReclassificationDataRef = useRef(null);
  /** Caso padre: se incrementa al **cambiar** de una clasificación a otra (evento kaceClassificationsChange); no en la primera elección. Fuerza GET de `/aux-definitions` y `/schemas/.../rules` sin caché. */
  const [parentCaseSchemaRefreshNonce, setParentCaseSchemaRefreshNonce] =
    useState(0);

  const resolvedGlobalRoot = useMemo(
    () => globalRootProp ?? root?.globalRoot ?? root,
    [globalRootProp, root]
  );

  const resolvedEmit = useMemo(() => {
    if (typeof emitProp === 'function') return emitProp;
    const target = resolvedGlobalRoot;
    return target != null && typeof target.emit === 'function'
      ? target.emit.bind(target)
      : undefined;
  }, [emitProp, resolvedGlobalRoot]);

  const kace = KaceEngine();
  const auxService = kace.getService('aux');
  const user = kace.getService('user');
  const oneScriptService = kace.getService('oneScript');
  const caseService = kace.getService('cases');
  const storeService = kace.getService('storeService');
  const classificationsService = kace.getService('classifications');

  const handleSetFormInstance = (instance) => {
    formInstanceRef.current = instance;
    setFormInstance?.(instance);
  };

  useEffect(() => {
    const requestGeneration = (auxSchemaFetchGenerationRef.current += 1);
    const isStaleRequest = () =>
      requestGeneration !== auxSchemaFetchGenerationRef.current;

    const resolveOneScriptFormId = async ({
      classificationsService,
      oneScriptService,
      classificationId,
      groupId,
    }) => {
      if (!classificationsService || !classificationId) return null;
      const rels = await classificationsService.get(
        'classifications.classifications_groups_relationship',
        { classificationId, groupId }
      );
      if (isStaleRequest()) return null;
      if (!Array.isArray(rels) || !rels.length) return null;
      const possibleForm =
        rels[0]?.one_script_id ||
        rels[0]?.form ||
        rels[0]?.form_id ||
        rels[0]?.one_script_form_id ||
        null;
      if (!possibleForm) return null;
      if (!oneScriptService?.fetchOneScriptData) {
        throw new Error(
          'El servicio OneScript no está disponible para resolver el ID del esquema'
        );
      }
      const oneScriptData =
        await oneScriptService.fetchOneScriptData(possibleForm);
      if (isStaleRequest()) return null;
      const schemaId =
        oneScriptData?.schema_id ?? oneScriptData?.schemaId ?? null;
      if (!schemaId) {
        throw new Error(
          `No se encontró ningún schema_id en los datos de OneScript para el formulario: ${possibleForm}`
        );
      }
      setOneScriptForm(possibleForm);
      return { schemaId, oneScriptFormId: possibleForm, oneScriptData };
    };

    const fetchSchema = async () => {
      try {
        setError(null);
        const shouldForceSchema = Boolean(
          (isSubcase && subcaseSchemaRefreshNonce > 0) ||
          (!isSubcase && parentCaseSchemaRefreshNonce > 0)
        );

        let schemaId = externalSchemaId;
        let taskLabel;
        /** Caso en edición con `parent_id` (fila es un subcaso); no confundir con el prop `isSubcase` del modal. */
        let caseRowIsSubcase = false;
        /** OneScript metadata derivada de `resolveOneScriptFormId`; usado para precargar `formSchema` en paralelo con la bundle. */
        let resolvedOneScript = null;

        if (externalSchemaId) {
          setCaseDataForForm(
            initialSubmission != null && typeof initialSubmission === 'object'
              ? { aux_case: { data: initialSubmission } }
              : null
          );
          if (externalOneScriptFormId)
            setOneScriptForm(externalOneScriptFormId);
          setHasSchemaId(true);
        } else {
          const userData = await user.get('user.user_data');
          if (isStaleRequest()) return;

          let caseData = null;
          try {
            caseData = await caseService.get('cases.case_data');
          } catch (err) {
            //ignore
          }
          if (isStaleRequest()) return;

          const caseId = caseData?.caso_id ?? caseData?.id ?? null;
          const isNewCase = !caseId;

          if (caseData) {
            taskLabel = caseData?.aux_case?.data?.task_label || null;
            caseRowIsSubcase = Boolean(caseData?.parent_id);
          }

          setCaseDataForForm(isNewCase ? null : caseData);

          const reclassifiedId = classificationIdRef.current;
          let resolvedClassificationId;
          if (reclassifiedId != null && reclassifiedId !== '') {
            resolvedClassificationId = reclassifiedId;
          } else if (isNewCase && root?.data?.clasificacion_id) {
            resolvedClassificationId = root.data.clasificacion_id;
          } else {
            resolvedClassificationId =
              caseData?.clasificacion_id ??
              caseData?.case?.clasificacion_id ??
              userData?.grupo_activo?.clasificacion_id ??
              null;
          }

          if (
            String(resolvedClassificationId ?? '') !==
            String(classificationIdRef.current ?? '')
          ) {
            setClassificationId(resolvedClassificationId);
          }

          let groupId =
            storeService.get('config.selected_group_id') ??
            userData?.grupo_activo?.grupo_id ??
            null;
          resolvedOneScript = await resolveOneScriptFormId({
            classificationsService,
            oneScriptService,
            classificationId: resolvedClassificationId,
            groupId,
          });
          schemaId = resolvedOneScript?.schemaId ?? null;

          if (!schemaId) {
            if (!isStaleRequest()) {
              setHasSchemaId(false);
            }
            return;
          }
          if (!isStaleRequest()) {
            setHasSchemaId(true);
          }
        }

        let auxCasesSchema =
          !shouldForceSchema &&
          (root?.aux_cases_schema ||
            root?.submission?.data?.aux_cases_schema ||
            null);
        let result = null;

        /**
         * Paraleliza dos requests independientes:
         *   1) `POST /schemas/rules/search` (bundle: aux_cases + reglas del form OneScript).
         *   2) `GET <oneScriptData.url_api>` (componentes Form.io del form OneScript).
         * El segundo lo dispara normalmente `useSchema` cuando `<Schema>` monta; al
         * adelantarlo y precachear `onescript.forms.${id}`, el hijo no vuelve a pegarlo
         * y se elimina el flash "No hay componentes de esquema disponibles".
         */
        const formSchemaPromise = (() => {
          const url = resolvedOneScript?.oneScriptData?.url_api;
          if (!url || !oneScriptService?.fetchFormSchema)
            return Promise.resolve(null);
          return oneScriptService.fetchFormSchema(url).catch(() => null);
        })();

        const bundlePromise = auxService.fetchSchemasRulesBundle({
          schemaId,
          forceRefresh: shouldForceSchema,
        });

        const [bundle, formSchema] = await Promise.all([
          bundlePromise,
          formSchemaPromise,
        ]);
        if (isStaleRequest()) return;

        if (!auxCasesSchema && bundle.auxCasesSchema) {
          auxCasesSchema = bundle.auxCasesSchema;
        }

        if (bundle.validationSchema) {
          result = { ...bundle.validationSchema };
        } else {
          if (!auxCasesSchema) {
            auxCasesSchema = await auxService.fetchAuxCasesSchema({
              forceRefresh: shouldForceSchema,
            });
            if (isStaleRequest()) return;
          }
          result = await auxService.fetchValidationSchema({
            isCaseModule: true,
            schemaId,
            auxCasesSchema,
            keySchema: primaryKey,
            forceRefresh: shouldForceSchema,
          });
          if (isStaleRequest()) return;
        }

        if (root && auxCasesSchema && !root.aux_cases_schema) {
          root.aux_cases_schema = auxCasesSchema;
        }
        if (schemaId && result && storeService?.set) {
          storeService.set(`aux.forms.${schemaId}`, result);
        }
        if (
          resolvedOneScript?.oneScriptFormId &&
          resolvedOneScript?.oneScriptData &&
          storeService?.set
        ) {
          storeService.set(
            `onescript.forms.${resolvedOneScript.oneScriptFormId}`,
            {
              oneScriptData: resolvedOneScript.oneScriptData,
              formSchema: formSchema ?? null,
            }
          );
        }
        const storeKey =
          isSubcase || caseRowIsSubcase
            ? 'aux_case.aux_subcases_schema'
            : 'aux_case.aux_cases_schema';
        storeService.set(storeKey, result);
        if (!result?.data_structure) {
          throw new Error(
            'No hay ninguna estructura de datos en el esquema de validación'
          );
        }
        schemaDataStructureRef.current = result.data_structure;
        const keysSchema = Object.keys(result.data_structure || {});
        if (
          !primaryKey &&
          (taskLabel || keysSchema.length === 1 || result?.name)
        ) {
          setPrimaryKey(
            taskLabel && caseRowIsSubcase
              ? taskLabel
              : result?.name && result.name !== 'aux_case'
                ? result.name
                : keysSchema[0]
          );
        }
        if (!isStaleRequest()) {
          setError(null);
          storeService.set('aux_case.hasSchema', true);
          if (!isSubcase) {
            setParentCaseSchemaRefreshNonce(0);
          }
        }
      } catch (err) {
        if (isStaleRequest()) return;
        setError(err?.message ?? String(err));
        setPrimaryKey(null);
      }
    };
    fetchSchema();
  }, [
    component,
    root,
    externalSchemaId,
    externalOneScriptFormId,
    classificationId,
    initialSubmission,
    isSubcase,
    subcaseSchemaRefreshNonce,
    parentCaseSchemaRefreshNonce,
  ]);

  const [caseDataForForm, setCaseDataForForm] = useState(null);
  useEffect(() => {
    if (!primaryKey) return;

    if (caseDataForForm === null) {
      setFormData({});
      initialSyncDoneRef.current = false;
      return;
    }

    const initialAuxData = caseDataForForm?.aux_case?.data ?? {};
    let formDataToSet = initialAuxData[primaryKey];
    if (
      formDataToSet === undefined ||
      formDataToSet === null ||
      typeof formDataToSet !== 'object'
    ) {
      const carryOver = preReclassificationDataRef.current;
      const carryOverKeys = carryOver?.data ? Object.keys(carryOver.data) : [];
      const hasSessionCarryOver = carryOverKeys.length > 0;

      const originalClassificationId =
        caseDataForForm?.clasificacion_id ??
        caseDataForForm?.case?.clasificacion_id ??
        null;
      const isReclassifying =
        hasSessionCarryOver ||
        (originalClassificationId != null &&
          String(originalClassificationId) !== String(classificationId ?? ''));

      if (isReclassifying) {
        // Base: unión por nombre de campo de TODAS las clasificaciones ya
        // persistidas para este caso (puede haber varias tras sucesivas
        // reclasificaciones guardadas). Encima, si hay edición viva en la
        // sesión actual (p. ej. tras una reclasificación previa A→B sin
        // guardar aún), esa es la más fresca y prevalece por nombre de campo.
        const persistedMerged = Object.values(initialAuxData).reduce(
          (merged, value) =>
            value && typeof value === 'object'
              ? { ...merged, ...value }
              : merged,
          {}
        );
        const sourceData = hasSessionCarryOver
          ? { ...persistedMerged, ...carryOver.data }
          : persistedMerged;

        const allowedFieldNames = getAllowedAuxFieldNames(
          schemaDataStructureRef.current,
          primaryKey
        );
        formDataToSet =
          sourceData && allowedFieldNames.length > 0
            ? Object.fromEntries(
                Object.entries(sourceData).filter(([key]) =>
                  allowedFieldNames.includes(key)
                )
              )
            : {};
      } else {
        // Carga normal (sin reclasificar): incluso aquí el dato persistido puede
        // venir corrupto (p. ej. `null`); sin este resguardo, `formData` se queda
        // en un valor no-objeto y la pantalla de carga nunca desaparece.
        const keys = Object.keys(initialAuxData);
        const legacyData = keys.length > 0 ? initialAuxData[keys[0]] : null;
        formDataToSet =
          legacyData && typeof legacyData === 'object' ? legacyData : {};
      }
    }

    setFormData(formDataToSet);

    initialSyncDoneRef.current = false;
  }, [primaryKey, caseDataForForm, classificationId, root]);

  const clearForm = useCallback(() => {
    preReclassificationDataRef.current = { data: formDataRef.current ?? {} };
    setShouldHide(true);
    setClassificationId(null);
    setOneScriptForm(null);
    setFormData({});
    setPrimaryKey(null);
    initialSyncDoneRef.current = false;
    storeService.set(
      'classifications.classifications_groups_relationship',
      null
    );
    if (!isSubcase) {
      storeService.set('aux_case.aux_cases_schema', null);
      storeService.set('aux_case.hasSchema', false);
    }
    if (root?.submission?.data?.aux_cases?.data) {
      root.submission.data.aux_cases.data = {};
    }
  }, [isSubcase, root, storeService]);

  useEffect(() => {
    const formLike = root?.globalRoot ?? root;
    if (!formLike?.on) return undefined;

    const handleClassificationChange = (newClassificationId) => {
      const prev = classificationIdRef.current;
      if (
        newClassificationId != null &&
        newClassificationId !== '' &&
        String(newClassificationId) !== String(prev ?? '')
      ) {
        if (!isSubcase && classificationIdRef.current != null) {
          setParentCaseSchemaRefreshNonce((n) => n + 1);
        }
        clearForm();
        setClassificationId(newClassificationId);
        setShouldHide(false);
      } else if (newClassificationId == null || newClassificationId === '') {
        setShouldHide(true);
      }
    };

    formLike.on('kaceClassificationsChange', handleClassificationChange);
    return () => {
      formLike.off?.('kaceClassificationsChange', handleClassificationChange);
      formLike.removeListener?.(
        'kaceClassificationsChange',
        handleClassificationChange
      );
    };
  }, [root, clearForm]);

  const handleUpdateValue = useCallback(
    (data, flags, source) => {
      if (formData === null) return;
      if (primaryKey == null && (data === undefined || data === null)) return;

      if (!initialSyncDoneRef.current && data !== formData) {
        data = formData;
        initialSyncDoneRef.current = true;
      }

      const wrapped = primaryKey != null ? { [primaryKey]: data } : data;
      setFormData(data);

      if (root) {
        if (!root.submission) root.submission = {};
        if (!root.submission.data) root.submission.data = {};
        if (!root.submission.data.aux_cases)
          root.submission.data.aux_cases = {};
        root.submission.data.aux_cases.data = wrapped;

        if (!root.data) root.data = {};
        if (!root.data.case_data) root.data.case_data = {};
        if (!root.data.case_data.aux_cases) root.data.case_data.aux_cases = {};
        root.data.case_data.aux_cases.data = wrapped;

        root.emit?.('auxCasesDataChanged', {
          data: wrapped,
          aux_cases: root.submission.data.aux_cases,
        });
      }

      updateValue?.(wrapped, flags ?? { modified: true }, source ?? 'change');
    },
    [primaryKey, root, updateValue, formData]
  );

  if (shouldHide || !hasSchemaId) {
    return null;
  }

  if (error) {
    return (
      <div className="card shadow-sm">
        <div className="card-body p-4">
          <div className="alert alert-danger">{error}</div>
        </div>
      </div>
    );
  }

  if (formData === null || primaryKey === null) {
    return (
      <div className="card shadow-sm">
        <div className="card-body p-4">
          <div className="text-muted">Cargando esquema de caso auxiliar...</div>
        </div>
      </div>
    );
  }

  const kaceOneScriptFormId = externalOneScriptFormId || oneScriptForm;
  const hasFormId = Boolean(kaceOneScriptFormId);

  return (
    <div className={disabledClassName}>
      <Schema
        component={
          hasFormId
            ? {
                ...component,
                one_script_form_id: kaceOneScriptFormId,
                onMountCode: component.onMountCode,
                onChangeCode: component.onChangeCode,
                onSubmitCode: component.onSubmitCode,
              }
            : component
        }
        updateValue={handleUpdateValue}
        onEvent={onEvent}
        offEvent={offEvent}
        root={root}
        globalRoot={resolvedGlobalRoot}
        emit={resolvedEmit}
        setFormInstance={handleSetFormInstance}
        initialData={formData}
        submission={{ data: formData }}
        disabled={disabled}
        readOnly={readOnly}
      />
    </div>
  );
};
