import { useEffect, useMemo, useState } from "react";
import { filterShowColumns } from "../../../utils/FilterShowColumns"
import {
    handleState,
    handleStateTimer
} from "../../../utils/src/utils/FormatData"
import useGenericSearchQuery from "../../../hooks/useGenericSearchQuery"
import { URL_AND_KEYS } from "../../../utils/urlAndKeys"
import { HEADERS_CONSTANT_GROUP_LIST } from "../data/constants"
import { getSchemaFilter, SPECIAL_FIELDS } from "../../../services/createSchemaFilter"
import useSchemaFields from "@/hooks/useSchemaFields";

const processData = (data) => {
    return handleStateTimer(handleState(data.data))
}

const useGroupListTable = () => {
    const [headers, setHeaders] = useState([])
    const [columnsToFilter, setColumnsToFilter] = useState([])
    const { getSchemaField } = useSchemaFields();

    const {
        data: dataTable,
        isLoading: isLoadingTable,
        refetch,
        isFetching,
        isError: tableError
    } = useGenericSearchQuery({
        url: `${URL_AND_KEYS.groupLists.url}/search`,
        keyQuery: URL_AND_KEYS.groupLists.key,
        select: processData
    })

    const schemaField = useMemo(() => getSchemaField(URL_AND_KEYS.groupLists.entity), []);

    useEffect(() => {
        if (schemaField) {
            const dataHeadersFilter = filterShowColumns(
                schemaField,
                HEADERS_CONSTANT_GROUP_LIST
            )
            const resultFilter = getSchemaFilter(schemaField, [
                {
                    column_name: "is_active",
                    field: SPECIAL_FIELDS.switch_state
                }
            ], ["id"])
            setColumnsToFilter(resultFilter)
            setHeaders(dataHeadersFilter)
        }
    }, [schemaField])

    return {
        headers,
        dataTable,
        isLoadingTable,
        refetch,
        isFetching,
        errors: tableError,
        columnsToFilter
    }
}

export default useGroupListTable
