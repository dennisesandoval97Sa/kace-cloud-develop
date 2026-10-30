import PropTypes from "prop-types";
import useDataTable from "@/hooks/useDataTable";
import DataTable from "@/componentsV2/core/DataTable";
import { dataTableConfig } from "../data/constants";
import { processColumns, processData, processFilters } from "../utils/datatableProcess";

export const NotificationsClientTableContainer = ({
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

NotificationsClientTableContainer.propTypes = {
    arrayAction: PropTypes.array,
};
