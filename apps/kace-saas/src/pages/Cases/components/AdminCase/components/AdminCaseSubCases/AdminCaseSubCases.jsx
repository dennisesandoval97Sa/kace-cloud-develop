import { useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import DataTable from "@/componentsV2/core/DataTable";
import useDataTable from "@/hooks/useDataTable";
import useAdminCaseParams from "../../hooks/useAdminCaseParams";
import useConfigAgentData from "@/hooks/useConfigAgentData";
import { getSubcasesDataTableConfig } from "./constants";
import {
    processSubcasesColumns,
    processSubcasesData,
    processSubcasesFilters,
    headersTransform,
} from "./utils/processSubcasesData";
import useIncludeSubcasesColumns from "./hooks/useIncludeSubcasesColumns";

const AdminCaseSubCases = () => {
    const { t } = useTranslation();
    const { caseId } = useAdminCaseParams();

    if (!caseId) {
        return (
            <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
                <p className="text-gray-500">{t("app.text.noCaseSelected")}</p>
            </div>
        );
    }

    return <AdminCaseSubCasesTable caseId={caseId} />;
};

const AdminCaseSubCasesTable = ({ caseId }) => {
    const { cases: configCases } = useConfigAgentData();
    const { includeSubcasesColumns } = useIncludeSubcasesColumns();

    const tableConfig = useMemo(() => getSubcasesDataTableConfig(caseId), [caseId]);

    const memoizedProcessData = useMemo(
        () =>
            processSubcasesData(
                configCases?.due_date_for_ans_calculation,
                configCases?.semaphore_by_state_ans,
                configCases?.show_time_description_prefixes ?? true,
            ),
        [
            configCases?.due_date_for_ans_calculation,
            configCases?.semaphore_by_state_ans,
            configCases?.show_time_description_prefixes,
        ],
    );

    const memoizedProcessColumns = useCallback((filters, schema) => processSubcasesColumns(filters || {}, schema), []);

    const memoizedProcessFilters = useCallback((defaultFilters) => processSubcasesFilters(defaultFilters), []);

    const memoizedHeadersTransform = useCallback((column) => headersTransform(column), []);

    const tableFilters = useMemo(
        () => [
            {
                groupType: "OR",
                filters: [
                    { field: "cases.is_visible", operator: "eq", value: "true", type: "OR" },
                    { field: "cases.is_visible", operator: "null", value: "null", type: "OR" },
                ],
            },
        ],
        [],
    );

    const { renderData, query, filters, pagination } = useDataTable({
        dataTableConfig: tableConfig,
        actions: [],
        processFilters: memoizedProcessFilters,
        processColumns: memoizedProcessColumns,
        includeColumns: includeSubcasesColumns,
        processData: memoizedProcessData,
        processSchema: null,
        headersTransform: memoizedHeadersTransform,
        tableFilters,
        userQueryView: false,
    });

    const filtersSchema = useMemo(
        () => ({
            ...filters,
            schema: [],
        }),
        [filters],
    );

    const queryWithoutRefetch = useMemo(
        () => ({
            ...query,
            refetch: null,
        }),
        [query],
    );

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-md bg-background drop-shadow-md">
            <DataTable
                renderData={renderData}
                query={queryWithoutRefetch}
                filters={filtersSchema}
                pagination={pagination}
                columnSelector={null}
            />
        </div>
    );
};

AdminCaseSubCasesTable.propTypes = {
    caseId: PropTypes.string.isRequired,
};

export default AdminCaseSubCases;
