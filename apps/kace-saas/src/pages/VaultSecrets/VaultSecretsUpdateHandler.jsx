import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "react-toastify"
import { useQuery } from "@tanstack/react-query"
import { api, handleLoading } from "@kace/utils"
import { FormSkeleton } from "@kace/ui"
import { formatDataBeforePost, initialValues } from "./helpers"
import VaultSecretsForm from ".components/VaultSecretsForm"
import { genericView } from "../../services/genericView"
import LookingForUpdatesIndicator from "../../components/core/LookingForUpdatesIndicator/LookingForUpdatesIndicator"
import { VAULT_SECRETS_SERVICE } from "../../utils/URL"
import { useTranslation } from "react-i18next"

const VaultSecretsUpdateHandler = () => {
    const { t } = useTranslation()
    const [ans, setAns] = useState(initialValues)
    const { id } = useParams()
    const { data, isLoading, isFetching } = useQuery({
        queryKey: ["vaultSecretsForm", id],
        queryFn: async () => genericView(`${VAULT_SECRETS_SERVICE}/${id}`),
        enabled: !!id,
    })
    const navigate = useNavigate()

    const handleAns = async (values) => {
        const { id } = values
        const url = id ? `${VAULT_SECRETS_SERVICE}/${id}` : `${VAULT_SECRETS_SERVICE}`
        try {
            const dataPost = formatDataBeforePost(values, id)
            handleLoading({ text: "" })
            const response = await api.post(url, dataPost)
            if ([200, 201].includes(response.status)) {
                navigate("/secrets-vaults")
                toast.success(t("app.alerts.done"))
            } else {
                toast.warn(t("app.alerts.unrealized"))
            }
        } catch {
            // NO-SONAR: En caso de error se enseña un error amigable para el usuario
            toast.warn(t("app.alerts.error"))
        } finally {
            handleLoading({ close: true })
        }
    }
    useEffect(() => {
        if (data) {
            setAns(data)
        }
    }, [data])
    return (
        <>
            {isLoading ? (
                <FormSkeleton />
            ) : (
                <VaultSecretsForm dataHandler={handleAns} data={ans} />
            )}
            <LookingForUpdatesIndicator isFetching={isFetching} />
        </>
    )
}

export default VaultSecretsUpdateHandler
