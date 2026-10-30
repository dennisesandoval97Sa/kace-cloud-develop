import PropTypes from "prop-types";
import useDataTable from "@/hooks/useDataTable";
import DataTable from "@/componentsV2/core/DataTable";
import { dataTableConfig } from "../data/constants";
import { processColumns, processData, processFilters, processSchema } from "../utils/datatableProcess";
import { createSystemInboxWorkspaceExclusionFilter } from "@/utils/systemInboxWorkspace";

export const appendSystemInboxWorkspaceFilter = (filters = []) => [
    ...filters,
    createSystemInboxWorkspaceExclusionFilter(),
];

export const WorkspaceTableContainer = ({ arrayAction = [] }) => {
    const { renderData, query, filters, pagination, columnSelector } = useDataTable({
        dataTableConfig,
        actions: arrayAction,
        processFilters,
        processColumns,
        processData,
        processSchema,
        transformFiltersBeforeQuery: appendSystemInboxWorkspaceFilter,
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

WorkspaceTableContainer.propTypes = {
    arrayAction: PropTypes.array,
};
