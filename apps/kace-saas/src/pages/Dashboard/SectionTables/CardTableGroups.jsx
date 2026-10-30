import {
    Card,
    CardContent,
    CardHeader,
    CardTitle
} from "@kace/ui-shared"
import { TableContainer } from "./TableContainer"
import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { genericView } from "../../../services/genericView"

export const CardTableGroups = () => {
    const [headers, setHeaders] = useState([])
    const [dataTable, setDataTable] = useState([])
    const { data, isLoading } = useQuery({
        queryKey: ["casesByGroups"],
        queryFn: async () => genericView("/cases-count-by-group"),
        staleTime: 1000 * 60 * 60,
        refetchOnWindowFocus: false
    })

    const handleCreateDataTable = (data = {}) => {
        const columns = new Set()
        const newDataFormat = []
        columns.add("grupos")

        Object.values(data).forEach((item) => {
            const newRow = {}
            const { nombre, estados, id } = item
            newRow.id = id
            newRow.grupos = nombre

            estados.forEach((currentState) => {
                const { estado, count } = currentState
                if (!columns.has(estado)) {
                    columns.add(estado)
                }
                newRow[estado] = (newRow[estado] || 0) + count
            })
            columns.forEach((col) => {
                if (!newRow[col]) {
                    newRow[col] = 0
                }
            })

            newDataFormat.push(newRow)
        })

        setDataTable(newDataFormat)
        setHeaders([...columns])
    }

    useEffect(() => {
        if (data) {
            handleCreateDataTable(data.groups)
        }
    }, [data])
    return (
        <Card className="w-full h-auto">
            <CardHeader id="card_title_groups" data-testid="card_title_groups">
                <CardTitle>Tabla de casos por grupos</CardTitle>
            </CardHeader>
            <CardContent id="card_table_groups" data-testid="card_table_groups">
                <TableContainer dataTable={dataTable} columns={headers} loading={isLoading} />
            </CardContent>
        </Card>
    )
}
