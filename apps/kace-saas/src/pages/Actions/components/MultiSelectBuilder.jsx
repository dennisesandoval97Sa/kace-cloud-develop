import { Label, MultiSelect } from "@kace/ui-shared"
import { apiService } from "@kace/utils"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { PropTypes } from "prop-types"

export const MultiSelectBuilder = ({
    url = "",
    listValues,
    setListValues,
    keyQuery = "",
    label = [],
    value = [],
    title = "",
    nameTesting = ""
}) => {
    const [dataGroups, setDataGroups] = useState([])
    const { t } = useTranslation()
    const { data: dataUsersList, isLoading } = useQuery({
        queryKey: [keyQuery],
        queryFn: () =>
            apiService.post(`${url}/search`, {
                limit: 0,
                offset: 0
            }),
        staleTime: 1000 * 60 * 60,
        refetchOnWindowFocus: false
    })
    const handleDataUsers = (data = []) => {
        const newArray = data.map((item) => {
            const valueFilter = value.map((val) => item[val])
            const labelFilter = label.map((val) => item[val])
            return {
                id: item.id,
                label: labelFilter.join(" "),
                value: valueFilter.join(" ")
            }
        })
        setDataGroups(newArray)
    }
    useEffect(() => {
        if (dataUsersList) {
            if (dataUsersList.data.data.items) {
                handleDataUsers(dataUsersList.data.data.items)
            } else {
                handleDataUsers(dataUsersList.data.data)
            }
        }
    }, [dataUsersList])
    return (
        <div className="w-full">
            <Label className="font-semibold">{title}</Label>
            <MultiSelect
                data={dataGroups}
                textSearch={t("classification.form.textSearchTemplates")}
                listValues={listValues}
                setListValues={setListValues}
                isLoading={isLoading}
                nameTesting={nameTesting}
            />
        </div>
    )
}

MultiSelectBuilder.propTypes = {
    url: PropTypes.string,
    listValues: PropTypes.array,
    setListValues: PropTypes.func,
    keyQuery: PropTypes.string,
    label: PropTypes.array,
    value: PropTypes.array,
    title: PropTypes.string,
    nameTesting: PropTypes.string
}
