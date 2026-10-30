import { useTranslation } from "react-i18next";
import { FormOneScript } from "../../../../../components/core/FormOneScript/FormOneScript";
import { GeneralLoader } from "../../../../../components/ui-shared";
import useUserInformation from "../../../../../hooks/useUserInformation";
import { useAgentContext } from "../../../context/AgentContext";
import { useOneScriptUrl } from "../hooks/useOneScriptUrl";
import { useEffect } from "react";
import { ONESCRIPT_KONECTA_CLOUD } from "@/utils/URL";
import { useNavigate } from "react-router-dom";

export const AuxClientTab = () => {
    const { t } = useTranslation();
    const { user } = useUserInformation();
    const { clientId, configAgent } = useAgentContext();
    const { clients: configClients } = configAgent;
    const navigation = useNavigate();

    const { formRef, url, isLoading, error } = useOneScriptUrl({
        formId: configClients?.custom_form_id,
        clientId,
        userId: user?.id,
    });

    useEffect(() => {
        const handleMessage = (event) => {
            if (event.origin !== ONESCRIPT_KONECTA_CLOUD) return;
            const { type, payload } = event.data;
            if (type === "kaceCreateCase" && payload && payload?.client_id) {
                navigation(`/agent/create/${payload.client_id}?action=create&parent_id=null`);
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    if (isLoading) {
        return (
            <div className="flex flex-col justify-center items-center bg-background h-[calc(100vh-12rem)] p-2 border-input border rounded-md">
                <GeneralLoader />
                <p>{t("genericTexts.loading")}</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-redCustom p-4 bg-background border border-input rounded-md">
                <p>⚠️ {t("app.alerts.NoloadForm")}</p>
            </div>
        );
    }

    if (url) {
        return (
            <div className="flex flex-col gap-2 border-input border h-full rounded-md justify-between bg-background p-2">
                <div className="relative h-[calc(100vh-12rem)] p-2">
                    <FormOneScript key={clientId ?? ""} formRef={formRef} url={url} clientId={clientId} />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col justify-center items-center bg-background h-[calc(100vh-12rem)] p-2 border-input border rounded-md">
            <GeneralLoader />
            <p>{t("app.alerts.formAux")}</p>
        </div>
    );
};
