import { useEffect, useMemo, useState } from "react";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import { getSchemaFilter, SPECIAL_FIELDS } from "../../../services/createSchemaFilter";
import {
    createChildren,
    handleASeniority,
    handleFullName,
    handleState,
    handleStateTimer,
} from "../../../utils/src/utils/FormatData";
import useGenericSearchQuery from "../../../hooks/useGenericSearchQuery";
import { filterShowColumns } from "../../../utils/FilterShowColumns";
import {
    HEADERS_CONSTANT_MASSIVE_EXECUTION_CASES,
    MASSIVE_EXECUTION_CASES_FILTER_LABELS,
    MASSIVE_EXECUTION_CASES_LABELS,
} from "../data/constants";
import { useIsFetching } from "@tanstack/react-query";
import useSchemaFields from "@/hooks/useSchemaFields";

const processData = (data) => {
    return handleStateTimer(handleASeniority(handleFullName(createChildren(handleState(data.data)), "allCases")));
};

const useMassiveExecutionCasesTable = () => {
    const { getSchemaField } = useSchemaFields();
    const isFetchingMassiveExecution = useIsFetching({
        queryKey: [URL_AND_KEYS.actionJobs.actionJobsFilterCases],
    });

    const [headers, setHeaders] = useState([]);
    const [columnsToFilter, setColumnsToFilter] = useState([]);

    const {
        data: dataTable,
        refetch,
        isFetching,
        isError: tableError,
    } = useGenericSearchQuery({
        url: `${URL_AND_KEYS.cases.url}/search`,
        keyQuery: URL_AND_KEYS.actionJobs.actionJobsFilterCases,
        select: processData,
        useDefault: false,
        enabled: false,
    });

    const schemaField = useMemo(() => getSchemaField(URL_AND_KEYS.cases.entity), []);

    useEffect(() => {
        if (schemaField) {
            const dataHeadersFilter = filterShowColumns(schemaField, HEADERS_CONSTANT_MASSIVE_EXECUTION_CASES);
            const modifiedDataHeaders = dataHeadersFilter.map((row) => {
                if (row.column_name === "estado_actual") {
                    return {
                        ...row,
                        column_name: "estadoActual",
                    };
                }
                const label = MASSIVE_EXECUTION_CASES_LABELS[row.column_name];
                const labeledRow = label ? { ...row, label } : row;
                return row.column_name === "nombre_cliente"
                    ? { ...labeledRow, column_name: "nombreCliente" }
                    : labeledRow;
            });
            const newSchemaResult = schemaField.map((row) => {
                if (row.column_name === "estado_actual") {
                    return {
                        ...row,
                        column_name: "estadoActual",
                    };
                }
                const label = MASSIVE_EXECUTION_CASES_FILTER_LABELS[row.column_name];
                return label ? { ...row, label } : row;
            });
            const lastElement = modifiedDataHeaders.pop();
            modifiedDataHeaders.unshift(lastElement);
            const resultFilter = getSchemaFilter(
                newSchemaResult,
                [
                    {
                        column_name: "nivel1",
                        field: SPECIAL_FIELDS.classification_levels,
                    },
                ],
                [
                    "nivel2",
                    "nivel3",
                    "nivel4",
                    "nivel5",
                    "nivel6",
                    "nivel7",
                    "nivel8",
                    "nivel9",
                    "nivel10",
                    "antiguedad",
                    "login",
                    "caso_clonado_id",
                    "id",
                    "antiguedad_horas",
                    "antiguedad_dias",
                    "antiguedad_minutos",
                    "primer_apellido",
                    "segundo_apellido",
                    "usuario_inactivo",
                    "color_ans_inicial",
                    "color_ans_intermedio",
                    "color_ans_final",
                    "ans_posicion",
                    "cambio_estado_comentario_id",
                    "motivo_baja",
                    "responsable_nombre",
                ],
            );
            const lastElementFilter = resultFilter.pop();
            resultFilter.unshift(lastElementFilter);
            setColumnsToFilter(resultFilter);
            setHeaders(modifiedDataHeaders);
        }
    }, [schemaField]);

    return {
        headers,
        dataTable: dataTable || [],
        isLoadingTable: isFetchingMassiveExecution > 0,
        refetch,
        isFetching,
        errors: tableError,
        columnsToFilter,
    };
};

export default useMassiveExecutionCasesTable;
