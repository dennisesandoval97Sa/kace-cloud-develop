import { useEffect, useMemo, useState } from "react";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import {
    handleFullName,
    handleState,
    handleStateTimer,
} from "../../../utils/src/utils/FormatData";
import useGenericSearchQuery from "../../../hooks/useGenericSearchQuery";
import { filterShowColumns } from "../../../utils/FilterShowColumns";
import { useIsFetching } from "@tanstack/react-query";
import { HEADERS_CONSTANT_MASSIVE_EXECUTION_CLIENTS } from "../data/constants";
import useSchemaFields from "@/hooks/useSchemaFields";

const processData = (data) => {
    return handleStateTimer(handleFullName(handleState(data.data), "allCases"));
};

const useMassiveExecutionClientsTable = () => {
    const [headers, setHeaders] = useState([]);
    const { getSchemaField } = useSchemaFields();

    const isFetchingMassiveExecution = useIsFetching({
        queryKey: [
            URL_AND_KEYS.actionJobs.actionJobsFilterClients,
        ],
    });

    const {
        data: dataTable,
        refetch,
        isFetching,
        isError: tableError,
    } = useGenericSearchQuery({
        url: `${URL_AND_KEYS.clients.url}/search`,
        keyQuery:
            URL_AND_KEYS.actionJobs.actionJobsFilterClients,
        select: processData,
        useDefault: false,
        enabled: false,
    });

    const schemaField = useMemo(() => getSchemaField(URL_AND_KEYS.clients.entity), []);

    useEffect(() => {
        if (schemaField) {
            const dataHeadersFilter = filterShowColumns(
                schemaField,
                HEADERS_CONSTANT_MASSIVE_EXECUTION_CLIENTS,
            );
            setHeaders(dataHeadersFilter);
        }
    }, [schemaField]);

    return {
        headers,
        dataTable: dataTable || [],
        isLoadingTable: isFetchingMassiveExecution > 0,
        refetch,
        isFetching,
        errors: tableError,
    };
};

export default useMassiveExecutionClientsTable;
