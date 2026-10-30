import { useMemo } from "react";
import useGenericViewQuery from "@kace/hooks/useGenericViewQuery";
import useAdminCaseParams from "../../../hooks/useAdminCaseParams";
import { CLIENT_SERVICE } from "../../../../../../../utils/URL";
import { URL_AND_KEYS } from "../../../../../../../utils/urlAndKeys";
import useAdminCaseCacheData from "../../../hooks/useAdminCaseCacheData";

const useAdminCaseClient = () => {
    const { userId } = useAdminCaseParams();
    const { caseCacheData } = useAdminCaseCacheData();

    const clientId = useMemo(
        () => userId || caseCacheData?.cliente_id,
        [userId, caseCacheData?.cliente_id],
    );

    return useGenericViewQuery({
        keyQuery: URL_AND_KEYS.clients.client,
        url: `${CLIENT_SERVICE}/${clientId}`,
        searchById: clientId,
        enabled: !!clientId,
        staleTime: 1000 * 60 * 30,
        gcTime: 1000 * 60 * 60,
    });
};

export default useAdminCaseClient;
