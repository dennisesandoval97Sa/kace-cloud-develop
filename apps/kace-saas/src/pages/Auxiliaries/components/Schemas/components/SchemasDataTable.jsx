import DataTable from "@/componentsV2/core/DataTable"
import useDataTable from "@/hooks/useDataTable"
import { dataTableConfig } from "../data/constants"
import PropTypes from "prop-types"
import { processColumns, processFilters, processData } from "../utils/schemasDataTable"

const SchemasDataTable = ({ actions = [] }) => {
    const { renderData, query, filters, pagination, columnSelector } =
        useDataTable({
            dataTableConfig,
            actions,
            processColumns,
            processFilters,
            processData
        })

    return (
        <DataTable
            renderData={renderData}
            query={query}
            filters={filters}
            pagination={pagination}
            columnSelector={columnSelector}
        />
    )
}

SchemasDataTable.propTypes = {
    actions: PropTypes.array
}

export default SchemasDataTable
