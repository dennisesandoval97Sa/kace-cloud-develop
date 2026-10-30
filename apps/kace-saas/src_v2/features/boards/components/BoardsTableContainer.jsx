import PropTypes from "prop-types";
import useDataTable from "@/hooks/useDataTable";
import DataTable from "@/componentsV2/core/DataTable";
import { dataTableConfig } from "../constants/boardsTable.constants";
import { processColumns, processData, processFilters } from "../utils/boardsDatatableProcess";

export const BoardsTableContainer = ({ arrayAction = [] }) => {
    /*
     * El backend recorta el listado al acceso efectivo del llamante (BoardSearcher recibe
     * el actor y lo traduce a SQL), asi que toda fila que llega aqui es operable: no hace
     * falta marcarla ni deshabilitar acciones en cliente.
     */
    const { renderData, query, filters, pagination, columnSelector } = useDataTable({
        dataTableConfig,
        actions: arrayAction,
        processColumns,
        processFilters,
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

BoardsTableContainer.propTypes = {
    arrayAction: PropTypes.array,
};

export default BoardsTableContainer;
