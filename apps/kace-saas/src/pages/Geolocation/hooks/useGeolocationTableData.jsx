import { useEffect, useMemo, useState } from "react";
import useSchemaFields from "@/hooks/useSchemaFields";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const useGeolocationTableData = ({ headersFilters = [] }) => {
    const [headers, setHeaders] = useState([])
    const { getSchemaField } = useSchemaFields();

    const dataHeaders = useMemo(() => getSchemaField(URL_AND_KEYS.geolocation.entity), []);

    const filterShowColumns = (columnData, columnShow) => {
        return columnData.filter((column) => {
            return columnShow.some(show => show.key === column.column_name)
        })
    }

    useEffect(() => {
        if (dataHeaders) {
            const dataHeadersFilter = filterShowColumns(
                dataHeaders,
                headersFilters
            )

            setHeaders([{
                column_name: "Name",
                data_type: "String",
                character_maximum_length: 100,
                relation: null,
                label: "Name"
            }, ...dataHeadersFilter])
        }
    }, [dataHeaders])

    return {
        headers
    }
}

export default useGeolocationTableData
