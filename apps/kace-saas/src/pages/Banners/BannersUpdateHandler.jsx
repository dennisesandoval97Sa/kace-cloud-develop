import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { BANNERS_SERVICE } from "../../utils/URL"
import { initialValues } from "./helpers"
import { genericView } from "../../services/genericView"
import BannersForm from "./components/BannersForm"
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import useGeneralMutation from "../../hooks/useGeneralMutation"
import { genericHandleSendInformation } from "../../services/genericHandleSendInformation"
import { URL_AND_KEYS } from "../../utils/urlAndKeys"
import { format } from "date-fns"

export const BannersUpdateHandler = () => {
    const [banners, setBanners] = useState(initialValues)
    const { id } = useParams()
    const { mutate, isPending } = useGeneralMutation({
        keyQuery: URL_AND_KEYS.banners.key,
        path: "/banners"
    })
    const { data, isLoading } = useQuery({
        queryKey: ["bannersForm", id],
        queryFn: async () => genericView(`${BANNERS_SERVICE}/${id}`),
        enabled: !!id
    })

    const handleBanners = (values, setFormikErrors, setFormikStatus) => {
        values.fecha_inicio = format(values.fecha_inicio, "yyyy-MM-dd'T'00:00:00.000'Z'")
        values.fecha_fin = format(values.fecha_fin, "yyyy-MM-dd'T'23:00:00.000'Z'")
        const data = genericHandleSendInformation({
            values,
            urlService: BANNERS_SERVICE,
            setFormikErrors,
            setFormikStatus,
            pending: isPending
        })
        mutate(data)
    }
    useEffect(() => {
        if (data) {
            setBanners(data)
        }
    }, [data])
    return (
        <DashboardSectionCard>
            <BannersForm
                dataHandler={handleBanners}
                data={banners}
                isSending={isPending || isLoading}
            />
        </DashboardSectionCard>
    )
}
