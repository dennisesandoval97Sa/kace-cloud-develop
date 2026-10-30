import PropTypes from "prop-types";
import DataTable from "@/componentsV2/core/DataTable";
import useDataTable from "@/hooks/useDataTable";
import { dataTableConfig } from "../data/constants";
import { processColumns, processData } from "../utils/datatableProcess";

export const AutomationSettingsTableContainer = ({ arrayAction = [] }) => {
    const { renderData, query, filters, pagination, columnSelector } = useDataTable({
        dataTableConfig,
        actions: arrayAction,
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

AutomationSettingsTableContainer.propTypes = {
    arrayAction: PropTypes.array,
};
