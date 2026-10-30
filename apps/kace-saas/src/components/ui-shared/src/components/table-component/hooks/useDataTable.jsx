import {
    createChildren,
    handleASeniority,
    handleCountAns,
    handleEndpointType,
    handleFullName,
    handleFunctionType,
    handleGeolocationData,
    handleState,
    handleStateTimer
} from "@kace/utils"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { genericSearch } from "../../../../../../services/genericSearch"

const useDataTable = ({ keyQueryData, nameTable, filter = null, filterAlternate = [], customsfilters = [] }) => {
    const [nextCountItems, setNextCountItems] = useState(0)
    const [dataTable, setDataTable] = useState([])
    const [concatValues, setConcatValues] = useState(false)
    const [appliedFilter, setAppliedFilter] = useState(null)
    const [customFilter, setCustomFilter] = useState([])

    const { data, isLoading, refetch, isRefetching } = useQuery({
        queryKey: [keyQueryData],
        queryFn: async () => {
            return genericSearch(
                `${nameTable.table}/search`,
                [...customFilter, ...customsfilters],
                {
                    limit: 700,
                    offset: nextCountItems
                },
                nameTable.schemaFields,
                filterAlternate.length > 0 ? false : true

            )
        },
        retry: 2,
        refetchOnWindowFocus: false,
        enabled: !!appliedFilter || (customsfilters?.length > 0)
    })

    useEffect(() => {
        let newFilter = []
        if (filter) {
            if ("searchCasesParamsProps" in filter) {
                filter.searchCasesParamsProps.forEach((item) => {
                    const { valueToSearch } = item
                    const createFilter = {
                        field: item.column,
                        operator: item.value,
                        value: valueToSearch || "null",
                        type: "AND"
                    }
                    newFilter.push(createFilter)
                })
                setCustomFilter(newFilter)
                refetch()
            } else {
                setAppliedFilter(filter.column)
                if (filter.column === "estadoActual") {
                    const createFilter = {
                        field: `cases.${filter.column}`,
                        operator: "eq",
                        value: filter.value,
                        type: "OR"
                    }
                    newFilter.push(createFilter)
                } else if (filter.column === "ans_posicion") {
                    const allFilters = filter.value.map((item) => {
                        const createFilter = {
                            field: `cases.${filter.column}`,
                            operator: "eq",
                            value: item,
                            type: "AND"
                        }
                        return createFilter
                    })
                    newFilter = [...newFilter, ...allFilters]
                } else {
                    const { valueToSearch } = filter
                    const createFilter = {
                        field: `cases.${filter.column}`,
                        operator: filter.value,
                        value: valueToSearch || "null",
                        type: "AND"
                    }
                    newFilter.push(createFilter)
                }
            }
            setCustomFilter(newFilter)
        } else if (filterAlternate.length > 0) {
            setAppliedFilter(filterAlternate[0].field)
            setCustomFilter(filterAlternate)
        } else {
            refetch()
        }
    }, [filter, nameTable])

    useEffect(() => {
        if (nextCountItems > 0) {
            setConcatValues(true)
            refetch()
        }
    }, [nextCountItems])

    useEffect(() => {
        if (data || customsfilters?.length > 0) {
            const processedData =
            handleFunctionType(
                handleEndpointType(
                    handleGeolocationData(
                        handleASeniority(
                            handleFullName(
                                handleCountAns(
                                    createChildren(
                                        handleStateTimer(handleState(data?.data || [])),
                                        keyQueryData
                                    ),
                                    keyQueryData
                                ),
                                keyQueryData
                            ),
                            keyQueryData
                        ),
                        keyQueryData
                    ),
                    keyQueryData
                ),
                keyQueryData
            )
            if (nextCountItems === 0 || !concatValues) {
                setDataTable(processedData)
            } else {
                setDataTable((prev) => [...prev, ...processedData])
                setConcatValues(false)
            }
        }
    }, [data])


    return { setNextCountItems, isLoading, dataTable, refetch, isRefetching }
}

export default useDataTable
