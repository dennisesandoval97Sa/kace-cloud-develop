import { useEffect, useMemo, useState } from "react";
import useGenericSearchQuery from "../../../hooks/useGenericSearchQuery";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import { filterShowColumns } from "../../../utils/FilterShowColumns";
import { INITIAL_HEADERS_ACTIONS } from "../data/constants";
import { handleState } from "../../../utils/main";
import { getSchemaFilter, SPECIAL_FIELDS } from "../../../services/createSchemaFilter";
import useSchemaFields from "@/hooks/useSchemaFields";

const processData = (data) => {
    return handleState(data.data);
};

const useActionsTable = () => {
    const [headers, setHeaders] = useState([]);
    const [columnsToFilter, setColumnsToFilter] = useState([]);
    const { getSchemaField } = useSchemaFields();

    const {
        data: dataTable,
        isLoading: isLoadingTable,
        refetch,
        isFetching,
        isError: tableError,
    } = useGenericSearchQuery({
        url: `${URL_AND_KEYS.actions.url}/search`,
        keyQuery: URL_AND_KEYS.actions.key,
        select: processData,
        pagination: {
            limit: 700,
            offset: 0,
        },
    });

    const schemaField = useMemo(() => getSchemaField(URL_AND_KEYS.actions.entity), []);

    useEffect(() => {
        if (schemaField) {
            const dataHeadersFilter = filterShowColumns(
                schemaField,
                INITIAL_HEADERS_ACTIONS,
            );
            const resultFilter = getSchemaFilter(schemaField, [
                {
                    column_name: "is_active",
                    field: SPECIAL_FIELDS.switch_state,
                },
            ], [
                "id",
                "state_id",
                "group_id",
                "responsible_id",
                "template_id",
                "mail_account_id",
                "advisor_list_id",
                "group_list_id",
                "ws_rest_flow_id",
                "model_update_id",
            ]);
            setColumnsToFilter(resultFilter);
            setHeaders(dataHeadersFilter);
        }
    }, [schemaField]);

    return {
        headers,
        dataTable,
        isLoadingTable,
        refetch,
        isFetching,
        errors: tableError,
        columnsToFilter,
    };
};

export default useActionsTable;
