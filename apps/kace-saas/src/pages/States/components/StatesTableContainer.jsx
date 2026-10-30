import PropTypes from "prop-types";
import DataTable from "@/componentsV2/core/DataTable";
import useDataTable from "@/hooks/useDataTable";
import { dataTableConfig } from "../data/constants";
import { processColumns, processData, processFilters } from "../utils/datatableProcess";

export const StatesTableContainer = ({
    arrayAction = [],
}) => {
    const { renderData, query, filters, pagination, columnSelector } =
        useDataTable({
            dataTableConfig,
            actions: arrayAction,
            processFilters,
            processColumns,
            processData,
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

StatesTableContainer.propTypes = {
    arrayAction: PropTypes.array,
};
