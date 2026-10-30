import { createColumns } from "@kace/ui-shared";
import useCasesTableData from "../../../pages/Cases/hooks/useCasesTableData";
import useConfigAgentData from "../../../hooks/useConfigAgentData";
import { useEffect, useState, useMemo, useCallback } from "react";
import { t } from "i18next";
import { PropTypes } from "prop-types";
import { HEADERS_CASES_TABLE } from "../../../pages/Cases/data/Constants";
import { DataTableContainer } from "../../ui-shared/src/components/table-component/DataTableContainer";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import {
    createCasesFilterCriterionResolver,
    createNivelFieldTransformer,
} from "../../../pages/Cases/components/CaseDataTable/utils/transformNivelFilters";
import SubcasesPanel from "./SubcasesPanel";
import useSubcasesPanel from "./hooks/useSubcasesPanel";
import { getAnsRowBackgroundStyle } from "./utils/getAnsRowBackgroundStyle";
import { getExpandableClassificationLevelsFromRow } from "@/utils/classificationLevels";
import { resolveNamespacedColumnLabel } from "@/services/createSchemaFilter";

const ALWAYS_EXPANDABLE = () => true;
const GET_CASE_ROW_ID = (row, index) => String(row.id ?? index);

export const CasesTableComponent = ({
    actionProps = [],
    showFilterCases = false,
    keyQuery = "",
    showFilters = true,
    altoImpacto = false,
    customSchemaFilterConfig = {},
    isCustomViewEnabled = false,
    customViewName = null,
    showSubcasesColumn = false,
    baseFilters = [],
    onClearFilters = null,
    refetchInterval = false,
    enableRowSelection = true,
}) => {
    const [currentHeaders, setCurrentHeaders] = useState([]);
    const { cases: configCases } = useConfigAgentData();
    const ansDisplayMode = configCases?.ans_display_mode || "row";
    const { subcasesPageByParent, loadingByParent, errorByParent, handleInitialLoadSubcases, handleLoadMoreSubcases } =
        useSubcasesPanel();
    const {
        headers,
        dataTable,
        isFetching,
        isLoadingTable,
        refetch,
        columnsToFilter,
        maxNivelLevel,
        fieldsCustomerFilters,
        caseStatusCounter,
        showSubcasesButton,
    } = useCasesTableData({
        headersFilters: HEADERS_CASES_TABLE,
        keyQuery,
        altoImpacto,
        customSchemaFilterConfig,
        isCustomViewEnabled,
        customViewName,
        refetchInterval,
    });

    const toTitleCase = (str) =>
        str
            ?.replace(/[_\s]+/g, " ")
            .replace(/([a-z])([A-Z])/g, "$1 $2")
            .toLowerCase()
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");

    const handleCurrentHeaders = () => {
        const overridesList = Array.isArray(configCases?.headers_labels) ? configCases.headers_labels : [];
        const overrides = new Map(
            overridesList.filter((entry) => entry && entry.key).map((entry) => [entry.key, entry.label]),
        );
        /*
         * This resolveHeader intentionally keeps its own admin-override and toTitleCase fallback
         * instead of calling resolveGridColumnHeader (createSchemaFilter.js) wholesale, because the
         * two resolvers differ in ways that don't map onto a shared function without changing
         * behavior for one of them:
         * - admin-configured per-column overrides (configCases.headers_labels) take priority here and
         *   have no equivalent in resolveGridColumnHeader.
         * - toTitleCase here also splits camelCase (estadoActual -> "Estado Actual"), which
         *   resolveGridColumnHeader's own toTitleCase does not do (only underscores -> spaces).
         * - CasesTableComponent's headers come from useCasesTableData's schema transform, not from
         *   resolveGridColumnHeader's column_name/label/estadoActual candidate chain.
         * The "columnsCases-then-shared" i18n lookup itself is shared via resolveNamespacedColumnLabel,
         * so that part can't drift out of sync with resolveGridColumnHeader/HeadersLabelsEditor.
         */
        const resolveHeader = (columnName, fallbackLabel) => {
            const override = overrides.get(columnName);
            const overrideText = override && String(override).trim() ? override : null;
            if (overrideText !== null) return overrideText;
            return resolveNamespacedColumnLabel(t, fallbackLabel) ?? toTitleCase(columnName);
        };
        const keyColumns = headers.map((column) => ({
            accessorKey: column.column_name,
            header: resolveHeader(column.column_name, column.label),
            value: column.data_type,
        }));
        if (showSubcasesColumn) {
            keyColumns.push({
                accessorKey: "subcasos",
                header: resolveHeader("subcasos", "subcases"),
                value: "number",
                isSubcasosColumn: true,
            });
        }
        setCurrentHeaders(keyColumns);
    };

    const enrichedData = useMemo(() => {
        if (!dataTable?.length) return dataTable;
        return dataTable.map((row) => {
            const classificationChildren = getExpandableClassificationLevelsFromRow(row, "nivel1");

            return {
                ...row,
                classificationChildren,
                children: [],
                loadingSubcases: loadingByParent[row.id] ?? false,
                onLoadSubcases: () => handleInitialLoadSubcases(row.id),
                hasSubcases: (row.subcasos && row.subcasos > 0) || false,
            };
        });
    }, [dataTable, loadingByParent, handleInitialLoadSubcases]);

    const openCaseAction = useMemo(() => {
        return actionProps?.find((a) => a?.name?.toLowerCase() === "ver caso")?.action;
    }, [actionProps]);

    const columnsData = useMemo(
        () => createColumns(currentHeaders, true, [], actionProps, enableRowSelection, null, ansDisplayMode),
        [currentHeaders, actionProps, enableRowSelection, ansDisplayMode],
    );

    const hiddenColumns = useMemo(
        () =>
            HEADERS_CASES_TABLE.reduce((acc, { key, isVisible }) => {
                if (isVisible === false) {
                    acc[key] = false;
                }
                return acc;
            }, {}),
        [],
    );

    const params = useMemo(() => {
        const isCustomView = isCustomViewEnabled;
        const next = {
            ...URL_AND_KEYS.cases,
            transformFilterField: createNivelFieldTransformer({ isCustomView, maxLevel: maxNivelLevel }),
            resolveFilterCriterion: createCasesFilterCriterionResolver({ isCustomView }),
        };
        if (isCustomView) {
            next.url = URL_AND_KEYS.cases.urlView;
            next.view = customViewName || URL_AND_KEYS.cases.customEntity;
        }
        return next;
    }, [isCustomViewEnabled, maxNivelLevel, customViewName]);

    useEffect(() => {
        handleCurrentHeaders();
    }, [headers, configCases?.headers_labels, configCases?.show_columns_dropdown]);

    const renderSubComponent = useCallback(
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

    const getRowStyle = useMemo(
        () => (ansDisplayMode === "row" ? (row) => getAnsRowBackgroundStyle(row) : null),
        [ansDisplayMode],
    );

    return (
        <DataTableContainer
            columns={columnsData}
            isPagination
            isLoadingTable={isLoadingTable}
            hiddenColumns={hiddenColumns}
            view={params}
            dataTable={enrichedData}
            getRowId={GET_CASE_ROW_ID}
            isFetching={isFetching}
            showFilterGeneric={showFilters}
            refresh={refetch}
            getRowCanExpand={ALWAYS_EXPANDABLE}
            showFilterCases={showFilterCases}
            columnsToFilter={columnsToFilter}
            fieldsCustomerFilters={fieldsCustomerFilters}
            renderSubComponent={renderSubComponent}
            caseStatusCounter={caseStatusCounter}
            showSubcasesButton={showSubcasesButton}
            autoResetPageIndex={false}
            baseFilters={baseFilters}
            onClearFilters={onClearFilters}
            getRowStyle={getRowStyle}
            showColumnsDropdown={configCases?.show_columns_dropdown ?? true}
        />
    );
};

CasesTableComponent.propTypes = {
    actionProps: PropTypes.array,
    showFilterCases: PropTypes.bool,
    keyQuery: PropTypes.string,
    showFilters: PropTypes.bool,
    altoImpacto: PropTypes.bool,
    isCustomViewEnabled: PropTypes.bool,
    customViewName: PropTypes.string,
    baseFilters: PropTypes.array,
    onClearFilters: PropTypes.func,
    refetchInterval: PropTypes.oneOfType([PropTypes.number, PropTypes.bool]),
    customSchemaFilterConfig: PropTypes.shape({
        extraIgnoreFields: PropTypes.arrayOf(PropTypes.string),
        classificationFields: PropTypes.arrayOf(
            PropTypes.shape({
                column_name: PropTypes.string.isRequired,
                field: PropTypes.string.isRequired,
            }),
        ),
    }),
};
