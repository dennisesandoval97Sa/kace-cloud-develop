import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { GENERATECSV_SERVICE } from "../../utils/URL"
import { initialValues } from "./helpers"
import { genericView } from "../../services/genericView"
import GenerateCsvForm from "./components/GenerateCsvForm"
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import useGeneralMutation from "../../hooks/useGeneralMutation"
import { genericHandleSendInformation } from "../../services/genericHandleSendInformation"
import { URL_AND_KEYS } from "../../utils/urlAndKeys"

export const GenerateCsvUpdateHandler = () => {
    const [generateCsv, setGenerateCsv] = useState(initialValues)
    const { id } = useParams()
    const { mutate, isPending } = useGeneralMutation({
        keyQuery: URL_AND_KEYS.generateCsv.key,
        path: "/generate-csv"
    })
    const { data, isLoading } = useQuery({
        queryKey: ["GenerateCsvForm", id],
        queryFn: async () => genericView(`${GENERATECSV_SERVICE}/${id}`),
        enabled: !!id
    })
    
    const combineDateAndTime = (dateObj, timeStr) => {
        if (!(dateObj instanceof Date) || isNaN(dateObj)) return null;
        if (!timeStr) return dateObj;
        const [hours, minutes] = timeStr.split(":").map(Number);
        const updated = new Date(dateObj.getTime());
        updated.setHours(hours, minutes, 0, 0);
        return updated.toISOString();
    };
    
    const handleGenerateCsv = (values, setFormikErrors, setFormikStatus) => {
        values.next_execution_at =  combineDateAndTime(values.next_execution_at, values.start_time);
        const data = genericHandleSendInformation({
            values,
            urlService: GENERATECSV_SERVICE,
            setFormikErrors,
            setFormikStatus,
            pending: isPending,
            fields: ['start_time']
        })
        mutate(data)
    }
    useEffect(() => {
        if (data) {
            setGenerateCsv(data)
        }
    }, [data])
    return (
        <DashboardSectionCard>
            <GenerateCsvForm
                dataHandler={handleGenerateCsv}
                data={generateCsv}
                isSending={isPending || isLoading}
            />
        </DashboardSectionCard>
    )
}
