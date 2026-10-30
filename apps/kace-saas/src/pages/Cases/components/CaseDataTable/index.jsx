import PropTypes from "prop-types";
import DataTable from "@/componentsV2/core/DataTable";
import useIncludeCasesColumns from "./hooks/useIncludeCasesColumns";
import useDataTable from "@/hooks/useDataTable";
import {
    attachMaxLevelToClassificationField,
    CLASSIFICATION_LEVEL_DUPLICATE_FILTER_COLUMNS,
    processCasesColumns,
    processCasesData,
    processCasesFilters,
    buildCustomViewFilterSchema,
    processSchemaForCustomView,
    headersTransform,
} from "./utils/processCasesData";
import { transformNivelFilters } from "./utils/transformNivelFilters";
import { getMaxAvailableNivelLevel, MAX_CLASSIFICATION_LEVELS } from "./utils/classificationLevels.util";
import { casesDataTableConfig } from "./constants";
import useCasesFiltersConfig from "./hooks/useCasesFiltersConfig";
import { useMemo, useCallback, useState, useEffect } from "react";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { GeneralLoader } from "@/components/ui-shared";
import useConfigAgentData from "@/hooks/useConfigAgentData";
import useSelectedCases from "../../hooks/useSelectedCases";
import { useTranslation } from "react-i18next";
import useSubcasesPanel from "@/components/core/CasesTableComponent/hooks/useSubcasesPanel";
import SubcasesPanel from "@/components/core/CasesTableComponent/SubcasesPanel";
import { getAnsRowBackgroundStyle } from "@/components/core/CasesTableComponent/utils/getAnsRowBackgroundStyle";
import { getCasesHeaderNamespace, getSchemaFilter } from "@/services/createSchemaFilter";
import useSchemaFields from "@/hooks/useSchemaFields";
import { CaseStatusColorMapProvider } from "@/componentsV2/core/TableCellContent/context/CaseStatusColorMapContext";
import { buildStatusColorMap } from "./utils/caseStateStatus.util";

const CaseDataTable = ({
    actions = [],
    isCustomViewEnabled = false,
    customViewName = null,
    visibleColumns = [],
    isSubCasesEnabled = false,
    onBulkCombinedAction,
    refetchInterval = false,
}) => {
    const { t } = useTranslation();
    const { getSchemaField } = useSchemaFields();
    const { cases: configCases } = useConfigAgentData();
    const ansDisplayMode = configCases?.ans_display_mode || "row";
    const { includeCasesColumns } = useIncludeCasesColumns(isSubCasesEnabled, ansDisplayMode);
    const { selectedCases, setSelectedCases, clearSelectedCases, getCaseFromRow, toggleCase, toggleAll } =
        useSelectedCases();

    useEffect(() => {
        return () => clearSelectedCases();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { subcasesPageByParent, loadingByParent, errorByParent, handleInitialLoadSubcases, handleLoadMoreSubcases } =
        useSubcasesPanel();

    const [expandedSubcases, setExpandedSubcases] = useState({});

    const getRowEnhancer = useCallback(
        (row, index) => {
            if (!isSubCasesEnabled) return {};
            const rowId = String(index);
            return {
                onToggleSubcases: () =>
                    setExpandedSubcases((prev) => ({
                        ...prev,
                        [rowId]: !prev[rowId],
                    })),
                isSubcasesExpanded: Boolean(expandedSubcases[rowId]),
            };
        },
        [isSubCasesEnabled, expandedSubcases],
    );

    const tableConfig = useMemo(() => {
        if (!isCustomViewEnabled || !customViewName) {
            return casesDataTableConfig;
        }
        return {
            ...casesDataTableConfig,
            url: URL_AND_KEYS.cases.urlView,
            view: customViewName,
            entity: customViewName,
            /*
             * La vista personalizada comparte `key` con la tabla de casos normal
             * pero tiene otro esquema de columnas: se separa la clave de
             * persistencia para que un filtro no sobreviva al cambio de vista
             * apuntando a una columna que ya no existe.
             */
            persistKey: `${casesDataTableConfig.key}:${customViewName}`,
            useDefaultFilters: false,
        };
    }, [isCustomViewEnabled, customViewName, casesDataTableConfig]);

    const tableFilters = useMemo(() => {
        if (isCustomViewEnabled) return [];
        return isSubCasesEnabled
            ? [
                  {
                      field: "parent_id",
                      operator: "null",
                      value: "null",
                      type: "AND",
                  },
              ]
            : [];
    }, [isSubCasesEnabled, isCustomViewEnabled]);

    const processSchemaWithVisibility = useMemo(() => {
        if (!isCustomViewEnabled) return null;
        return (schema) => processSchemaForCustomView(schema, visibleColumns);
    }, [isCustomViewEnabled, visibleColumns]);

    const entitySchema = useMemo(() => getSchemaField(tableConfig.entity), [getSchemaField, tableConfig.entity]);

    /*
     * Custom admin views aren't guaranteed to expose nivel1..nivel10 the way the default
     * view (joined to `clasificaciones`) always does — e.g. a custom view defined without
     * nivel10. Cap nivel filtering to whatever the active view's real columns support, so
     * a stale UI selection or saved filter can't crash the search query.
     */
    const maxNivelLevel = useMemo(
        () => (isCustomViewEnabled ? getMaxAvailableNivelLevel(entitySchema ?? []) : MAX_CLASSIFICATION_LEVELS),
        [isCustomViewEnabled, entitySchema],
    );

    const transformFiltersBeforeQuery = useCallback(
        (currentFilters) =>
            transformNivelFilters(currentFilters, { isCustomView: isCustomViewEnabled, maxLevel: maxNivelLevel }),
        [isCustomViewEnabled, maxNivelLevel],
    );

    const casesProcessData = useMemo(
        () =>
            processCasesData(
                configCases?.due_date_for_ans_calculation,
                configCases?.semaphore_by_state_ans,
                entitySchema,
                configCases?.show_time_description_prefixes ?? true,
            ),
        [
            configCases?.due_date_for_ans_calculation,
            configCases?.semaphore_by_state_ans,
            configCases?.show_time_description_prefixes,
            entitySchema,
        ],
    );

    const { renderData, query, filters, pagination, columnSelector, schema, rawSchema } = useDataTable({
        dataTableConfig: tableConfig,
        actions,
        processFilters: processCasesFilters,
        processColumns: processCasesColumns(isCustomViewEnabled),
        includeColumns: includeCasesColumns,
        processData: casesProcessData,
        processSchema: processSchemaWithVisibility,
        headersTransform,
        tableFilters,
        transformFiltersBeforeQuery,
        getRowEnhancer: isSubCasesEnabled ? getRowEnhancer : undefined,
        getRowStyle: ansDisplayMode === "row" ? (row) => getAnsRowBackgroundStyle(row) : undefined,
        refetchInterval,
    });

    const statusColorMap = useMemo(
        () => buildStatusColorMap(query.metadata?.countByStatus ?? []),
        [query.metadata?.countByStatus],
    );

    const allIds = useMemo(() => renderData.rows.map((row) => row.id), [renderData.rows]);

    const isAllSelected = selectedCases.length === allIds.length && allIds.length > 0;

    const processedHeaderWithCheckbox = [
        {
            id: "__select__",
            colSpan: 1,
            content: <input type="checkbox" checked={isAllSelected} onChange={() => toggleAll(renderData.rows)} />,
        },
        ...renderData.processedHeader,
    ];

    const openCaseAction = useMemo(() => {
        return actions?.find((a) => a?.name?.toLowerCase() === "ver caso")?.action;
    }, [actions]);

    const renderSubcasesPanel = useCallback(
        ({ row }) => (
            <SubcasesPanel
                row={row}
                subcasesPageByParent={subcasesPageByParent}
                loadingByParent={loadingByParent}
                errorByParent={errorByParent}
                handleLoadMoreSubcases={handleLoadMoreSubcases}
                openCaseAction={openCaseAction}
            />
        ),
        [subcasesPageByParent, loadingByParent, errorByParent, handleLoadMoreSubcases, openCaseAction],
    );

    const totalColumnsCount = useMemo(() => {
        return renderData.processedHeader.length + 1;
    }, [renderData.processedHeader.length]);

    const enrichedRows = useMemo(() => {
        const normalizeSubRowColSpan = (r) => ({
            ...r,
            subRow: r.subRow ? { ...r.subRow, colSpan: totalColumnsCount } : null,
        });

        if (!isSubCasesEnabled) {
            return renderData.rows.map(normalizeSubRowColSpan);
        }

        return renderData.rows.map((row) => {
            const caseData = getCaseFromRow(row);
            const caseId = caseData?.id;
            const caseIdString = caseId?.toString();
            const hasSubcases = (caseData?.subcasos && caseData.subcasos > 0) || false;
            const loadingSubcases = loadingByParent[caseId] ?? loadingByParent[caseIdString] ?? false;
            const subcasesData = subcasesPageByParent[caseId] ?? subcasesPageByParent[caseIdString];

            const enrichedCells = row.mainRow.cells.map((cell) => {
                if (cell.content?.props?.row) {
                    const originalRow = cell.content.props.row;
                    return {
                        ...cell,
                        content: {
                            ...cell.content,
                            props: {
                                ...cell.content.props,
                                row: {
                                    ...originalRow,
                                    original: {
                                        ...originalRow.original,
                                        hasSubcases,
                                        loadingSubcases,
                                        onLoadSubcases: caseId ? () => handleInitialLoadSubcases(caseId) : undefined,
                                        subcasesData,
                                    },
                                },
                            },
                        },
                    };
                }
                return cell;
            });

            const rowId = row.id;
            const isSubcasesExpanded = expandedSubcases[rowId] || false;

            let finalSubRow = row.subRow ? { ...row.subRow, colSpan: totalColumnsCount } : null;
            if (isSubcasesExpanded) {
                if (loadingSubcases && !subcasesData) {
                    finalSubRow = {
                        id: `${row.id}-subcases-expanded`,
                        colSpan: totalColumnsCount,
                        content: <div className="p-4 text-center text-gray-500">Cargando subcasos...</div>,
                    };
                } else if (subcasesData) {
                    finalSubRow = {
                        id: `${row.id}-subcases-expanded`,
                        colSpan: totalColumnsCount,
                        content: renderSubcasesPanel({
                            row: {
                                original: {
                                    ...caseData,
                                    id: caseId || caseIdString,
                                },
                                id: caseIdString,
                            },
                        }),
                    };
                } else {
                    finalSubRow = {
                        id: `${row.id}-subcases-expanded`,
                        colSpan: totalColumnsCount,
                        content: <div className="p-4 text-center text-gray-500">No hay subcasos disponibles</div>,
                    };
                }
            }

            return {
                ...row,
                mainRow: {
                    ...row.mainRow,
                    cells: enrichedCells,
                },
                subRow: finalSubRow,
            };
        });
    }, [
        isSubCasesEnabled,
        renderData.rows,
        getCaseFromRow,
        loadingByParent,
        subcasesPageByParent,
        handleInitialLoadSubcases,
        renderSubcasesPanel,
        expandedSubcases,
        totalColumnsCount,
    ]);

    const rowsWithCheckbox = enrichedRows.map((row) => ({
        ...row,
        mainRow: {
            ...row.mainRow,
            cells: [
                {
                    id: "__select__",
                    content: (
                        <input
                            type="checkbox"
                            checked={selectedCases.some((item) => item?.id === getCaseFromRow(row)?.id)}
                            onChange={() => toggleCase(row)}
                        />
                    ),
                },
                ...row.mainRow.cells,
            ],
        },
    }));

    const { casesFiltersConfig } = useCasesFiltersConfig({
        handleApplyFilters: filters.onApply,
        handleClearFilters: filters.onClear,
        viewPrefix: isCustomViewEnabled ? "" : "cases.",
        isCustomViewEnabled,
    });

    const filtersSchema = useMemo(() => {
        const hasSchema = Array.isArray(schema) ? schema.length > 0 : schema && Object.keys(schema).length > 0;
        if (!hasSchema) return null;

        if (isCustomViewEnabled) {
            const filterSchema = buildCustomViewFilterSchema(schema, rawSchema);
            const rawFilterColumns = Object.values(processCasesColumns(isCustomViewEnabled)({}, filterSchema));
            return {
                ...filters,
                schema: attachMaxLevelToClassificationField(
                    getSchemaFilter(
                        rawFilterColumns,
                        processCasesFilters([]),
                        CLASSIFICATION_LEVEL_DUPLICATE_FILTER_COLUMNS,
                        getCasesHeaderNamespace(tableConfig),
                    ),
                    maxNivelLevel,
                ),
            };
        }

        return { ...filters };
    }, [schema, rawSchema, filters, isCustomViewEnabled, processCasesColumns, maxNivelLevel, tableConfig]);

    return filtersSchema === null ? (
        <GeneralLoader />
    ) : (
        <CaseStatusColorMapProvider value={statusColorMap}>
            <DataTable
                renderData={{
                    ...renderData,
                    processedHeader: processedHeaderWithCheckbox,
                    rows: rowsWithCheckbox,
                }}
                query={query}
                filters={filtersSchema}
                casesFilters={casesFiltersConfig}
                pagination={pagination}
                columnSelector={columnSelector}
                bulkActions={{
                    selectedCount: selectedCases.length,
                    onClearSelection: () => setSelectedCases([]),
                    actions: [
                        {
                            label: t("combinedBulkActions.title"),
                            onClick: () => onBulkCombinedAction(selectedCases),
                        },
                    ],
                }}
            />
        </CaseStatusColorMapProvider>
    );
};

CaseDataTable.propTypes = {
    actions: PropTypes.array,
    isCustomViewEnabled: PropTypes.bool,
    customViewName: PropTypes.string,
    visibleColumns: PropTypes.arrayOf(
        PropTypes.shape({
            column_name: PropTypes.string.isRequired,
            header_label: PropTypes.string.isRequired,
            cell_type: PropTypes.string.isRequired,
            separator: PropTypes.string,
        }),
    ),
    isSubCasesEnabled: PropTypes.bool,
    onBulkCombinedAction: PropTypes.func,
    refetchInterval: PropTypes.oneOfType([PropTypes.number, PropTypes.bool]),
};

export default CaseDataTable;
