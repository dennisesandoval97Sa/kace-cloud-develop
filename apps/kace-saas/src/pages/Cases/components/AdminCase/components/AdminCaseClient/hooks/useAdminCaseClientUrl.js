import useConfigAgentData from "@kace/hooks/useConfigAgentData";
import useUserInformation from "@kace/hooks/useUserInformation";
import useAdminCaseParams from "../../../hooks/useAdminCaseParams";
import { useOneScriptUrl } from "../../../../../../Agent/components/TabsClientContainer/hooks/useOneScriptUrl";
import useAdminCaseCacheData from "../../../hooks/useAdminCaseCacheData";

export const useAdminCaseClientUrl = () => {
    const { clients: configClients } = useConfigAgentData();
    const { caseCacheData } = useAdminCaseCacheData();
    const { user } = useUserInformation();
    const { userId } = useAdminCaseParams();

    const { url, isLoading, formRef } = useOneScriptUrl({
        formId: configClients?.custom_form_id,
        clientId: userId || caseCacheData?.cliente_id,
        userId: user?.id,
    });

    return { url, isLoading, formRef };
};
