import './DataTable.css';
import '#plugins/kace/shared/styles/kace-disabled.css';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { evaluateKace } from '#plugins/kace/shared/evaluateKace.js';
import Swal from 'sweetalert2';
import { KaceEngine } from '#plugins/kace/KaceEngine.js';
import { formatCellValue } from '#plugins/kace/utils/subcaseColumnFormatters.js';
import {
  BULK_ACTION_SELECT_PLACEHOLDER,
  BULK_ACTION_EXECUTE_LABEL,
  BULK_ACTION_SELECTED_COUNT_SUFFIX,
  BULK_ACTION_FALLBACK_LABEL_PREFIX,
  BULK_ACTION_MODAL_DEFAULT_TITLE,
  BULK_ACTION_MODAL_CONFIRM_LABEL,
  BULK_ACTION_MODAL_CANCEL_LABEL,
  BULK_ACTION_MODAL_LOADING_LABEL,
  BULK_ACTION_CONTEXT_REFRESH_TABLE,
  BULK_ACTION_CONTEXT_CLEAR_SELECTION,
  BULK_ACTION_COMBINED_MODAL_HINT,
  DATA_TABLE_COMBINED_ACTION_ACCENTS,
  DATA_TABLE_COMBINED_ACTION_ACCENT_ROTATION,
} from './lib/data-table.constants.js';
import {
  coerceFormBoolean,
  resolveComponentProp,
} from './lib/data-table-layout.helpers.js';
import { useDataTableBulkActionsResolution } from './model/useDataTableBulkActionsResolution.hook.js';
import { useDataTableColumnLayout } from './model/useDataTableColumnLayout.hook.js';
import { useDataTableColumnResize } from './model/useDataTableColumnResize.hook.js';
import { mergeScriptSelectOptions } from '#plugins/kace/utils/mergeScriptSelectOptions.js';
import { useKaceDisabled } from '#plugins/kace/hooks/useKaceDisabled.hook.js';
import { CASE_EDIT_LOCKED_STORE_KEY } from '#plugins/kace/utils/kaceFormDisabled.js';
import { BulkActionModalSelect } from './BulkActionModalSelect.jsx';
import {
  extractShowWhenVisibilityCode,
  wrapShowWhenForAsyncEvaluation,
} from './lib/bulkActionShowWhen.helpers.js';

/**
 * @typedef Props
 * @prop {{ [x: string]: unknown }} component - `this.component` properties
 * @prop {(value: any, flags: any, source: any) => any} [updateValue] - Function to update `this.value` (formio component instance) value
 * @prop {(event: string, callback: Function) => void} [onEvent] - Callback for component events (e.g. resetForm)
 * @prop {(event: string, callback: Function) => void} [offEvent] - Unsubscribes a listener registered via `onEvent`
 * @prop {boolean} [disabled=false] - Disables interactions when Form.io sets disable
 */

/**
 * DataTable with optional row selection and bulk actions.
 * Optional `component.bulkActionsContextCode` (pestaña Acciones) evalúa qué filas de acciones masivas
 * aplican según grupo/sesión: devuelve `{ bulkActions, disableBulkActions }` o un array. Ver builder.
 * When component.bulkActions is set (from the "Acciones" builder tab), each item has { label, code }
 * and optionally showModalBeforeExecute, modalTitle, modalFields (select/textfield/textarea por campo).
 * The code is run with: selectedRows, selectedCount, data, component, kaceEngine, apiService,
 * modalFormData (if the action uses a modal), Swal, plus:
 * - `refreshTable` — función; vuelve a cargar las filas desde `component.initialData` (misma lógica que al montar). Puede devolver una Promise si el script de datos es async.
 * - `clearSelection` — función; limpia la selección de filas y notifica `onRowSelect` con [] si aplica.
 * El autor del script decide cuándo llamarlas (p. ej. tras un API exitoso). Si la acción falla, no las invoque para no refrescar ni perder la selección.
 *
 * @param {Props} props
 */
export const DataTable = ({
  component,
  onEvent,
  offEvent,
  disabled = false,
}) => {
  const {
    pageSize: initialPageSize = 10,
    pageSizeOptions = [10, 25, 50, 100],
    showCheckbox = false,
    onRowSelect = null,
    tableClassName = '',
    containerClassName = '',
    striped = false,
    hover = true,
    bordered = false,
    small = true,
    emptyMessage = 'No hay datos disponibles',
    selectedItemLabel = '',
  } = component?.config || {};

  const horizontalScroll = coerceFormBoolean(
    resolveComponentProp(component, 'horizontalScroll', true),
    true
  );
  const pinActionsColumn = coerceFormBoolean(
    resolveComponentProp(component, 'pinActionsColumn', false),
    false
  );
  const actionsColumnWidth = resolveComponentProp(
    component,
    'actionsColumnWidth',
    undefined
  );
  const columnResizeEnabled = coerceFormBoolean(
    resolveComponentProp(component, 'columnResizeEnabled', true),
    true
  );
  const combinedBulkActionsModal = coerceFormBoolean(
    resolveComponentProp(component, 'combinedBulkActionsModal', false),
    false
  );
  // DataTable es genérico; el key de bloqueo por edición (si aplica) lo define
  // el consumidor vía builder. Default preserva el comportamiento existente
  // en pantallas de caso (Subcases.jsx).
  const readOnlyLockStoreKey = resolveComponentProp(
    component,
    'readOnlyLockStoreKey',
    CASE_EDIT_LOCKED_STORE_KEY
  );
  const { className: disabledClassName } = useKaceDisabled(disabled, {
    readOnlyStoreKey: readOnlyLockStoreKey,
  });

  /** Ej.: "seleccionado(s)" (default) o "casos seleccionado(s)" si se configura selectedItemLabel */
  const selectedCountLabel = [
    selectedItemLabel,
    BULK_ACTION_SELECTED_COUNT_SUFFIX,
  ]
    .filter(Boolean)
    .join(' ');

  const kaceEngine = useMemo(() => {
    try {
      return KaceEngine() ?? null;
    } catch {
      return null;
    }
  }, []);
  const apiService = useMemo(
    () => (kaceEngine ? (kaceEngine.getService?.('apiService') ?? null) : null),
    [kaceEngine]
  );

  const { resolvedBulkActions, bulkActionsGloballyDisabled } =
    useDataTableBulkActionsResolution(component, kaceEngine, apiService);

  /** @type {{ label: string, code: string, showModalBeforeExecute?: boolean, modalTitle?: string, modalInitCode?: string, modalFields?: { fieldType: string, fieldKey: string, fieldLabel?: string, placeholder?: string, showWhen?: string, options?: { label: string, value: string }[] }[] }[]} */
  const bulkActions = bulkActionsGloballyDisabled ? [] : resolvedBulkActions;
  const effectiveShowCheckbox =
    showCheckbox || (!bulkActionsGloballyDisabled && bulkActions.length > 0);

  // Estados
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [actions, setActions] = useState([]);
  const [selectedBulkActionIndex, setSelectedBulkActionIndex] = useState('');
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [pendingBulkActionIndex, setPendingBulkActionIndex] = useState(null);
  /** Valores del formulario del modal: { [fieldKey]: value } */
  const [modalFormData, setModalFormData] = useState({});
  /** Opciones dinámicas para selects (p. ej. desde modalInitCode/API): { [fieldKey]: [{ label, value }] } */
  const [modalDynamicOptions, setModalDynamicOptions] = useState({});
  const [modalInitLoading, setModalInitLoading] = useState(false);
  /**
   * Cache de resultados de `showWhen` por campo (clave: idPrefix + fieldKey), para no
   * re-ejecutar el script (y sus efectos: fetch + setSelectOptions) en cada render si
   * modalFormData y las opciones dinámicas no cambiaron. Sin esto, un showWhen que llama
   * a una API y guarda el resultado dispara un render → vuelve a evaluarse → vuelve a
   * llamar la API en bucle infinito. Se limpia al abrir cada modal.
   */
  const showWhenCacheRef = useRef(new Map());
  // Cachea la firma por referencia de `formData`: evita re-stringificar el
  // mismo objeto para cada campo del modal y protege contra referencias
  // circulares (poco probable en formData, pero JSON.stringify lanzaría).
  const formDataSignatureCacheRef = useRef(new WeakMap());
  const getFormDataSignature = useCallback((formDataValue) => {
    if (!formDataValue || typeof formDataValue !== 'object') {
      return String(formDataValue);
    }
    const cache = formDataSignatureCacheRef.current;
    if (cache.has(formDataValue)) {
      return cache.get(formDataValue);
    }
    let signature;
    try {
      signature = JSON.stringify(formDataValue);
    } catch {
      signature = `unstringifiable:${Date.now()}`;
    }
    cache.set(formDataValue, signature);
    return signature;
  }, []);

  // Función para ordenar datos
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === bValue) return 0;

      const comparison = aValue < bValue ? -1 : 1;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [data, sortConfig]);

  // Calcular información de paginación
  const totalPages = Math.ceil(data.length / pageSize);
  /**
   * `currentPage` no se reseteaba cuando `data` cambiaba (nueva búsqueda, refresh tras
   * acción masiva, etc.). Si el usuario quedaba en una página > 1 y la nueva data tenía
   * menos páginas, se calculaba un slice fuera de rango y la tabla se veía vacía aunque
   * `data` sí tuviera resultados. Se "clampea" aquí en vez de resetear el estado, así el
   * valor mostrado siempre es válido para la data actual sin necesitar un efecto extra.
   */
  const effectiveCurrentPage =
    totalPages > 0 ? Math.min(currentPage, totalPages) : 1;

  // Calcular datos paginados
  const paginatedData = useMemo(() => {
    const startIndex = (effectiveCurrentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, effectiveCurrentPage, pageSize]);

  const startItem =
    data.length === 0 ? 0 : (effectiveCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(effectiveCurrentPage * pageSize, data.length);

  // Manejadores
  const handleSort = (columnKey) => {
    setSortConfig((prev) => ({
      key: columnKey,
      direction:
        prev.key === columnKey && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      setSelectedRows(new Set()); // Limpiar selección al cambiar de página
    }
  };

  const handlePageSizeChange = (e) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(1);
    setSelectedRows(new Set());
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = paginatedData.map(
        (_, index) => (effectiveCurrentPage - 1) * pageSize + index
      );
      setSelectedRows(new Set(allIds));
    } else {
      setSelectedRows(new Set());
    }

    if (onRowSelect) {
      onRowSelect(e.target.checked ? paginatedData : []);
    }
  };

  const handleSelectRow = (index) => {
    const globalIndex = (effectiveCurrentPage - 1) * pageSize + index;
    const newSelected = new Set(selectedRows);

    if (newSelected.has(globalIndex)) {
      newSelected.delete(globalIndex);
    } else {
      newSelected.add(globalIndex);
    }

    setSelectedRows(newSelected);

    if (onRowSelect) {
      const selectedData = data.filter((_, idx) => newSelected.has(idx));
      onRowSelect(selectedData);
    }
  };

  const handlerClear = () => {
    setSelectedRows(new Set());
    setCurrentPage(1);
    setData([]);
  };

  const isAllSelected =
    paginatedData.length > 0 &&
    paginatedData.every((_, index) =>
      selectedRows.has((effectiveCurrentPage - 1) * pageSize + index)
    );

  /** Array of selected row objects (from sortedData) for bulk actions */
  const selectedRowsData = useMemo(() => {
    return Array.from(selectedRows)
      .map((idx) => sortedData[idx])
      .filter(Boolean);
  }, [selectedRows, sortedData]);

  /** SweetAlert2: import o fallback a global (por si en producción el host expone Swal en window/globalThis) */
  const swalForContext = useMemo(
    () =>
      Swal ??
      (typeof globalThis !== 'undefined' && globalThis.Swal) ??
      (typeof window !== 'undefined' && window.Swal) ??
      undefined,
    []
  );

  /**
   * Recarga las filas desde `component.initialData` (misma lógica que el efecto de montaje).
   * Expuesta al código de acciones masivas como `refreshTable`.
   * @returns {Promise<unknown>} Promise si el script de datos inicial devuelve una Promise.
   */
  const refreshTable = useCallback(() => {
    try {
      if (!component?.initialData_type || !component?.initialData) {
        setData([]);
        return Promise.resolve();
      }

      if (component.initialData_type === 'json') {
        try {
          const parsed = JSON.parse(component.initialData);
          setData(parsed);
        } catch {
          setData([]);
        }
        return Promise.resolve();
      }

      const evaluated = evaluateKace(component.initialData, {
        setData: (newData) => setData(Array.isArray(newData) ? newData : []),
      });
      if (evaluated != null && typeof evaluated.then === 'function') {
        return evaluated;
      }
      return Promise.resolve();
    } catch (err) {
      console.warn('[DataTable] refreshTable:', err?.message ?? err);
      return Promise.resolve();
    }
  }, [component?.initialData_type, component?.initialData]);

  /**
   * Limpia la selección de filas y notifica al padre si hay `onRowSelect`.
   * Expuesta al código de acciones masivas como `clearSelection`.
   */
  const clearSelection = useCallback(() => {
    try {
      setSelectedRows(new Set());
      if (typeof onRowSelect === 'function') {
        onRowSelect([]);
      }
    } catch (err) {
      console.warn('[DataTable] clearSelection:', err?.message ?? err);
    }
  }, [onRowSelect]);

  const runBulkActionWithContext = useCallback(
    (action, modalFormDataPayload) => {
      if (!action?.code) return;
      try {
        evaluateKace(action.code, {
          selectedRows: selectedRowsData,
          selectedCount: selectedRowsData.length,
          data,
          component,
          kaceEngine: kaceEngine ?? undefined,
          apiService: apiService ?? undefined,
          modalFormData: modalFormDataPayload,
          Swal: swalForContext,
          [BULK_ACTION_CONTEXT_REFRESH_TABLE]: refreshTable,
          [BULK_ACTION_CONTEXT_CLEAR_SELECTION]: clearSelection,
        });
      } catch (err) {
        console.error('[DataTable] bulk action error:', err);
      }
    },
    [
      selectedRowsData,
      data,
      component,
      kaceEngine,
      apiService,
      swalForContext,
      refreshTable,
      clearSelection,
    ]
  );

  /** Inicializa modalFormData con valores por defecto según modalFields de la acción */
  const getInitialModalFormData = useCallback((action) => {
    const fields = Array.isArray(action?.modalFields) ? action.modalFields : [];
    const initial = {};
    fields.forEach((f) => {
      if (!f?.fieldKey) return;
      if (f.fieldType === 'checkbox') {
        initial[f.fieldKey] = Boolean(f.defaultValue);
      } else if (
        f.fieldType === 'select' &&
        Array.isArray(f.options) &&
        f.options.length > 0 &&
        !f.noDefaultOption
      ) {
        initial[f.fieldKey] = f.options[0]?.value ?? '';
      } else {
        initial[f.fieldKey] = '';
      }
    });
    return initial;
  }, []);

  /** Ejecuta modalInitCode de la acción y devuelve { selectOptions, initialValues } (o resuelve si es Promise) */
  const runModalInitCode = useCallback(
    async (action) => {
      if (!action?.modalInitCode || typeof action.modalInitCode !== 'string') {
        return {};
      }
      const context = {
        apiService: apiService ?? undefined,
        kaceEngine: kaceEngine ?? undefined,
        selectedRows: selectedRowsData,
        selectedCount: selectedRowsData.length,
        // data,
        // component,
        Swal,
      };
      let result = evaluateKace(action.modalInitCode, context);
      if (result != null && typeof result.then === 'function') {
        result = await result;
      }
      return result && typeof result === 'object' ? result : {};
    },
    [selectedRowsData, data, component, apiService, kaceEngine, Swal]
  );

  const handleExecuteBulkAction = useCallback(() => {
    const index = Number(selectedBulkActionIndex);
    if (Number.isNaN(index) || index < 0 || index >= bulkActions.length) return;
    const action = bulkActions[index];
    if (!action?.code) return;

    const fields = Array.isArray(action.modalFields) ? action.modalFields : [];
    const hasModalFields = fields.length > 0;
    const needsModal = action.showModalBeforeExecute === true && hasModalFields;

    if (needsModal) {
      showWhenCacheRef.current.clear();
      setPendingBulkActionIndex(index);
      setModalDynamicOptions({});
      setModalInitLoading(true);
      (async () => {
        let shouldOpenModal = true;
        try {
          const initial = getInitialModalFormData(action);
          let selectOptions = {};
          let initialValues = {};
          if (action.modalInitCode) {
            const result = await runModalInitCode(action);
            if (result && result.abort === true) {
              shouldOpenModal = false;
              return;
            }
            selectOptions = result?.selectOptions ?? {};
            initialValues = result?.initialValues ?? {};
          }
          const merged = { ...initial, ...initialValues };
          Object.keys(selectOptions).forEach((fk) => {
            const opts = selectOptions[fk];
            const fieldDef = fields.find((f) => f.fieldKey === fk);
            if (
              Array.isArray(opts) &&
              opts.length > 0 &&
              (merged[fk] === undefined || merged[fk] === '') &&
              !fieldDef?.noDefaultOption
            ) {
              merged[fk] = opts[0]?.value ?? '';
            }
          });
          setModalFormData(merged);
          setModalDynamicOptions(selectOptions);
        } catch (err) {
          console.error('[DataTable] modalInitCode error:', err);
          setModalFormData(getInitialModalFormData(action));
        } finally {
          setModalInitLoading(false);
          setPendingBulkActionIndex((prev) => (shouldOpenModal ? prev : null));
          if (shouldOpenModal) {
            setBulkModalOpen(true);
          }
        }
      })();
      return;
    }

    runBulkActionWithContext(action, undefined);
  }, [
    selectedBulkActionIndex,
    bulkActions,
    runBulkActionWithContext,
    getInitialModalFormData,
    runModalInitCode,
  ]);

  const handleBulkModalConfirm = useCallback(() => {
    if (
      pendingBulkActionIndex == null ||
      pendingBulkActionIndex < 0 ||
      pendingBulkActionIndex >= bulkActions.length
    ) {
      setBulkModalOpen(false);
      setPendingBulkActionIndex(null);
      setModalFormData({});
      setModalDynamicOptions({});
      return;
    }
    const action = bulkActions[pendingBulkActionIndex];
    runBulkActionWithContext(action, modalFormData);
    setBulkModalOpen(false);
    setPendingBulkActionIndex(null);
    setModalFormData({});
    setModalDynamicOptions({});
  }, [
    pendingBulkActionIndex,
    bulkActions,
    modalFormData,
    runBulkActionWithContext,
  ]);

  const handleBulkModalClose = useCallback(() => {
    setBulkModalOpen(false);
    setPendingBulkActionIndex(null);
    setModalFormData({});
    setModalDynamicOptions({});
  }, []);

  const setModalFormDataField = useCallback((fieldKey, value) => {
    setModalFormData((prev) => {
      if (prev?.[fieldKey] === value) return prev;
      return { ...prev, [fieldKey]: value };
    });
  }, []);

  const areOptionsEqual = useCallback((left, right) => {
    if (left === right) return true;
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i += 1) {
      const a = left[i] ?? {};
      const b = right[i] ?? {};
      if (a.label !== b.label || a.value !== b.value) return false;
    }
    return true;
  }, []);

  const setSelectOptionsForContext = useCallback(
    (fieldKey, options, opts) => {
      const normalized = Array.isArray(options) ? options : [];
      const append = opts?.append === true;
      setModalDynamicOptions((prev) => {
        const current = prev?.[fieldKey] ?? [];
        const next = append
          ? mergeScriptSelectOptions(current, normalized, true)
          : mergeScriptSelectOptions([], normalized, false);
        if (areOptionsEqual(current, next)) return prev;
        return {
          ...prev,
          [fieldKey]: next,
        };
      });
    },
    [areOptionsEqual]
  );

  /**
   * Renderiza un campo de modal (select/textfield/textarea/checkbox), evaluando su `showWhen`.
   * Compartido por el modal de una sola acción y por el modal combinado (namespaced por acción),
   * por eso formData/dynamicOptions/onFieldChange/onSetSelectOptions se reciben como parámetros.
   */
  const renderModalField = useCallback(
    ({
      field,
      fieldIdx,
      formData,
      dynamicOptions,
      onFieldChange,
      onSetSelectOptions,
      disabled: fieldDisabled,
      idPrefix,
      // El toggle de opciones (displayAs: "toggle") es exclusivo del modal
      // combinado; BulkActionModalSelect (búsqueda + scroll infinito, portado
      // de develop) aplica igual en los dos modos.
      isCombinedModal = false,
    }) => {
      if (!field?.fieldKey) return null;
      let dimmed = false;
      if (
        field.showWhen &&
        typeof field.showWhen === 'string' &&
        field.showWhen.trim()
      ) {
        const cacheKey = `${idPrefix}::${field.fieldKey}`;
        const signature = JSON.stringify({
          formData,
          optionKeys: Object.keys(dynamicOptions || {}),
        });
        const cached = showWhenCacheRef.current.get(cacheKey);
        let show;
        if (cached && cached.signature === signature) {
          show = cached.show;
        } else {
          show = false;
          try {
            // Igual que en develop: para el chequeo de visibilidad se evalúa
            // solo la parte del script DESPUÉS del bloque `if (loadPass) {...}`
            // (si existe) — ese bloque es exclusivo de la carga de opciones,
            // que dispara BulkActionModalSelect vía `evaluateShowWhen`.
            const visibilityCode = extractShowWhenVisibilityCode(
              field.showWhen.trim()
            );
            const showWhenContext = {
              modalFormData: formData,
              kaceEngine: kaceEngine ?? undefined,
              apiService: apiService ?? undefined,
              selectedRows: selectedRowsData,
              selectedCount: selectedRowsData.length,
              data,
              component,
              Swal: swalForContext,
              setSelectOptions: (fieldKey, options, meta) => {
                setTimeout(
                  () => onSetSelectOptions(fieldKey, options, meta),
                  0
                );
              },
              setFieldValue: (fieldKey, value) => {
                setTimeout(() => onFieldChange(fieldKey, value), 0);
              },
              loadPass: false,
              kaceSelectPage: 1,
              kaceRemoteSearchTerm: '',
              kaceSelectPageSize: 20,
            };
            let showResult = evaluateKace(visibilityCode, showWhenContext);
            if (showResult != null && typeof showResult.then === 'function') {
              // Un showWhen que solo tiene la rama loadPass (nada después del
              // bloque) evalúa a una Promise aquí; igual que develop, se toma
              // como visible — BulkActionModalSelect decide con la carga real.
              showResult = true;
            }
            show = Boolean(showResult);
          } catch (err) {
            console.error(
              '[DataTable] showWhen error:',
              field.fieldKey,
              err?.message ?? err
            );
            show = false;
          }
          showWhenCacheRef.current.set(cacheKey, { signature, show });
        }
        if (!show) {
          if (!field.keepVisibleWhenHidden) return null;
          dimmed = true;
        }
      }
      const id = `${idPrefix}-${fieldIdx}`;
      const value =
        formData[field.fieldKey] ??
        (field.fieldType === 'checkbox' ? false : '');
      const effectiveDisabled = fieldDisabled || dimmed;

      /**
       * Puente entre BulkActionModalSelect/useBulkActionModalSelect y el script
       * `showWhen` del campo. Con `loadPassPayload` ausente (chequeo interno del
       * hook antes de abrir) evalúa solo la visibilidad; con `loadPassPayload`
       * presente, envuelve el script completo en un IIFE async (loadPass:true)
       * para que corra la carga real (fetch + setSelectOptions paginado).
       */
      const evaluateShowWhenForField = async (loadPassPayload) => {
        if (!field?.showWhen?.trim()) {
          return loadPassPayload ? undefined : true;
        }
        const isLoadPass = Boolean(loadPassPayload?.loadPass);
        const code = isLoadPass
          ? wrapShowWhenForAsyncEvaluation(field.showWhen.trim())
          : extractShowWhenVisibilityCode(field.showWhen.trim());
        const ctx = {
          modalFormData: formData,
          kaceEngine: kaceEngine ?? undefined,
          apiService: apiService ?? undefined,
          selectedRows: selectedRowsData,
          selectedCount: selectedRowsData.length,
          data,
          component,
          Swal: swalForContext,
          setFieldValue: (fieldKey, fieldValue) =>
            setTimeout(() => onFieldChange(fieldKey, fieldValue), 0),
          loadPass: isLoadPass,
          kaceSelectPage: loadPassPayload?.kaceSelectPage ?? 1,
          kaceRemoteSearchTerm: loadPassPayload?.kaceRemoteSearchTerm ?? '',
          kaceSelectPageSize: loadPassPayload?.kaceSelectPageSize ?? 20,
          setSelectOptions: (fieldKey, options, meta) => {
            if (loadPassPayload?.onSetSelectOptions) {
              loadPassPayload.onSetSelectOptions(options, meta);
              return;
            }
            setTimeout(() => onSetSelectOptions(fieldKey, options, meta), 0);
          },
        };
        let result = evaluateKace(code, ctx);
        if (result != null && typeof result.then === 'function') {
          result = await result;
        }
        return result;
      };
      return (
        <div
          key={fieldIdx}
          className="form-group mb-3"
          style={dimmed ? { opacity: 0.55 } : undefined}
        >
          {field.fieldLabel && field.fieldType !== 'checkbox' && (
            <label className="form-label" htmlFor={id}>
              {field.fieldLabel}
            </label>
          )}
          {field.fieldType === 'select' &&
            (() => {
              const options =
                Array.isArray(dynamicOptions[field.fieldKey]) &&
                dynamicOptions[field.fieldKey].length > 0
                  ? dynamicOptions[field.fieldKey]
                  : Array.isArray(field.options)
                    ? field.options
                    : [];
              if (
                isCombinedModal &&
                field.displayAs === 'toggle' &&
                options.length > 0
              ) {
                return (
                  <div
                    className="btn-group d-flex"
                    role="group"
                    aria-label={field.fieldLabel || field.placeholder}
                  >
                    {options
                      .filter((opt) => opt.value !== '')
                      .map((opt, i) => (
                        <button
                          key={i}
                          type="button"
                          className={`btn btn-sm flex-fill ${
                            value === opt.value
                              ? 'btn-primary'
                              : 'btn-outline-secondary'
                          }`}
                          onClick={() =>
                            onFieldChange(
                              field.fieldKey,
                              value === opt.value ? '' : opt.value
                            )
                          }
                          disabled={effectiveDisabled}
                        >
                          {opt.label ?? opt.value}
                        </button>
                      ))}
                  </div>
                );
              }
              return (
                <BulkActionModalSelect
                  id={id}
                  fieldKey={field.fieldKey}
                  fieldLabel={field.fieldLabel}
                  placeholder={field.placeholder}
                  value={value}
                  options={options}
                  showWhenCode={field.showWhen}
                  evaluateShowWhen={evaluateShowWhenForField}
                  setSelectOptions={onSetSelectOptions}
                  onChange={(nextValue) =>
                    onFieldChange(field.fieldKey, nextValue)
                  }
                  disabled={effectiveDisabled}
                  dependencySignature={getFormDataSignature(formData)}
                  localSearchOnly={field.localSearchOnly === true}
                  readOnlyStoreKey={readOnlyLockStoreKey}
                />
              );
            })()}
          {field.fieldType === 'textfield' && (
            <input
              type="text"
              id={id}
              className="form-control"
              value={value}
              onChange={(e) => onFieldChange(field.fieldKey, e.target.value)}
              placeholder={field.placeholder}
              aria-label={field.fieldLabel || field.placeholder}
              disabled={effectiveDisabled}
            />
          )}
          {field.fieldType === 'textarea' && (
            <textarea
              id={id}
              className="form-control"
              rows={3}
              value={value}
              onChange={(e) => onFieldChange(field.fieldKey, e.target.value)}
              placeholder={field.placeholder}
              aria-label={field.fieldLabel || field.placeholder}
              disabled={effectiveDisabled}
            />
          )}
          {field.fieldType === 'checkbox' && (
            <div
              className={
                field.displayAs === 'switch'
                  ? 'form-check form-switch'
                  : 'form-check'
              }
            >
              <input
                type="checkbox"
                id={id}
                className="form-check-input"
                checked={!!value}
                onChange={(e) =>
                  onFieldChange(field.fieldKey, e.target.checked)
                }
                disabled={effectiveDisabled}
                style={
                  field.displayAs === 'switch' &&
                  field.variant === 'danger' &&
                  value
                    ? {
                        backgroundColor: 'var(--bs-danger, #dc3545)',
                        borderColor: 'var(--bs-danger, #dc3545)',
                      }
                    : undefined
                }
              />
              <label className="form-check-label" htmlFor={id}>
                {field.variant === 'danger' && (
                  <i
                    className="fa fa-exclamation-triangle text-danger me-1"
                    aria-hidden="true"
                  />
                )}
                {field.fieldLabel}
              </label>
            </div>
          )}
        </div>
      );
    },
    [
      kaceEngine,
      apiService,
      selectedRowsData,
      data,
      component,
      swalForContext,
      getFormDataSignature,
      readOnlyLockStoreKey,
    ]
  );

  // --- Modal combinado de acciones masivas (combinedBulkActionsModal) ---
  // Cada bloque de acción tiene un checkbox "Aplicar esta acción" (default
  // apagado, `combinedActionEnabled`): solo se ejecuta el `code` de las
  // acciones marcadas por el usuario al presionar "Ejecutar", para evitar
  // disparar cambios (y llamadas a API) que nadie pidió — antes se corrían
  // las 3 siempre, incluso con campos vacíos o en su valor por defecto.
  const [combinedModalOpen, setCombinedModalOpen] = useState(false);
  const [combinedFormDataByAction, setCombinedFormDataByAction] = useState({});
  const [combinedOptionsByAction, setCombinedOptionsByAction] = useState({});
  const [combinedInitLoadingByAction, setCombinedInitLoadingByAction] =
    useState({});
  const [combinedActionEnabled, setCombinedActionEnabled] = useState({});
  const [combinedExecuting, setCombinedExecuting] = useState(false);

  const closeCombinedModal = useCallback(() => {
    setCombinedModalOpen(false);
    setCombinedFormDataByAction({});
    setCombinedOptionsByAction({});
    setCombinedInitLoadingByAction({});
    setCombinedActionEnabled({});
  }, []);

  const openCombinedModal = useCallback(() => {
    showWhenCacheRef.current.clear();
    setCombinedFormDataByAction({});
    setCombinedOptionsByAction({});
    setCombinedInitLoadingByAction({});
    setCombinedActionEnabled({});
    setCombinedModalOpen(true);

    bulkActions.forEach((action, index) => {
      if (!action) return;
      const initial = getInitialModalFormData(action);
      setCombinedFormDataByAction((prev) => ({
        ...prev,
        [index]: { ...initial, ...(prev[index] || {}) },
      }));
      if (!action.modalInitCode) return;

      setCombinedInitLoadingByAction((prev) => ({ ...prev, [index]: true }));
      runModalInitCode(action)
        .then((result) => {
          if (result?.abort === true) return;
          const selectOptions = result?.selectOptions ?? {};
          const initialValues = result?.initialValues ?? {};
          setCombinedFormDataByAction((prev) => {
            const current = prev[index] || {};
            const merged = { ...initial, ...initialValues };
            // Si un select trae opciones y su valor sigue vacío, lo llenamos con la
            // primera opción cargada (mismo comportamiento que el modal de una sola acción);
            // de lo contrario un <select> controlado con value="" queda visualmente en la
            // primera opción sin que modalFormData refleje ese valor.
            Object.keys(selectOptions).forEach((fk) => {
              const opts = selectOptions[fk];
              const fieldDef = (action.modalFields || []).find(
                (f) => f.fieldKey === fk
              );
              if (
                Array.isArray(opts) &&
                opts.length > 0 &&
                (merged[fk] === undefined || merged[fk] === '') &&
                !fieldDef?.noDefaultOption
              ) {
                merged[fk] = opts[0]?.value ?? '';
              }
            });
            // Preserva ediciones reales del usuario hechas mientras el fetch estaba en curso.
            const finalValues = { ...merged };
            Object.keys(current).forEach((fk) => {
              if (current[fk] !== initial[fk]) {
                finalValues[fk] = current[fk];
              }
            });
            return { ...prev, [index]: finalValues };
          });
          setCombinedOptionsByAction((prev) => ({
            ...prev,
            [index]: selectOptions,
          }));
        })
        .catch((err) => {
          console.error('[DataTable] combined modalInitCode error:', err);
        })
        .finally(() => {
          setCombinedInitLoadingByAction((prev) => ({
            ...prev,
            [index]: false,
          }));
        });
    });
  }, [bulkActions, getInitialModalFormData, runModalInitCode]);

  const setCombinedFieldValue = useCallback((index, fieldKey, value) => {
    setCombinedFormDataByAction((prev) => ({
      ...prev,
      [index]: { ...(prev[index] || {}), [fieldKey]: value },
    }));
  }, []);

  const setCombinedSelectOptions = useCallback(
    (index, fieldKey, options, opts) => {
      const normalized = Array.isArray(options) ? options : [];
      const append = opts?.append === true;
      setCombinedOptionsByAction((prev) => {
        const currentForAction = prev[index] || {};
        const current = currentForAction[fieldKey] ?? [];
        const next = append
          ? mergeScriptSelectOptions(current, normalized, true)
          : mergeScriptSelectOptions([], normalized, false);
        return {
          ...prev,
          [index]: {
            ...currentForAction,
            [fieldKey]: next,
          },
        };
      });
    },
    []
  );

  const handleExecuteCombined = useCallback(async () => {
    if (swalForContext) {
      try {
        const confirmResult = await swalForContext.fire({
          icon: 'warning',
          title: '¿Estás seguro de aplicar estos cambios?',
          text: 'Esta acción puede ser irreversible.',
          showCancelButton: true,
          confirmButtonText: 'Sí, continuar',
          cancelButtonText: 'Cancelar',
        });
        if (!confirmResult?.isConfirmed) return;
      } catch (err) {
        console.error('[DataTable] combined confirm error:', err);
        return;
      }
    }

    setCombinedExecuting(true);
    try {
      for (let index = 0; index < bulkActions.length; index += 1) {
        const action = bulkActions[index];
        if (!action?.code) continue;
        if (!combinedActionEnabled[index]) continue;
        try {
          const result = evaluateKace(action.code, {
            selectedRows: selectedRowsData,
            selectedCount: selectedRowsData.length,
            data,
            component,
            kaceEngine: kaceEngine ?? undefined,
            apiService: apiService ?? undefined,
            modalFormData: combinedFormDataByAction[index] ?? {},
            Swal: swalForContext,
            [BULK_ACTION_CONTEXT_REFRESH_TABLE]: refreshTable,
            [BULK_ACTION_CONTEXT_CLEAR_SELECTION]: clearSelection,
          });
          if (result != null && typeof result.then === 'function') {
            await result;
          }
        } catch (err) {
          console.error('[DataTable] combined bulk action error:', err);
        }
      }
    } finally {
      // Tras correr el lote, los datos y la selección quedan obsoletos (estado
      // cambiado, reasignado o cerrado): se refresca la tabla y se limpia la
      // selección una sola vez, en vez de dejarlo a cada acción individual.
      try {
        await refreshTable();
      } catch (err) {
        console.error('[DataTable] combined refreshTable error:', err);
      }
      clearSelection();
      setCombinedExecuting(false);
      closeCombinedModal();
    }
  }, [
    bulkActions,
    selectedRowsData,
    data,
    component,
    kaceEngine,
    apiService,
    swalForContext,
    refreshTable,
    clearSelection,
    combinedFormDataByAction,
    combinedActionEnabled,
    closeCombinedModal,
  ]);

  // Construir clases de tabla
  const tableClasses = [
    'table',
    hover && 'table-hover',
    striped && 'table-striped',
    bordered && 'table-bordered',
    small && 'table-sm',
    tableClassName,
  ]
    .filter(Boolean)
    .join(' ');

  useLayoutEffect(() => {
    refreshTable();
    return () => {
      setData([]);
    };
  }, [refreshTable, component?.initialData]);

  useEffect(() => {
    // Si no hay datos, limpia el estado y termina
    if (!component?.columns_type || !component?.columns) {
      setColumns([]);
      return;
    }

    if (component.columns_type === 'json') {
      try {
        const parsed = JSON.parse(component.columns);
        setColumns(parsed);
      } catch (err) {
        //ignore
        setColumns([]);
      }
      return;
    }

    // Si es JS, evalúalo o usa tu Evaluator
    evaluateKace(component.columns, {
      setColumns: (newData) =>
        setColumns(Array.isArray(newData) ? newData : []),
    });

    // Cleanup opcional al desmontar
    return () => {
      setColumns([]);
    };
  }, [component?.columns_type, component?.columns, component?.initialData]);

  useEffect(() => {
    // Si no hay datos, limpia el estado y termina
    if (!component?.actions_type || !component?.actions) {
      setActions([]);
      return;
    }

    if (component.actions_type === 'editgrid') {
      setActions(component.actions);
      return;
    }

    // Si es JS, evalúalo o usa tu Evaluator
    evaluateKace(component.actions, {
      setActions: (newData) =>
        setActions(Array.isArray(newData) ? newData : []),
    });

    // Cleanup opcional al desmontar
    return () => {
      setActions([]);
    };
  }, [component?.actions_type, component?.actions]);

  useEffect(() => {
    const onResetForm = () => {
      handlerClear();
    };
    onEvent('resetForm', onResetForm);
    return () => {
      offEvent?.('resetForm', onResetForm);
    };
  }, [onEvent, offEvent]);

  useEffect(() => {
    if (selectedRows.size === 0) {
      setSelectedBulkActionIndex('');
    }
  }, [selectedRows.size]);

  const { columnsWithResize, beginColumnResize, autoFitColumnWidth } =
    useDataTableColumnResize({
      columns,
      enabled: Boolean(columnResizeEnabled) && !disabled,
      effectiveShowCheckbox,
    });

  const columnLayout = useDataTableColumnLayout({
    columns: columnsWithResize,
    effectiveShowCheckbox,
    hasActionsColumn: actions.length > 0,
    actionsColumnWidth,
    pinActionsColumn,
  });

  const scrollWrapClassName = useMemo(() => {
    if (horizontalScroll === false) {
      return 'data-table__scroll-wrap data-table__scroll-wrap--no-scroll';
    }
    return 'data-table__scroll-wrap table-responsive';
  }, [horizontalScroll]);

  const tableClassNames = useMemo(
    () =>
      [
        tableClasses,
        horizontalScroll !== false ? 'data-table__table' : '',
        'data-table__table--compact',
      ]
        .filter(Boolean)
        .join(' '),
    [horizontalScroll, tableClasses]
  );

  return (
    <div className={`card ${containerClassName} ${disabledClassName}`}>
      <div className="card-body">
        {/* Header con info de paginación y controles */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex align-items-center gap-3">
            <div className="d-flex align-items-center gap-2">
              <span className="text-muted small">Items por página:</span>
              <select
                className="form-select form-select-sm"
                style={{ width: 'auto' }}
                value={pageSize}
                onChange={handlePageSizeChange}
                disabled={disabled}
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-muted small">
              {startItem} - {endItem} de {data.length}
            </span>
          </div>

          {/* Controles de paginación */}
          <div className="d-flex gap-1">
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => handlePageChange(1)}
              disabled={disabled || effectiveCurrentPage === 1}
              title="Primera página"
            >
              <i className="fa fa-angle-double-left" aria-hidden="true" />
            </button>
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => handlePageChange(effectiveCurrentPage - 1)}
              disabled={disabled || effectiveCurrentPage === 1}
              title="Página anterior"
            >
              <i className="fa fa-angle-left" aria-hidden="true" />
            </button>
            <span
              className="btn btn-sm btn-outline-secondary"
              style={{ cursor: 'default' }}
            >
              {effectiveCurrentPage} / {totalPages || 1}
            </span>
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => handlePageChange(effectiveCurrentPage + 1)}
              disabled={
                disabled ||
                effectiveCurrentPage === totalPages ||
                totalPages === 0
              }
              title="Página siguiente"
            >
              <i className="fa fa-angle-right" aria-hidden="true" />
            </button>
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => handlePageChange(totalPages)}
              disabled={
                disabled ||
                effectiveCurrentPage === totalPages ||
                totalPages === 0
              }
              title="Última página"
            >
              <i className="fa fa-angle-double-right" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Barra de acciones masivas: visible cuando hay selección y hay acciones configuradas */}
        {bulkActions.length > 0 &&
          selectedRows.size > 0 &&
          (combinedBulkActionsModal ? (
            <div className="data-table__bulk-actions d-flex align-items-center gap-2 mb-3 p-2 bg-light rounded">
              <span className="text-muted small">
                {selectedRows.size} {selectedCountLabel}
              </span>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={openCombinedModal}
                disabled={disabled}
              >
                Gestionar acciones
              </button>
            </div>
          ) : (
            <div className="data-table__bulk-actions d-flex align-items-center mb-3 p-2 bg-light rounded">
              <span className="text-muted small">
                {selectedRows.size} {selectedCountLabel}
              </span>
              <select
                className="form-control form-control-sm"
                style={{ width: 'auto', minWidth: '180px' }}
                value={selectedBulkActionIndex}
                onChange={(e) => setSelectedBulkActionIndex(e.target.value)}
                aria-label="Acción masiva"
                disabled={disabled}
              >
                <option value="">{BULK_ACTION_SELECT_PLACEHOLDER}</option>
                {bulkActions.map((action, idx) => (
                  <option key={idx} value={idx}>
                    {action.label ||
                      `${BULK_ACTION_FALLBACK_LABEL_PREFIX} ${idx + 1}`}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={handleExecuteBulkAction}
                disabled={
                  disabled || selectedBulkActionIndex === '' || modalInitLoading
                }
              >
                {modalInitLoading
                  ? BULK_ACTION_MODAL_LOADING_LABEL
                  : BULK_ACTION_EXECUTE_LABEL}
              </button>
            </div>
          ))}

        {/* Modal combinado: un checkbox por acción configurada; ejecuta en secuencia las marcadas */}
        {combinedBulkActionsModal && combinedModalOpen && (
          <div
            className="data-table__bulk-modal modal fade show d-block"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="data-table-combined-modal-title"
          >
            <div
              className="data-table__bulk-modal-dialog modal-dialog modal-dialog-centered"
              role="document"
            >
              <div className="modal-content">
                <div className="modal-header">
                  <div>
                    <h5
                      className="modal-title"
                      id="data-table-combined-modal-title"
                    >
                      Gestión de acciones masivas
                    </h5>
                    <span className="text-muted small">
                      {selectedRowsData.length} {selectedCountLabel}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="close"
                    aria-label="Cerrar"
                    onClick={closeCombinedModal}
                    disabled={disabled || combinedExecuting}
                  >
                    <span aria-hidden="true">&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <div
                    className="alert alert-info small py-2 mb-3"
                    role="status"
                  >
                    {BULK_ACTION_COMBINED_MODAL_HINT}
                  </div>
                  {bulkActions.map((action, index) => {
                    const formData = combinedFormDataByAction[index] ?? {};
                    const dynamicOptions = combinedOptionsByAction[index] ?? {};
                    const initLoading = !!combinedInitLoadingByAction[index];
                    const isActionEnabled = !!combinedActionEnabled[index];
                    const accentName =
                      action.accentColor ||
                      DATA_TABLE_COMBINED_ACTION_ACCENT_ROTATION[
                        index %
                          DATA_TABLE_COMBINED_ACTION_ACCENT_ROTATION.length
                      ];
                    const accentColorValue =
                      DATA_TABLE_COMBINED_ACTION_ACCENTS[accentName] ||
                      DATA_TABLE_COMBINED_ACTION_ACCENTS.neutral;
                    return (
                      <div
                        key={index}
                        className="data-table__combined-action mb-3 p-2"
                        style={{
                          borderLeft: `4px solid ${accentColorValue}`,
                          backgroundColor: `color-mix(in srgb, ${accentColorValue} 8%, transparent)`,
                          borderRadius: '0.25rem',
                          opacity: isActionEnabled ? 1 : 0.6,
                        }}
                      >
                        <div className="d-flex align-items-center">
                          <div className="form-check mb-0 me-2">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              id={`data-table-combined-modal-enable-${index}`}
                              checked={isActionEnabled}
                              onChange={(e) =>
                                setCombinedActionEnabled((prev) => ({
                                  ...prev,
                                  [index]: e.target.checked,
                                }))
                              }
                              disabled={disabled || combinedExecuting}
                            />
                            <label
                              className="form-check-label fw-bold"
                              htmlFor={`data-table-combined-modal-enable-${index}`}
                            >
                              {action.label ||
                                `${BULK_ACTION_FALLBACK_LABEL_PREFIX} ${index + 1}`}
                            </label>
                          </div>
                          {initLoading && (
                            <span className="text-muted small ms-2">
                              {BULK_ACTION_MODAL_LOADING_LABEL}
                            </span>
                          )}
                        </div>
                        {Array.isArray(action.modalFields) && (
                          <div className="mt-2">
                            {action.modalFields.map((field, fieldIdx) =>
                              renderModalField({
                                field,
                                fieldIdx,
                                formData,
                                dynamicOptions,
                                onFieldChange: (fieldKey, value) =>
                                  setCombinedFieldValue(index, fieldKey, value),
                                onSetSelectOptions: (fieldKey, options, opts) =>
                                  setCombinedSelectOptions(
                                    index,
                                    fieldKey,
                                    options,
                                    opts
                                  ),
                                disabled:
                                  disabled ||
                                  combinedExecuting ||
                                  !isActionEnabled,
                                idPrefix: `data-table-combined-modal-field-${index}`,
                                isCombinedModal: true,
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={closeCombinedModal}
                    disabled={disabled || combinedExecuting}
                  >
                    {BULK_ACTION_MODAL_CANCEL_LABEL}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleExecuteCombined}
                    disabled={
                      disabled ||
                      combinedExecuting ||
                      !Object.values(combinedActionEnabled).some(Boolean)
                    }
                  >
                    {combinedExecuting
                      ? BULK_ACTION_MODAL_LOADING_LABEL
                      : BULK_ACTION_MODAL_CONFIRM_LABEL}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: posición fija y z-index alto para verse en producción */}
        {!combinedBulkActionsModal &&
          bulkModalOpen &&
          pendingBulkActionIndex != null &&
          bulkActions[pendingBulkActionIndex] && (
            <div
              className="data-table__bulk-modal modal fade show d-block"
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="data-table-bulk-modal-title"
            >
              <div
                className="data-table__bulk-modal-dialog modal-dialog modal-dialog-centered"
                role="document"
              >
                <div className="modal-content">
                  <div className="modal-header">
                    <h5
                      className="modal-title"
                      id="data-table-bulk-modal-title"
                    >
                      {bulkActions[pendingBulkActionIndex].modalTitle ||
                        BULK_ACTION_MODAL_DEFAULT_TITLE}
                    </h5>
                    <button
                      type="button"
                      className="close"
                      aria-label="Cerrar"
                      onClick={handleBulkModalClose}
                      disabled={disabled}
                    >
                      <span aria-hidden="true">&times;</span>
                    </button>
                  </div>
                  <div className="modal-body">
                    {Array.isArray(
                      bulkActions[pendingBulkActionIndex].modalFields
                    ) &&
                      bulkActions[pendingBulkActionIndex].modalFields.map(
                        (field, fieldIdx) =>
                          renderModalField({
                            field,
                            fieldIdx,
                            formData: modalFormData,
                            dynamicOptions: modalDynamicOptions,
                            onFieldChange: setModalFormDataField,
                            onSetSelectOptions: setSelectOptionsForContext,
                            disabled,
                            idPrefix: `data-table-bulk-modal-field-${pendingBulkActionIndex}`,
                          })
                      )}
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleBulkModalClose}
                      disabled={disabled}
                    >
                      {BULK_ACTION_MODAL_CANCEL_LABEL}
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleBulkModalConfirm}
                      disabled={disabled}
                    >
                      {BULK_ACTION_MODAL_CONFIRM_LABEL}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* Tabla */}
        <div className={scrollWrapClassName}>
          <table className={tableClassNames}>
            <thead className="table-light">
              <tr>
                {/* Columna de checkbox si está habilitada */}
                {effectiveShowCheckbox && (
                  <th
                    className={`data-table__th-checkbox text-center${
                      columnLayout.checkbox.sticky
                        ? ' data-table__th--sticky data-table__th--sticky-checkbox'
                        : ''
                    }`}
                    style={columnLayout.checkbox.thStyle}
                  >
                    <div className="data-table__th-checkbox-wrap d-flex justify-content-center align-items-center">
                      <input
                        type="checkbox"
                        className="form-check-input data-table__form-check-input--header"
                        checked={isAllSelected}
                        onChange={handleSelectAll}
                        aria-label="Seleccionar todos"
                        disabled={disabled}
                      />
                    </div>
                  </th>
                )}

                {/* Columnas definidas */}
                {columnsWithResize.map((column, index) => (
                  <th
                    key={column.key || index}
                    style={{
                      textAlign: column.align || 'left',
                      cursor: column.sortable ? 'pointer' : 'default',
                      ...columnLayout.dataColumns[index]?.widthStyle,
                      ...columnLayout.dataColumns[index]?.headerStyle,
                    }}
                    className={`${column.className || ''}${
                      columnLayout.dataColumns[index]?.thClassSuffix || ''
                    }${columnResizeEnabled && !disabled ? ' data-table__th--resizable' : ''}`.trim()}
                    onClick={(e) => {
                      if (
                        e.target instanceof Element &&
                        e.target.closest('.data-table__col-resize-handle')
                      ) {
                        return;
                      }
                      if (column.sortable) handleSort(column.key);
                    }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      {column.header}
                      {column.sortable && sortConfig.key === column.key && (
                        <span>
                          {sortConfig.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                    {columnResizeEnabled && !disabled && (
                      <span
                        className="data-table__col-resize-handle"
                        role="separator"
                        aria-orientation="vertical"
                        aria-label="Arrastrar para ancho; doble clic para ajustar al contenido"
                        title="Arrastrar para cambiar ancho. Doble clic: ajustar al contenido"
                        tabIndex={0}
                        onPointerDown={(e) => beginColumnResize(e, index)}
                        onDoubleClick={(e) => autoFitColumnWidth(e, index)}
                      />
                    )}
                  </th>
                ))}

                {/* Columna de acciones si existen */}
                {actions.length > 0 && (
                  <th
                    className={
                      columnLayout.actions.pinRight
                        ? 'data-table__th--sticky data-table__th--sticky-right'
                        : undefined
                    }
                    style={{
                      ...columnLayout.actions.widthStyle,
                      ...columnLayout.actions.headerStyle,
                    }}
                  >
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      columnsWithResize.length +
                      (effectiveShowCheckbox ? 1 : 0) +
                      (actions.length > 0 ? 1 : 0)
                    }
                    className="text-center text-muted py-4"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, rowIndex) => {
                  const globalIndex =
                    (effectiveCurrentPage - 1) * pageSize + rowIndex;
                  const isSelected = selectedRows.has(globalIndex);

                  return (
                    <tr
                      key={rowIndex}
                      className={isSelected ? 'table-active' : ''}
                    >
                      {/* Checkbox */}
                      {effectiveShowCheckbox && (
                        <td
                          className={`data-table__td-checkbox text-center${
                            columnLayout.checkbox.sticky
                              ? ' data-table__td--sticky data-table__td--sticky-checkbox'
                              : ''
                          }`}
                          style={columnLayout.checkbox.tdStyle}
                        >
                          <div className="data-table__td-checkbox-wrap d-flex justify-content-center align-items-center">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={isSelected}
                              onChange={() => handleSelectRow(rowIndex, row)}
                              disabled={disabled}
                            />
                          </div>
                        </td>
                      )}

                      {/* Celdas de datos */}
                      {columnsWithResize.map((column, colIndex) => {
                        let cellContent;
                        if (column.render) {
                          cellContent = column.render(
                            row[column.key],
                            row,
                            rowIndex
                          );
                        } else if (column.formatter) {
                          const formatted = formatCellValue(
                            column.formatter,
                            row[column.key],
                            row
                          );
                          if (
                            formatted &&
                            typeof formatted === 'object' &&
                            'displayText' in formatted &&
                            'fullText' in formatted
                          ) {
                            cellContent = (
                              <span title={formatted.fullText}>
                                {formatted.displayText}
                              </span>
                            );
                          } else {
                            cellContent = formatted;
                          }
                        } else {
                          const raw = row[column.key];
                          // React no renderiza booleanos como texto ({false} y {true} quedan vacíos).
                          cellContent =
                            typeof raw === 'boolean' ? String(raw) : raw;
                        }
                        return (
                          <td
                            key={colIndex}
                            style={{
                              textAlign: column.align || 'left',
                              ...columnLayout.dataColumns[colIndex]?.widthStyle,
                              ...columnLayout.dataColumns[colIndex]?.cellStyle,
                            }}
                            className={`${column.className || ''}${
                              columnLayout.dataColumns[colIndex]?.pinLeft
                                ? ' data-table__td--sticky'
                                : ''
                            }`.trim()}
                          >
                            {cellContent}
                          </td>
                        );
                      })}

                      {/* Acciones */}
                      {actions.length > 0 && (
                        <td
                          className={
                            columnLayout.actions.pinRight
                              ? 'data-table__td--sticky data-table__td--sticky-right'
                              : undefined
                          }
                          style={{
                            ...columnLayout.actions.widthStyle,
                            ...columnLayout.actions.cellStyle,
                          }}
                        >
                          <div className="d-flex gap-1">
                            {actions.map((action, actionIndex) => (
                              <button
                                key={actionIndex}
                                className={
                                  action.className || 'btn btn-sm btn-primary'
                                }
                                onClick={() => {
                                  evaluateKace(action.onClick, {
                                    row,
                                    rowIndex,
                                  });
                                }}
                                title={action.title}
                                disabled={
                                  disabled ||
                                  (action.disabled && action.disabled(row))
                                }
                              >
                                {action.icon ? (
                                  <i
                                    className={action.icon}
                                    aria-hidden="true"
                                  />
                                ) : (
                                  action.label
                                )}
                              </button>
                            ))}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
