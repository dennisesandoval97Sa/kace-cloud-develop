import { useParams } from "react-router-dom";
import useGenericViewQuery from "../../../../../../../hooks/useGenericViewQuery";
import { URL_AND_KEYS } from "../../../../../../../utils/urlAndKeys";
import { AdminCaseTransitionsProcessData } from "../utils/AdminCaseTransitionsProcessData";
import { useMemo } from "react";
import useAdminCaseCacheData from "../../../hooks/useAdminCaseCacheData";

const useAdminCaseTransitions = () => {
    const { caseId } = useParams();
    const { caseCacheData } = useAdminCaseCacheData();
    const createdByUserId = caseCacheData?.created_by;
    const caseCreatedAt = caseCacheData?.created_at ?? caseCacheData?.aux_case?.created_at;

    const { data, isLoading } = useGenericViewQuery({
        keyQuery: URL_AND_KEYS.transitions.byCaseId,
        url: `${URL_AND_KEYS.transitions.urlCaseTransitions}/${caseId}`,
        searchById: [caseId],
        staleTime: 0,
        gcTime: 0,
        options: {
            refetchOnMount: true,
        },
        enabled: !!caseId,
    });

    const { data: creatorData, isLoading: isLoadingCreator } = useGenericViewQuery({
        keyQuery: ["user-creator", createdByUserId],
        url: `${URL_AND_KEYS.users.url}/${createdByUserId}`,
        searchById: [createdByUserId],
        staleTime: 5 * 60 * 1000,
        enabled: !!createdByUserId,
    });

    const transitions = useMemo(
        () => AdminCaseTransitionsProcessData(data, creatorData, caseCreatedAt),
        [data, creatorData, caseCreatedAt],
    );

    return {
        transitions,
        loading: isLoading || isLoadingCreator,
    };
};

export default useAdminCaseTransitions;
