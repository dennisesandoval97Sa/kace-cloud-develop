import { Card, CardContent, CardHeader, CardTitle } from "@kace/ui-shared"
import { TableContainer } from "./TableContainer"
import { useQuery } from "@tanstack/react-query"
import { genericView } from "../../../services/genericView"
import { useEffect, useState } from "react"

export const CardTableResponsible = () => {
    const [headers, setHeaders] = useState([])
    const [dataTable, setDataTable] = useState([])
    const { data, isLoading } = useQuery({
        queryKey: ['casesByResponsible'],
        queryFn: async () => genericView("/cases-count-by-responsable"),
        staleTime: 1000 * 60 * 60,
        refetchOnWindowFocus: false,
    })

    const handleCreateDataTable = (data = {}) => {
        const columns = new Set();
        const newDataFormat = [];
        columns.add("responsable");

        Object.values(data).forEach((item) => {
            const newRow = {};
            const { nombre, estados, id } = item;
            newRow["id"] = id;
            newRow["responsable"] = nombre;
            estados.forEach((currentState) => {
                const { estado, count } = currentState;
                if (!columns.has(estado)) {
                    columns.add(estado);
                }
                newRow[estado] = (newRow[estado] || 0) + count;
            });
            columns.forEach((col) => {
                if (!newRow[col]) {
                    newRow[col] = 0;
                }
            });

            newDataFormat.push(newRow);
        });

        setDataTable(newDataFormat);
        setHeaders([...columns]);
    };


    useEffect(() => {
        if (data) {
            handleCreateDataTable(data.responsible)
        }
    }, [data])
    return (
        <Card className="w-full h-auto">
            <CardHeader id="card_title_responsible" data-testid="card_title_responsible">
                <CardTitle>Tabla de casos por responsable</CardTitle>
            </CardHeader>
            <CardContent id="card_table_responsible" data-testid="card_table_responsible">
                <TableContainer dataTable={dataTable} columns={headers} loading={isLoading} />
            </CardContent>
        </Card>
    )
}
