import { useEffect, useMemo, useState } from "react";
import {
    COLUMNS_NOT_SHOW_CLASSIFICATIONS,
    COLUMNS_NOT_SHOW_GROUPS,
    COLUMNS_NOT_SHOW_USERS,
    MODULES
} from "../data/Constants"
import { URL_AND_KEYS } from "../../../utils/urlAndKeys"
import { useTranslation } from "react-i18next"
import useSchemaFields from "@/hooks/useSchemaFields";

const useExportData = ({ module, isImport = false }) => {
    const currentModule = MODULES[module]?.key
    const { getSchemaField } = useSchemaFields();
    const [dataSchema, setDataSchema] = useState(null)
    const { t } = useTranslation()
    const [currentHeaders, setCurrentHeaders] = useState([])
    const schemaField = useMemo(() => getSchemaField(URL_AND_KEYS[currentModule].entity), []);
    const moduleObject = MODULES[module]
    const handleCurrentHeaders = () => {
        let filterColumns = []
        const keyColumns = dataSchema.map((column) => {
            return {
                value: column.column_name,
                label: t(`gridMain.columns.${column.label}`),
                type: column.data_type,
                nameColumn: column.column_name
            }
        })
        if (moduleObject.value === "usuarios") {
            filterColumns = keyColumns.filter(
                (item) => !COLUMNS_NOT_SHOW_USERS.includes(item.value),
            );
            if (isImport) {
                const idColumn = keyColumns.find((c) => c.value === "id");
                if (idColumn) {
                    filterColumns = filterColumns.filter((c) => c.value !== "id");
                    filterColumns.unshift({ ...idColumn, required: true });
                }
            }
        }
        if (moduleObject.value === "grupos") {
            filterColumns = keyColumns.filter(
                (item) => !COLUMNS_NOT_SHOW_GROUPS.includes(item.value)
            )
        }
        if (moduleObject.value === "clasificaciones") {
            filterColumns = keyColumns.filter(
                (item) => !COLUMNS_NOT_SHOW_CLASSIFICATIONS.includes(item.value)
            )
        }
        if ((moduleObject.value === "usuarios" || moduleObject.value === "clasificaciones")) {
            filterColumns.push({
                value: "grupos",
                label: "Grupos",
                type: "String",
                nameColumn: "grupos"
            })
        }
        setCurrentHeaders(filterColumns)
    }
    useEffect(() => {
        if (dataSchema) {
            handleCurrentHeaders()
        }
    }, [dataSchema])
    useEffect(() => {
        if (schemaField) {
            setDataSchema(schemaField)
        }
    }, [schemaField])

    return { currentHeaders }
}

export default useExportData
