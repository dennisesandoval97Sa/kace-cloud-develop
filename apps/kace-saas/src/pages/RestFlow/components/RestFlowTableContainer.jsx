import PropTypes from "prop-types";
import useDataTable from "@/hooks/useDataTable";
import DataTable from "@/componentsV2/core/DataTable";
import { dataTableConfig } from "../data/constants";
import { processColumns, processData, processFilters } from "../utils/datatableProcess";
import { filterByIsPrimary } from "@/utils/genericFilters";

export const RestFlowsTableContainer = ({ arrayAction = [] }) => {
    const { renderData, query, filters, pagination, columnSelector } = useDataTable({
        dataTableConfig,
        actions: arrayAction,
        processFilters,
        processColumns,
        processData,
        tableFilters: [filterByIsPrimary],
        transformFiltersBeforeQuery: (currentFilters) => {
            const hasIsPrimary = currentFilters.some((f) => f.field === "is_primary");
            if (!hasIsPrimary) {
                return [...currentFilters, filterByIsPrimary];
            }
            return currentFilters;
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

RestFlowsTableContainer.propTypes = {
    arrayAction: PropTypes.array,
};
