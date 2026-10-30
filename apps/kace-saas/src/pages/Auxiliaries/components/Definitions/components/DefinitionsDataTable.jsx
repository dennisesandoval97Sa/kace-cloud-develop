import DataTable from "@/componentsV2/core/DataTable"
import useDataTable from "@/hooks/useDataTable"
import PropTypes from "prop-types"
import { definitionsDataTableConfig } from "../constants"
import {
    processDefinitionsColumns,
    processDefinitionsFilters,
    processData as processDefinitiosData
} from "../utils/processDefinitiosData"

const DefinitionsDataTable = ({ actions = [] }) => {
    const { renderData, query, filters, pagination, columnSelector } =
        useDataTable({
            dataTableConfig: definitionsDataTableConfig,
            actions,
            processFilters: processDefinitionsFilters,
            processColumns: processDefinitionsColumns,
            processData: processDefinitiosData
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

DefinitionsDataTable.propTypes = {
    actions: PropTypes.array
}

export default DefinitionsDataTable
