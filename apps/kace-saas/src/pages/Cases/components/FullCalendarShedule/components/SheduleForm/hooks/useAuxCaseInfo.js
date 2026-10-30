import useGenericViewQuery from "../../../../../../../hooks/useGenericViewQuery";
import { AUX_CASES_SERVICE } from "../../../../../../../utils/main";

export const useAuxCaseInfo = (idCase, info) => {
    return useGenericViewQuery({
        keyQuery: "dataAuxCaseAgend",
        searchById: [idCase, info],
        url: `${AUX_CASES_SERVICE}/${idCase}`,
        enabled: !!idCase,
        staleTime: 0,
        gcTime: 1000 * 60 * 5,
    });
};
