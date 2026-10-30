import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"

import { WS_REST_FUNCTIONS_SERVICE } from "@kace/urls"

import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import { genericHandleSendInformation } from "../../services/genericHandleSendInformation"
import { genericView } from "../../services/genericView"
import { INITIAL_VALUES_WS_REST_FUNCTIONS } from "./data/constants"
import RestFunctionsForm from "./components/RestFunctionsForm"
import useGeneralMutation from "../../hooks/useGeneralMutation"

export const RestFunctionsCreate = () => {
    const [restFunctions, setRestFunctions] = useState(INITIAL_VALUES_WS_REST_FUNCTIONS)
    const { id } = useParams()

    const { mutate, isPending } = useGeneralMutation({
        keyQuery: "wsRestFunctionsData",
        path: "/rest-functions"
    })

    const { data, isLoading } = useQuery({
        queryKey: ["wsRestFunctionsData", id],
        queryFn: async () => genericView(`${WS_REST_FUNCTIONS_SERVICE}/${id}`),
        enabled: !!id
    })

    const handleRestFunctions = (values, setFormikErrors, setFormikStatus) => {
        const data = genericHandleSendInformation({
            values,
            urlService: WS_REST_FUNCTIONS_SERVICE,
            setFormikErrors,
            setFormikStatus,
            pending: isPending,
            options: {
                keepId: true
            }
        })
        mutate(data)
    }

    useEffect(() => {
        if (data) {
            setRestFunctions(data)
        }
    }, [data])

    return (
        <DashboardSectionCard>
            <RestFunctionsForm
                dataHandler={handleRestFunctions}
                data={restFunctions}
                isSending={isPending || isLoading}
            />
        </DashboardSectionCard>
    )
}