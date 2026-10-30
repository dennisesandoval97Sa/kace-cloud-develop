import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import { toast } from "sonner";
import { genericSearchService } from "@/services/genericSearchService";
import { normalizeAppliedTableDateFilters } from "@/utils/src/utils/normalizeAppliedTableDateFilters";
import { useDataTableColumns } from "@/hooks/useDataTableColumns";
import { useFilterTableHandler } from "./useFilterTableHandler";
import useUserInformation from "./useUserInformation";
import { TableCell, TableRow } from "@/components/ui-shared";
import CellClassificationRow from "@/componentsV2/core/TableCellContent/components/CellClassificationRow";
import {
    getRowExpandableClassificationLevels,
    shouldExpandClassificationLevels,
} from "@/pages/Cases/components/CaseDataTable/utils/classificationLevels.util";
import {
    getCasesHeaderNamespace,
    getSchemaFilter,
    isBooleanSchemaType,
    SPECIAL_FIELDS,
} from "@/services/createSchemaFilter";
import useSchemaFields from "@/hooks/useSchemaFields";
import { SortableHeader } from "@/components/ui-shared/src/components/table-component/SortableHeader";
import { removeSavedUserFilter, FILTER_SCOPES } from "@/components/ui-shared/src/components/table-component/helpers";
import { getSynchronizedBaseFilters, getTableFiltersKey } from "./dataTableFilterSync";
import usePersistentSnapshot from "@kace_v2/shared/hooks/usePersistentSnapshot.hook";

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 75, 100];
const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

const isFilterDescriptor = (value) =>
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.field === "string" &&
    typeof value.operator === "string" &&
    typeof value.type === "string";

const normalizeBooleanStateValue = (value) => {
    const normalizedValue = String(value).toLowerCase();
    if (["true", "1", "t"].includes(normalizedValue)) return "true";
    if (["false", "0", "f"].includes(normalizedValue)) return "false";
    return value;
};

const normalizeSavedFilterValues = (savedFilter = {}, schema = []) =>
    Object.fromEntries(
        Object.entries(savedFilter).flatMap(([columnName, value]) => {
            if (isFilterDescriptor(value)) return [[columnName, value]];

            const fieldSchema = schema.find((field) => field.column_name === columnName);
            if (!fieldSchema?.filterData) return [];

            const descriptor = {
                ...fieldSchema.filterData,
                value,
            };

            if (fieldSchema.data_type === SPECIAL_FIELDS.switch_state) {
                if (isBooleanSchemaType(fieldSchema.field_type, fieldSchema.schema_column_type)) {
                    descriptor.operator = "eq";
                    descriptor.value = normalizeBooleanStateValue(value);
                } else if ([0, "0", false, "false"].includes(value)) {
                    descriptor.operator = "neq";
                    descriptor.value = 1;
                } else if ([1, "1", true, "true"].includes(value)) {
                    descriptor.operator = "eq";
                    descriptor.value = 1;
                }
            }

            return [[columnName, descriptor]];
        }),
    );

const toSafeNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

export const STEP_JUMP_SIZE = 10;

export const resolvePageIndex = (page, { currentPage, totalPages }) => {
    const pageNumber = toSafeNumber(page, currentPage);
    const clampedPage = Math.min(Math.max(pageNumber, 1), totalPages);
    return clampedPage - 1;
};

export const createStepJumpHandlers = ({ goToPage, currentPage }) => ({
    jumpForward: () => goToPage(currentPage + STEP_JUMP_SIZE),
    jumpBackward: () => goToPage(currentPage - STEP_JUMP_SIZE),
});

const useDataTable = ({
    dataTableConfig,
    actions = [],
    processFilters = null,
    processColumns = null,
    includeColumns = null,
    processData = null,
    processSchema = null,
    headersTransform = null,
    tableFilters = null,
    relationship = null,
    userQueryView = true,
    transformFiltersBeforeQuery = null,
    getRowEnhancer = null,
    getRowStyle = null,
    refetchInterval = false,
}) => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const location = useLocation();
    const urlFilter = location.state?.filter;
    const { getSchemaField } = useSchemaFields();

    const { user } = useUserInformation();

    const {
        key: dataTableKey,
        url: dataTableUrl,
        view: dataTableView,
        entity,
        persist: persistEnabled = true,
        persistKey,
    } = dataTableConfig;

    /*
     * `key` no es unica entre tablas (p. ej. Acciones y Definiciones de
     * Auxiliares comparten la misma), asi que la vista entra en el namespace
     * para que dos tablas distintas no se pisen el snapshot. `persistKey` sigue
     * siendo la via de escape explicita cuando ni key ni view distinguen.
     */
    const persistNamespace = `datatable:${persistKey ?? `${dataTableKey}:${dataTableView ?? entity ?? "default"}`}`;

    /*
     * Un unico snapshot por tabla en lugar de una clave por campo: una sola
     * lectura para sembrar todos los useState y un solo escritor con debounce.
     */
    const {
        initial: persistedState,
        lateRestored,
        dismissLateRestored,
        save: savePersistedState,
        reset: resetPersistedState,
    } = usePersistentSnapshot(persistNamespace, {
        enabled: persistEnabled,
        sanitize: (snapshot) => (snapshot && typeof snapshot === "object" ? snapshot : undefined),
    });

    /*
     * Un drill-in explicito (location.state.filter, las tarjetas del Dashboard)
     * manda sobre lo persistido: el usuario pidio ver ese recorte concreto, no
     * el que dejo abierto la ultima vez. Se decide aqui, en el sembrado, y no en
     * el efecto de mas abajo, porque el drill-in llega siempre en el montaje,
     * que es justo la pasada que la guarda de montaje se salta.
     */
    const restoredState = urlFilter ? EMPTY_OBJECT : persistedState;

    const schema = useMemo(() => getSchemaField(entity), [entity]);

    const columnsResult = useDataTableColumns({
        dataTableConfig,
        rawSchema: schema,
        actions,
        processColumns,
        includeColumns,
        headersTransform,
        processSchema,
    });
    const { columns, processedColumns } = columnsResult;
    const processedFilterColumns = columnsResult.processedFilterColumns ?? processedColumns;

    const { promptConfirmation, createNewFilter } = useFilterTableHandler();

    const postFilters = processFilters ? processFilters([]) : [];
    /*
     * The advanced-filter schema's `.header` (rendered by DataTableFilters) must match the same
     * Cases-specific copy the grid columns show (useDataTableColumns already resolves via
     * getCasesHeaderNamespace), otherwise /cases shows generic column labels in the filter panel.
     */
    const filteredSchema = getSchemaFilter(
        processedFilterColumns,
        postFilters,
        [],
        getCasesHeaderNamespace(dataTableConfig),
    );

    const [pageIndex, setPageIndex] = useState(() => restoredState.pageIndex ?? 0);
    const [pageSize, setPageSize] = useState(() => persistedState.pageSize ?? DEFAULT_PAGE_SIZE);
    const [sortConfig, setSortConfig] = useState(() => persistedState.sortConfig ?? { field: null, direction: "asc" });

    const tableFiltersKey = useMemo(() => getTableFiltersKey(tableFilters), [tableFilters]);
    const tableFiltersRef = useRef(tableFilters);

    useEffect(() => {
        tableFiltersRef.current = tableFilters;
    }, [tableFilters, tableFiltersKey]);

    const [baseFilters, setBaseFilters] = useState(getSynchronizedBaseFilters({ urlFilter, tableFilters }));
    /*
     * `currentFiltersValues` y `userFilters` NO son lo mismo y no se puede
     * derivar uno del otro: `onFilterSelect` prellena el primero al elegir un
     * filtro guardado sin ejecutarlo, y solo `handleApplyFilters` mueve el
     * segundo. Derivarlo convertia en aplicado, tras recargar, un preset que el
     * usuario solo habia abierto para mirarlo. Se persisten los dos por separado.
     */
    const [userFilters, setUserFilters] = useState(() => restoredState.appliedFilters ?? EMPTY_ARRAY);

    const combinedFilters = useMemo(() => {
        return [...(baseFilters || []), ...(userFilters || [])];
    }, [baseFilters, userFilters]);

    const [expanded, setExpanded] = useState({});
    const [openNewFilterModal, setOpenNewFilterModal] = useState(false);
    const [savedFilterList, setSavedFilterList] = useState([]);
    const [currentFiltersValues, setCurrentFiltersValues] = useState(
        () => restoredState.currentFiltersValues ?? EMPTY_OBJECT,
    );
    const [selectedFilter, setSelectedFilter] = useState(() => restoredState.selectedFilter ?? "");

    useEffect(() => {
        setExpanded({});
    }, [pageIndex, pageSize]);

    const initialFilters = useMemo(
        () => (combinedFilters?.length ? combinedFilters : tableFilters),
        [combinedFilters, tableFilters],
    );

    const transformedFilters = useMemo(() => {
        if (!transformFiltersBeforeQuery) {
            return initialFilters;
        }
        return transformFiltersBeforeQuery(initialFilters ?? []);
    }, [initialFilters, transformFiltersBeforeQuery]);

    const handleSort = useCallback(
        (field) => {
            dismissLateRestored();
            setSortConfig((prev) => ({
                field,
                direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc",
            }));
            setPageIndex(0);
        },
        [dismissLateRestored],
    );

    const { data, isFetching, isLoading, isError, refetch } = useQuery({
        queryKey: [dataTableKey, pageIndex, pageSize, transformedFilters, sortConfig],
        queryFn: async () => {
            const orderToUse = sortConfig.field
                ? { field: sortConfig.field, direction: sortConfig.direction }
                : (dataTableConfig.order ?? null);
            const response = await genericSearchService(
                dataTableConfig.forceUrl ? dataTableUrl : `${dataTableUrl}/search`,
                transformedFilters ?? [],
                { limit: pageSize, offset: pageIndex * pageSize },
                userQueryView ? dataTableView : null,
                dataTableConfig.useDefaultFilters ?? true,
                relationship ?? null,
                orderToUse,
            );

            return {
                data: processData ? await processData(response.data) : response.data,
                count: toSafeNumber(response.total?.count ?? response.total),
                metadata: response.metadata ?? {},
            };
        },
        placeholderData: (previousData) => previousData,
        refetchInterval,
        refetchIntervalInBackground: !!refetchInterval,
    });

    const removeQueries = useCallback(() => {
        queryClient.removeQueries({ queryKey: [dataTableKey] });
    }, [queryClient, dataTableKey]);

    /*
     * `urlFilter` es location.state?.filter, indefinido en navegacion normal:
     * sin la guarda de montaje este efecto reseteaba en cada montaje y anulaba
     * en silencio cualquier estado restaurado. Un drill-in explicito (con
     * location.state.filter) si debe ganar sobre lo persistido.
     */
    const didMountResetRef = useRef(false);
    useEffect(() => {
        queryClient.invalidateQueries({ queryKey: [dataTableKey] });
        if (!didMountResetRef.current) {
            didMountResetRef.current = true;
            /*
             * El estado de filtrado ya se sembro vacio para el drill-in, pero el
             * snapshot viejo sigue en storage: hay que purgarlo aqui por si el
             * usuario se va antes de que el guardado con debounce lo reescriba.
             */
            if (urlFilter) resetPersistedState();
            return;
        }
        setPageIndex(0);
        setBaseFilters(getSynchronizedBaseFilters({ urlFilter, tableFilters: tableFiltersRef.current }));
        setSelectedFilter("");
        if (urlFilter) {
            // Tarjeta A -> tarjeta B del Dashboard: cambia el drill-in sin desmontar.
            setUserFilters(EMPTY_ARRAY);
            setCurrentFiltersValues(EMPTY_OBJECT);
            resetPersistedState();
        }
    }, [urlFilter, tableFiltersKey, queryClient, dataTableKey, resetPersistedState]);

    useEffect(() => {
        return () => removeQueries();
    }, [removeQueries]);

    useEffect(() => {
        const admin = user?.filters?.application?.admin ?? {};
        setSavedFilterList(dataTableView in admin ? Object.keys(admin[dataTableView]) : []);
    }, [user, dataTableView]);

    /*
     * Un filtro guardado puede haberse borrado o renombrado desde otro
     * dispositivo: se pierde la etiqueta, pero el filtro aplicado sigue siendo
     * valido, asi que solo se limpia `selectedFilter`.
     */
    useEffect(() => {
        /*
         * `useUserInformation` devuelve `{}` mientras la cache no esta poblada,
         * que es truthy: hay que mirar el id para saber si el scope esta resuelto.
         */
        if (!selectedFilter || !user?.id) return;
        const admin = user?.filters?.application?.admin ?? {};
        const savedForView = admin[dataTableView] ? Object.keys(admin[dataTableView]) : [];
        if (savedForView.includes(selectedFilter)) return;
        setSelectedFilter("");
    }, [user, dataTableView, selectedFilter]);

    const tableData = useMemo(() => {
        const raw = data?.data ?? EMPTY_ARRAY;
        if (!getRowEnhancer) return raw;
        return raw.map((row, i) => ({ ...row, ...getRowEnhancer(row, i) }));
    }, [data, getRowEnhancer]);

    const [columnVisibility, setColumnVisibility] = useState(() => persistedState.columnVisibility ?? EMPTY_OBJECT);

    /*
     * Arranque en frio: el snapshot no pudo leerse en el sembrado porque aun no
     * habia usuario, y llega tarde. Cualquier accion del usuario en esa ventana
     * cancela la restauracion (ver dismissLateRestored en los handlers), asi que
     * este efecto nunca pisa algo que se haya tocado a mano. El drill-in queda
     * excluido por la misma razon que en el sembrado.
     */
    useEffect(() => {
        if (!lateRestored || urlFilter) return;
        setPageIndex(lateRestored.pageIndex ?? 0);
        setPageSize(lateRestored.pageSize ?? DEFAULT_PAGE_SIZE);
        setSortConfig(lateRestored.sortConfig ?? { field: null, direction: "asc" });
        setCurrentFiltersValues(lateRestored.currentFiltersValues ?? EMPTY_OBJECT);
        setUserFilters(lateRestored.appliedFilters ?? EMPTY_ARRAY);
        setSelectedFilter(lateRestored.selectedFilter ?? "");
        setColumnVisibility(lateRestored.columnVisibility ?? EMPTY_OBJECT);
    }, [lateRestored, urlFilter]);

    useEffect(() => {
        if (!persistEnabled) return;
        savePersistedState({
            pageIndex,
            pageSize,
            sortConfig,
            // Lo que ve el modal: puede estar solo prellenado por onFilterSelect.
            currentFiltersValues,
            // Lo que ejecuta la consulta: solo lo mueve handleApplyFilters.
            appliedFilters: userFilters,
            selectedFilter,
            columnVisibility,
        });
    }, [
        persistEnabled,
        savePersistedState,
        pageIndex,
        pageSize,
        sortConfig,
        currentFiltersValues,
        userFilters,
        selectedFilter,
        columnVisibility,
    ]);

    const classificationExpandColumn = useMemo(() => {
        const expandColumn = columns.find((col) =>
            shouldExpandClassificationLevels({
                column_name: col.accessorKey,
                cell_type: col.cellType,
                expand_levels: col.expandLevels,
                separator: col.separator,
            }),
        );

        if (!expandColumn) {
            return null;
        }

        return {
            column_name: expandColumn.accessorKey,
            cell_type: expandColumn.cellType,
            expand_levels: expandColumn.expandLevels,
            separator: expandColumn.separator,
        };
    }, [columns]);

    const table = useReactTable({
        data: tableData,
        columns,
        state: { expanded, columnVisibility },
        manualPagination: true,
        getCoreRowModel: getCoreRowModel(),
        getRowCanExpand: (row) => {
            const hasSubcases = row.original.hasSubcases === true;
            if (classificationExpandColumn) {
                const filteredChildren = getRowExpandableClassificationLevels(row.original, classificationExpandColumn);
                return filteredChildren.length > 0 || hasSubcases;
            }
            const hasChildren = row.original.children?.length > 0;
            return hasChildren || hasSubcases;
        },
        onExpandedChange: setExpanded,
        onColumnVisibilityChange: setColumnVisibility,
    });

    const totalRecords = useMemo(() => toSafeNumber(data?.count), [data?.count]);
    const totalPages = useMemo(() => Math.max(1, Math.ceil(totalRecords / pageSize)), [totalRecords, pageSize]);
    const currentPage = pageIndex + 1;

    /*
     * La pagina restaurada puede quedar fuera de rango si se borraron registros
     * o si el filtro devuelve menos paginas que en la sesion anterior: sin esta
     * correccion la tabla se veria vacia sin explicacion.
     */
    useEffect(() => {
        if (data === undefined) return;
        if (pageIndex < totalPages) return;
        setPageIndex(0);
    }, [data, pageIndex, totalPages]);

    const nextPage = () => setPageIndex((prev) => Math.min(prev + 1, totalPages - 1));
    const previousPage = () => setPageIndex((prev) => (prev > 0 ? prev - 1 : 0));
    const firstPage = () => setPageIndex(0);
    const lastPage = () => setPageIndex(totalPages - 1);
    const goToPage = (page) => {
        setPageIndex(resolvePageIndex(page, { currentPage, totalPages }));
    };
    const { jumpForward, jumpBackward } = createStepJumpHandlers({ goToPage, currentPage });
    const handlePageSizeChange = (newPageSize) => {
        const parsedPageSize = toSafeNumber(newPageSize, pageSize);
        dismissLateRestored();
        setPageSize(parsedPageSize);
        setPageIndex(0);
    };
    const hasNextPage = useMemo(() => pageIndex < totalPages - 1, [pageIndex, totalPages]);
    const hasPreviousPage = useMemo(() => pageIndex > 0, [pageIndex]);

    const handleApplyFilters = useCallback(
        (newFilters, newPageSize) => {
            const cleanedFilters = Object.fromEntries(
                Object.entries(newFilters).filter(([, value]) => value && value.value !== ""),
            );
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const normalizedFilters = normalizeAppliedTableDateFilters(cleanedFilters, filteredSchema, timeZone);

            dismissLateRestored();

            if (newPageSize !== undefined && newPageSize !== pageSize) {
                setPageSize(newPageSize);
            }

            setCurrentFiltersValues(normalizedFilters);
            setUserFilters(Object.values(normalizedFilters));
            setPageIndex(0);

            promptConfirmation({
                isNew: !selectedFilter,
                handler: !selectedFilter
                    ? () => setOpenNewFilterModal(true)
                    : (name) => handleSaveFilter(name, normalizedFilters),
                newFiltersValues: normalizedFilters,
                currentFiltersValues,
            });
        },
        [selectedFilter, promptConfirmation, currentFiltersValues, pageSize, filteredSchema, dismissLateRestored],
    );

    const handleClearFilters = useCallback(() => {
        dismissLateRestored();
        setUserFilters([]);
        /*
         * `baseFilters` se vuelve a derivar SOLO del `tableFilters` actual (via
         * `tableFiltersRef`, para no anadir `tableFilters` a los deps del
         * useCallback y preservar su identidad estable entre renders — de lo
         * contrario los consumidores que pasan `tableFilters` como literal inline
         * rompen el React.memo de DataTable/DataTableFilters): el scope de
         * contexto (p. ej. `workspace_id` en /interactions) sobrevive a "Limpiar
         * filtros", pero el drill-in explicito de las tarjetas del Dashboard
         * (`urlFilter` = location.state.filter) si se descarta, que es justo lo
         * que el usuario espera al pulsar el boton.
         */
        setBaseFilters(tableFiltersRef.current ?? []);
        setPageIndex(0);
        setCurrentFiltersValues({});
        setSelectedFilter("");
    }, [dismissLateRestored]);

    const handleRefresh = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: [dataTableKey] });
    }, [queryClient, dataTableKey]);

    const handleSaveFilter = useCallback(
        (filterName = "", filtersToSave) => {
            const filterNameToUse = filterName || selectedFilter;

            const updatedUser = {
                ...user,
                filters: {
                    ...user?.filters,
                    application: {
                        ...user?.filters?.application,
                        admin: {
                            ...user?.filters?.application?.admin,
                            [dataTableView]: {
                                ...user?.filters?.application?.admin?.[dataTableView],
                                [filterNameToUse]: filtersToSave ?? currentFiltersValues,
                            },
                        },
                    },
                },
            };

            toast.promise(createNewFilter(updatedUser), {
                loading: t("app.text.savingFilter"),
                success: () => t("app.alerts.savedFilterSuccess"),
                position: "top-center",
                className: "bg-blue-400",
                error: (error) => error?.message ?? t("app.alert.failedToSaveFilter"),
            });

            if (filterName) {
                setSavedFilterList((prev) => [...prev, filterName]);
                setSelectedFilter(filterName);
            }
        },
        [currentFiltersValues, selectedFilter, user, createNewFilter, dataTableView, t],
    );

    const handleDeleteFilter = useCallback(
        async (filterName) => {
            const filterNameToDelete = typeof filterName === "string" ? filterName.trim() : "";
            if (!filterNameToDelete || !user?.filters) return false;

            const nextFilters = removeSavedUserFilter(
                user.filters,
                dataTableView,
                filterNameToDelete,
                FILTER_SCOPES.ADMIN,
            );
            if (nextFilters === user.filters) return false;

            const updatedUser = {
                ...user,
                filters: nextFilters,
            };

            const deletePromise = createNewFilter(updatedUser).then(() => {
                setSavedFilterList((prev) => prev.filter((name) => name !== filterNameToDelete));
                if (selectedFilter === filterNameToDelete) {
                    setSelectedFilter("");
                }
            });

            toast.promise(deletePromise, {
                loading: t("app.text.deletingFilter"),
                success: () => t("app.text.filterDeleted"),
                position: "top-center",
                className: "bg-blue-400",
                error: () => t("app.text.deleteFilterError"),
            });

            try {
                await deletePromise;
                return true;
            } catch {
                return false;
            }
        },
        [user, dataTableView, createNewFilter, selectedFilter, t],
    );

    const onFilterSelect = useCallback(
        (filterName) => {
            setSelectedFilter(filterName);
            const admin = user?.filters?.application?.admin ?? {};
            if (dataTableView in admin) {
                const filterData = admin[dataTableView][filterName];
                setCurrentFiltersValues(normalizeSavedFilterValues(filterData, filteredSchema));
            }
        },
        [user, dataTableView, filteredSchema],
    );

    const handleToggleColumnVisibility = useCallback(
        (columnId) => {
            const column = table.getColumn(columnId);
            if (column) column.toggleVisibility(!column.getIsVisible());
        },
        [table],
    );

    const availableColumns = table.getAllLeafColumns().filter((col) => col.getCanHide());

    const headerGroups = useMemo(() => {
        return table.getHeaderGroups().map((headerGroup) => ({
            id: headerGroup.id,
            headers: headerGroup.headers
                .filter((header) => header.column.getIsVisible())
                .map((header) => {
                    const canSort = header.column.getCanSort();
                    const headerContent = header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext());
                    const content = canSort ? (
                        <SortableHeader
                            direction={sortConfig.field === header.column.id ? sortConfig.direction : null}
                            onClick={() => {
                                const sortField = header.column.columnDef.meta?.sortField ?? header.column.id;
                                handleSort(sortField);
                            }}
                        >
                            {headerContent}
                        </SortableHeader>
                    ) : (
                        headerContent
                    );
                    return {
                        id: header.id,
                        colSpan: header.colSpan,
                        content,
                    };
                }),
        }));
    }, [table, sortConfig, handleSort, columnVisibility, columns]);

    const processedRows = useMemo(() => {
        return table.getRowModel().rows.map((row) => {
            const classificationChildren = classificationExpandColumn
                ? getRowExpandableClassificationLevels(row.original, classificationExpandColumn)
                : row.original.children;
            const hasChildren = classificationChildren?.length > 0;
            const isExpanded = row.getIsExpanded();
            const shouldRenderChildrenSubRow = isExpanded && hasChildren;

            const rootColumnName = classificationExpandColumn?.column_name ?? "nivel1";
            const rootValue = row.original[rootColumnName];
            const subRowClassifications = [
                ...(rootValue ? [{ id: rootColumnName, label: rootValue }] : []),
                ...(classificationChildren ?? []),
            ];

            let subRow = null;
            if (shouldRenderChildrenSubRow) {
                subRow = {
                    id: `${row.id}-expanded`,
                    colSpan: row.getVisibleCells().length,
                    content: <CellClassificationRow classifications={subRowClassifications} />,
                };
            }

            return {
                id: row.id,
                original: row.original,
                mainRow: {
                    id: row.id,
                    style: getRowStyle ? getRowStyle(row) : {},
                    cells: row.getVisibleCells().map((cell) => ({
                        id: cell.id,
                        content: flexRender(cell.column.columnDef.cell, cell.getContext()),
                    })),
                },
                subRow,
            };
        });
    }, [table, tableData, expanded, columnVisibility, columns, classificationExpandColumn, getRowStyle]);

    const renderData = useMemo(() => {
        if (!columns || columns.length === 0) return { processedHeader: [], rows: [], emptyState: null };

        const emptyState = (
            <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                    {isFetching ? t("dataTable.errors.loading") : t("dataTable.errors.notFoundRelated.description")}
                </TableCell>
            </TableRow>
        );

        return {
            processedHeader: headerGroups[0]?.headers || [],
            rows: processedRows,
            emptyState,
        };
    }, [headerGroups, processedRows, columns, isFetching, t]);

    const columnSelectorData = useMemo(() => {
        return availableColumns.map((col) => ({
            id: col.id,
            displayName: typeof col.columnDef.header === "string" ? col.columnDef.header : col.id,
            isVisible: col.getIsVisible(),
        }));
    }, [availableColumns, table]);

    return {
        renderData,
        pagination: {
            page: currentPage,
            totalPages,
            totalRecords,
            pageSize,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            onNextPage: nextPage,
            canNextPage: hasNextPage,
            onPreviousPage: previousPage,
            canPreviousPage: hasPreviousPage,
            onGoToPage: goToPage,
            onPageSizeChange: handlePageSizeChange,
            onFirstPage: firstPage,
            onLastPage: lastPage,
            ...(dataTableConfig.enableStepJump ? { onJumpBackward: jumpBackward, onJumpForward: jumpForward } : {}),
        },
        filters: {
            schema: filteredSchema,
            savedFilterList,
            onApply: handleApplyFilters,
            onClear: handleClearFilters,
            isActive: (userFilters || []).length > 0,
            hasClearableBaseFilters: getTableFiltersKey(baseFilters) !== tableFiltersKey,
            openNewFilterModal,
            setOpenNewFilterModal,
            handleSaveFilter,
            handleDeleteFilter,
            onFilterSelect,
            currentFiltersValues,
            selectedFilter,
            pageSize,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
        },
        query: {
            isLoading,
            isFetching,
            isError,
            refetch,
            handleRefresh,
            metadata: data?.metadata ?? {},
        },
        columnSelector: {
            columns: columnSelectorData,
            onToggleVisibility: handleToggleColumnVisibility,
        },
        schema: processedColumns,
        rawSchema: schema,
        expanded,
        setExpanded,
        sort: {
            sortConfig,
            handleSort,
        },
    };
};

export default useDataTable;
