import { useState, useMemo, useEffect } from "react";
import PropTypes from "prop-types";
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import DataTable from "@/componentsV2/core/DataTable";
import useDataTable from "@/hooks/useDataTable";
import useUserInformation from "@/hooks/useUserInformation";

import { dataTableConfig } from "../data/constants";
import { useReportDownload } from "../hooks/useReportDownload";
import useIncludeReportsColumns from "../hooks/useIncludeReportsColumns";
import useProcessReportsSchema from "../hooks/useProcessReportsSchema";
import { processData, processFilters } from "../utils/datatableProcess";
import { processReportsColumns } from "../utils/processReportsColumns";

const DEFAULT_FILTER_DAYS = 1;
const MAX_FILTER_DAYS = 30;

const buildDateRange = (days) => {
    const safeDays = Math.min(Math.max(1, parseInt(days, 10) || DEFAULT_FILTER_DAYS), MAX_FILTER_DAYS);
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    const from = new Date();
    from.setDate(from.getDate() - (safeDays - 1));
    from.setHours(0, 0, 0, 0);
    return { from, to };
};

const buildFilters = (userId, from, to) => {
    const filters = [];
    if (userId) {
        filters.push({ field: "created_by", operator: "eq", value: userId, type: "AND" });
    }
    filters.push({
        field: "created_at",
        operator: "between",
        value: `${from.toISOString()}, ${to.toISOString()}`,
        type: "AND",
    });
    return filters;
};

export const ReportsTableContainer = ({ arrayAction = [] }) => {
    const REFRESH_INTERVAL_MS = 60000;

    const { downloadReport } = useReportDownload();
    const { includeReportsColumns } = useIncludeReportsColumns(downloadReport);
    const { processReportsSchema, processReportsFilterSchema } = useProcessReportsSchema();
    const { t } = useTranslation();

    const { user } = useUserInformation();
    const userId = user?.id || null;

    const [refetchInterval, setRefetchInterval] = useState(REFRESH_INTERVAL_MS);
    const configAdmin = useSelector((state) => state.generalSetup.configAdmin);
    const reportFilterDays = configAdmin?.reports?.report_filter_days ?? DEFAULT_FILTER_DAYS;

    const safeReportFilterDays = useMemo(
        () => Math.min(Math.max(1, parseInt(reportFilterDays, 10) || DEFAULT_FILTER_DAYS), MAX_FILTER_DAYS),
        [reportFilterDays],
    );

    const { from, to } = useMemo(() => buildDateRange(safeReportFilterDays), [safeReportFilterDays]);

    const baseFilters = useMemo(() => buildFilters(userId, from, to), [userId, from, to]);

    const { renderData, query, filters, pagination, columnSelector } = useDataTable({
        dataTableConfig,
        actions: arrayAction,
        processSchema: processReportsSchema,
        processColumns: processReportsColumns,
        includeColumns: includeReportsColumns,
        processData,
        transformFiltersBeforeQuery: processFilters,
        tableFilters: baseFilters,
        refetchInterval,
    });

    const localizedFilters = useMemo(
        () => ({
            ...filters,
            schema: processReportsFilterSchema(filters.schema ?? []),
        }),
        [filters, processReportsFilterSchema],
    );

    const hasActiveExecutions = useMemo(() => {
        if (!renderData?.rows) return false;
        return renderData.rows.some((row) => {
            const status = row.original?.status;
            return status === "pending" || status === "in_progress";
        });
    }, [renderData?.rows]);

    useEffect(() => {
        if (hasActiveExecutions) {
            setRefetchInterval(REFRESH_INTERVAL_MS);
        } else {
            setRefetchInterval(false);
        }
    }, [hasActiveExecutions]);

    const dateRangeLabel = useMemo(() => {
        const fromStr = from.toLocaleDateString();
        const toStr = to.toLocaleDateString();
        return fromStr === toStr ? fromStr : `${fromStr} – ${toStr}`;
    }, [from, to]);

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-gray-50 border border-gray-200 text-sm text-gray-700">
                <Info className="h-4 w-4 flex-shrink-0 text-gray-500" />
                <span>
                    {t("reports.filter.dateRangeInfo", {
                        days: safeReportFilterDays,
                        range: dateRangeLabel,
                    })}
                </span>
            </div>
            <DataTable
                renderData={renderData}
                query={query}
                filters={localizedFilters}
                pagination={pagination}
                columnSelector={columnSelector}
            />
        </div>
    );
};

ReportsTableContainer.propTypes = {
    arrayAction: PropTypes.array,
};

export default ReportsTableContainer;
