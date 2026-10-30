import { useMemo } from "react";
import PropTypes from "prop-types";
import DataTable from "@/componentsV2/core/DataTable";
import useDataTable from "@/hooks/useDataTable";
import { processColumns, processFilters, processData, buildClientsSearchQuery } from "../utils/clientsDataTable";
import { clientDataTableConfig } from "../data/aux_clients";

/*
 * Una sola forma de consulta: base `clients` + join a `aux_clients`. Filtre el usuario por
 * columnas nativas o por datos del auxiliar, la vista previa y el lote que ejecuta el backend
 * salen del mismo `buildClientsSearchQuery`, asi que no pueden discrepar.
 */
const AuxClientsFilterPreviewDataTable = ({ tableFilters }) => {
    const { filter, relationship } = useMemo(() => buildClientsSearchQuery(tableFilters), [tableFilters]);

    const { renderData, query, pagination } = useDataTable({
        dataTableConfig: clientDataTableConfig,
        actions: [],
        processColumns,
        processFilters,
        processData,
        tableFilters: filter,
        relationship,
    });

    return (
        <DataTable renderData={renderData} query={{ ...query, refetch: null }} filters={[]} pagination={pagination} />
    );
};

AuxClientsFilterPreviewDataTable.propTypes = {
    tableFilters: PropTypes.array,
};

export default AuxClientsFilterPreviewDataTable;
