import { useMemo } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import DataTable from "@/componentsV2/core/DataTable";
import useDataTable from "@/hooks/useDataTable";
import { createProcessColumns, dataTableConfigImportFile, processData, processFilters } from "./config";

export const ACTIVE_POLLING_INTERVAL_MS = 4000;
// Desfase aleatorio (±ms) para que varios operadores no sincronicen sus peticiones.
export const POLLING_JITTER_MS = 500;

/*
 * Tabla del panel de control de importaciones (s3_import_files). La comparten /import-data y
 * /import-auxiliaries, que consultan el mismo endpoint /imports-dashboard/search.
 */
export const ImportsDashboardTable = ({ arrayAction = [] }) => {
    const { t } = useTranslation();
    const processColumns = useMemo(() => createProcessColumns(t), [t]);

    const { renderData, query, filters, pagination, columnSelector } = useDataTable({
        dataTableConfig: dataTableConfigImportFile,
        actions: arrayAction,
        processColumns,
        processFilters,
        processData,
        refetchInterval: (query) => {
            const items = query?.state?.data?.data;
            if (!Array.isArray(items)) return false;
            const hasActiveImports = items.some((item) => item.status === "pending" || item.status === "processing");
            if (!hasActiveImports) return false;
            return ACTIVE_POLLING_INTERVAL_MS + Math.round((Math.random() * 2 - 1) * POLLING_JITTER_MS);
        },
    });

    return (
        <DataTable
            renderData={renderData}
            query={query}
            filters={filters}
            pagination={pagination}
            columnSelector={columnSelector}
        />
    );
};

ImportsDashboardTable.propTypes = {
    arrayAction: PropTypes.array,
};

export default ImportsDashboardTable;
