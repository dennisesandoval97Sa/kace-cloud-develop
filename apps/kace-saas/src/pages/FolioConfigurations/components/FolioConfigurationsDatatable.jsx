import DataTable from "@/componentsV2/core/DataTable";
import useDataTable from "@/hooks/useDataTable";
import PropTypes from "prop-types";
import { dataTableConfig } from "../data/constants";
import { processColumns, processData, processFilters } from "../utils/datatableProcess";

const FolioConfigurationsDatatable = ({ actions = [] }) => {
    const { renderData, query, filters, pagination, columnSelector } = useDataTable({
        dataTableConfig,
        actions,
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

FolioConfigurationsDatatable.propTypes = {
    actions: PropTypes.array,
};

export default FolioConfigurationsDatatable;
