import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KaceEngine } from '#plugins/kace/KaceEngine.js';
import {
  buildAuxSearchParams,
  deriveAuxColumns,
  getAuxAliasesFromColumns,
  normalizeAuxItems,
} from '#plugins/kace/components/subcases/lib/subcaseListAux.helpers.js';
import { getFormatterType } from '#plugins/kace/utils/subcaseColumnFormatters.js';
import { useAllowedSubcaseClassifications } from '#plugins/kace/hooks/useAllowedSubcaseClassifications.js';
import { runInFlight } from '#plugins/kace/utils/runInFlight.js';

const EDIT_HANDLER_PREFIX = '__kaceSubcaseEdit';
const VIEW_HANDLER_PREFIX = '__kaceSubcaseView';
const DEFAULT_PAGE_SIZE = 100;
/** Colapsa 2+ cambios de `listAutoLoadKey` en pocos ms (API de clasificaciones + opciones del Form.io) en un solo POST. */
const SUBCASE_LIST_AUTOLOAD_DEBOUNCE_MS = 48;

/**
 * Convierte tableColumns del form (editgrid) a formato DataTable: { key, header, formatter? }.
 * @param {Array<{ key?: string, label?: string }>} tableColumns
 * @returns {Array<{ key: string, header: string, formatter?: string }>}
 */
function deriveColumns(tableColumns) {
  if (!Array.isArray(tableColumns) || tableColumns.length === 0) {
    return [];
  }
  return tableColumns
    .filter((c) => c && (c.key != null || c.label != null))
    .map((c) => {
      const key = c.key != null ? String(c.key) : '';
      const header =
        c.label != null ? String(c.label) : c.key != null ? String(c.key) : '';
      const formatter = getFormatterType(key) || undefined;
      return { key, header, ...(formatter && { formatter }) };
    })
    .filter((c) => c.key !== '');
}

/**
 * Hook para la lista de subcasos: fetch, estado y configuración de la tabla.
 * @param {{ tableColumns?: Array<{ key?: string, label?: string }>, auxColumns?: Array<{ selectExpression?: string, alias?: string, label?: string }>, dataSourceValues?: Array<{ label: string, value: string }>, data?: { values?: Array<{ label: string, value: string }> } }} component - Formio component config (tableColumns, auxColumns; clasificación: dataSourceValues o data.values)
 * @param {{ onEditSubcase?: (rowOrId: any) => void, onViewSubcase?: (rowOrId: any) => void }} [options] - Callbacks al pulsar Editar/Ver; reciben la fila o el ID.
 * @returns {{
 *   items: any[],
 *   isListLoading: boolean,
 *   listError: string | null,
 *   refreshList: (opts?: { force?: boolean }) => Promise<void>,
 *   tableComponent: object,
 *   isEditingParentCase: boolean,
 *   setListFetchMountNode: (node: Element | null) => void,
 * }}
 */
export function useSubcaseList(component, options = {}) {
  const { onEditSubcase, onViewSubcase } = options;
  const lazyListUntilVisible = component?.lazySubcaseListUntilVisible !== false;
  const { editHandlerKey, viewHandlerKey } = useMemo(() => {
    const instanceSuffix = component?.key ?? component?.id ?? '';
    return {
      editHandlerKey: `${EDIT_HANDLER_PREFIX}_${instanceSuffix}`,
      viewHandlerKey: `${VIEW_HANDLER_PREFIX}_${instanceSuffix}`,
    };
  }, [component?.key, component?.id]);
  const [items, setItems] = useState([]);
  const [isListLoading, setIsListLoading] = useState(false);
  const [listError, setListError] = useState(null);
  const [parentId, setParentId] = useState(null);
  const [listContainerVisible, setListContainerVisible] = useState(
    () => !lazyListUntilVisible
  );
  const listContainerVisibleRef = useRef(listContainerVisible);
  listContainerVisibleRef.current = listContainerVisible;
  const disconnectListIoRef = useRef(null);

  const kace = useMemo(() => KaceEngine(), []);
  const storeService = useMemo(
    () => kace?.getService('storeService') ?? null,
    [kace]
  );
  const caseService = useMemo(() => kace?.getService('cases') ?? null, [kace]);

  const { allowedClassificationIds, isLoading: allowedClassificationsLoading } =
    useAllowedSubcaseClassifications();

  /** IDs que se muestran en el dropdown: opciones del component filtradas por permitidos (mismo criterio que useSubcases). */
  const classificationIdsToFilter = useMemo(() => {
    const fromDatagrid = Array.isArray(component?.dataSourceValues)
      ? component.dataSourceValues
      : [];
    const fromSelect = Array.isArray(component?.data?.values)
      ? component.data.values
      : [];
    const raw = fromDatagrid.length > 0 ? fromDatagrid : fromSelect;
    if (
      !Array.isArray(allowedClassificationIds) ||
      allowedClassificationIds.length === 0
    ) {
      return [];
    }
    const allowedSet = new Set(
      allowedClassificationIds.map((id) => String(id))
    );
    return raw
      .filter((opt) => opt && allowedSet.has(String(opt.value)))
      .map((opt) => opt.value);
  }, [
    component?.dataSourceValues,
    component?.data?.values,
    allowedClassificationIds,
  ]);

  const getParentId = useCallback(() => {
    if (!storeService) return null;
    const parentCaseData =
      storeService.get('case.case_data') ??
      storeService.get('cases.case_data') ??
      {};
    const parentCase = parentCaseData?.case ?? parentCaseData;
    return (
      storeService.get('cases.case_id') ??
      parentCaseData?.id ??
      parentCase?.id ??
      null
    );
  }, [storeService]);

  /** Filtro de clasificaciones (contenido estable; evita re-disparos por nuevas instancias de array). */
  const classFilterListContentKey = useMemo(
    () =>
      JSON.stringify([...(classificationIdsToFilter ?? [])].map(String).sort()),
    // Deps por valor, no referencia
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify([...(classificationIdsToFilter ?? [])].map(String).sort())]
  );
  const auxColumnsSearchKey = useMemo(
    () =>
      JSON.stringify(
        (component?.auxColumns ?? []).map((c) => [
          c?.selectExpression,
          c?.alias,
        ])
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      JSON.stringify(
        (component?.auxColumns ?? []).map((c) => [
          c?.selectExpression,
          c?.alias,
        ])
      ),
    ]
  );

  /** Misma lógica que se usa al pedir al API, serializada; solo cambia con datos reales, no con referencias. */
  const listAutoLoadKey = useMemo(() => {
    const currentParentId = getParentId();
    const { relationship, select } = buildAuxSearchParams(
      component?.auxColumns
    );
    return [
      String(currentParentId ?? ''),
      classFilterListContentKey,
      relationship ? '1' : '0',
      (Array.isArray(select) ? select : []).join('|'),
    ].join('::');
    // getParentId es estable; la reactividad viene del store (re-render) y de las claves de contenido.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- claves de contenido explícitas
  }, [
    getParentId,
    classFilterListContentKey,
    auxColumnsSearchKey,
    storeService,
  ]);

  const classificationFilterRef = useRef(classificationIdsToFilter);
  const auxColumnsRef = useRef(component?.auxColumns);
  classificationFilterRef.current = classificationIdsToFilter;
  auxColumnsRef.current = component?.auxColumns;

  const refreshList = useCallback(
    async (opts = {}) => {
      const force = opts.force === true;
      if (allowedClassificationsLoading && !force) {
        return;
      }
      if (!force && lazyListUntilVisible && !listContainerVisibleRef.current) {
        return;
      }
      if (!caseService || !storeService) return;
      const currentParentId = getParentId();
      setParentId(currentParentId);
      if (!currentParentId) {
        setItems([]);
        setListError(null);
        return;
      }
      const { relationship, select } = buildAuxSearchParams(
        auxColumnsRef.current
      );
      const classFilter = classificationFilterRef.current;
      const inFlightKey = `kace:subcaseListFetch:${String(currentParentId)}::${classFilterListContentKey}::${relationship ? '1' : '0'}::${(Array.isArray(select) ? select : []).join('|')}`;

      const doFetch = async () => {
        setListError(null);
        setIsListLoading(true);
        try {
          const auxAliases = getAuxAliasesFromColumns(auxColumnsRef.current);
          const { items: nextItems } = await caseService.fetchSubcases({
            parentId: currentParentId,
            page: 1,
            pageSize: DEFAULT_PAGE_SIZE,
            classificationIds:
              Array.isArray(classFilter) && classFilter.length > 0
                ? classFilter
                : undefined,
            relationship,
            select,
            forceRefresh: force,
          });
          const rawItems = Array.isArray(nextItems) ? nextItems : [];
          const normalizedItems = normalizeAuxItems(rawItems, auxAliases);
          setItems(normalizedItems);
        } catch (err) {
          setListError(err?.message ?? String(err));
          setItems([]);
        } finally {
          setIsListLoading(false);
        }
      };

      if (force) {
        return doFetch();
      }
      return runInFlight(inFlightKey, doFetch);
    },
    [
      caseService,
      storeService,
      getParentId,
      allowedClassificationsLoading,
      classFilterListContentKey,
      lazyListUntilVisible,
    ]
  );

  const setListFetchMountNode = useCallback(
    (node) => {
      disconnectListIoRef.current?.();
      disconnectListIoRef.current = null;
      if (!lazyListUntilVisible) {
        setListContainerVisible(true);
        return;
      }
      if (typeof IntersectionObserver === 'undefined') {
        setListContainerVisible(true);
        return;
      }
      if (!node) {
        return;
      }
      const io = new IntersectionObserver(
        (entries) => {
          const hit = entries.some((e) => e.isIntersecting);
          if (hit) {
            setListContainerVisible(true);
          }
        },
        { root: null, rootMargin: '0px', threshold: 0.01 }
      );
      io.observe(node);
      disconnectListIoRef.current = () => io.disconnect();
    },
    [lazyListUntilVisible]
  );

  const refreshListRef = useRef(refreshList);
  refreshListRef.current = refreshList;

  // Sincronizar parentId con el store al montar (evitar flash de mensaje al editar)
  useEffect(() => {
    setParentId(getParentId());
  }, [getParentId]);

  useEffect(() => {
    if (allowedClassificationsLoading) {
      return;
    }
    if (lazyListUntilVisible && !listContainerVisible) {
      return;
    }
    const handle = setTimeout(() => {
      void refreshListRef.current();
    }, SUBCASE_LIST_AUTOLOAD_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [
    listAutoLoadKey,
    allowedClassificationsLoading,
    lazyListUntilVisible,
    listContainerVisible,
  ]);

  const handleEditSubcase = useCallback(
    (rowOrId) => {
      const caseId =
        typeof rowOrId === 'object' && rowOrId != null
          ? (rowOrId?.id ?? rowOrId?.case_id)
          : rowOrId;
      if (caseId == null) return;
      onEditSubcase?.(rowOrId);
    },
    [onEditSubcase]
  );

  const handleViewSubcase = useCallback(
    (rowOrId) => {
      const caseId =
        typeof rowOrId === 'object' && rowOrId != null
          ? (rowOrId?.id ?? rowOrId?.case_id)
          : rowOrId;
      if (caseId == null) return;
      onViewSubcase?.(rowOrId);
    },
    [onViewSubcase]
  );

  useEffect(() => {
    window[editHandlerKey] = handleEditSubcase;
    return () => {
      delete window[editHandlerKey];
    };
  }, [handleEditSubcase, editHandlerKey]);

  useEffect(() => {
    window[viewHandlerKey] = handleViewSubcase;
    return () => {
      delete window[viewHandlerKey];
    };
  }, [handleViewSubcase, viewHandlerKey]);

  const standardColumns = useMemo(
    () => deriveColumns(component?.tableColumns ?? []),
    [component?.tableColumns]
  );

  const auxDerivedColumns = useMemo(
    () => deriveAuxColumns(component?.auxColumns ?? [], getFormatterType),
    [component?.auxColumns]
  );

  const derivedColumns = useMemo(
    () => [...standardColumns, ...auxDerivedColumns],
    [standardColumns, auxDerivedColumns]
  );

  const viewAction = useMemo(
    () => ({
      className: 'btn btn-sm btn-outline-secondary',
      title: 'Ver',
      icon: 'fa fa-eye',
      onClick: `window[${JSON.stringify(viewHandlerKey)}] && window[${JSON.stringify(viewHandlerKey)}](row)`,
    }),
    [viewHandlerKey]
  );

  const editAction = useMemo(
    () => ({
      className: 'btn btn-sm btn-outline-primary',
      title: 'Editar',
      icon: 'fa fa-edit',
      onClick: `window[${JSON.stringify(editHandlerKey)}] && window[${JSON.stringify(editHandlerKey)}](row)`,
    }),
    [editHandlerKey]
  );

  const tableComponent = useMemo(
    () => ({
      config: {
        pageSize: 10,
        pageSizeOptions: [10, 25, 50],
        emptyMessage: 'No hay subcasos disponibles',
      },
      columns_type: 'json',
      columns: JSON.stringify(derivedColumns),
      actions_type: 'editgrid',
      actions: [viewAction, editAction],
      initialData_type: 'json',
      initialData: JSON.stringify(items),
    }),
    [derivedColumns, viewAction, editAction, items]
  );

  return {
    items,
    isListLoading,
    listError,
    refreshList,
    tableComponent,
    /** true cuando hay un caso padre en contexto (editando un caso existente) */
    isEditingParentCase: parentId != null,
    /** Ref callback: colocar en el contenedor del bloque de edición para diferir el fetch hasta que sea visible. */
    setListFetchMountNode,
  };
}
