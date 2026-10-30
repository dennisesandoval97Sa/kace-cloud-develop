import useGenericViewQuery from "../../../../../../../hooks/useGenericViewQuery";
import { AUX_CLIENT_SERVICE } from "../../../../../../../utils/main";

export const useAuxClientInfo = (clientId, classificationId) => {
    return useGenericViewQuery({
        keyQuery: "dataAuxClient",
        searchById: [clientId, classificationId],
        url: `${AUX_CLIENT_SERVICE}/${clientId}`,
        enabled: !!clientId,
        staleTime: 0,
        gcTime: 1000 * 60 * 5,
    });
};
