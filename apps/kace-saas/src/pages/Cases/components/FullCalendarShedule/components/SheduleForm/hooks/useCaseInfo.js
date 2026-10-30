import useGenericViewQuery from "../../../../../../../hooks/useGenericViewQuery";
import { CASES_SERVICE } from "../../../../../../../utils/main";

export const useCaseInfo = (idCase, isCalendarRoute) => {
    return useGenericViewQuery({
        keyQuery: "caseInfo",
        searchById: [idCase],
        url: `${CASES_SERVICE}/${idCase}`,
        enabled: !!idCase && isCalendarRoute,
        staleTime: 0,
        gcTime: 1000 * 60 * 5,
    });
};
