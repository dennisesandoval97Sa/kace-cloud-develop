import { useQueryClient } from "@tanstack/react-query";
import { URL_AND_KEYS } from "../../../../../utils/urlAndKeys";
import { useCallback, useEffect } from "react";
import useAdminCaseParams from "./useAdminCaseParams";

const useAdminCaseCacheData = () => {
    const queryClient = useQueryClient();
    const { caseId } = useAdminCaseParams();

    const caseCacheData = queryClient.getQueryState([
        URL_AND_KEYS.cases.byCaseId,
        caseId,
    ]);

    const descriptionCaseCacheData = queryClient.getQueryData([
        URL_AND_KEYS.cases.searchDescriptionCaseById,
        URL_AND_KEYS.cases.keyAdminCase,
    ]);

    const handleCacheData = useCallback(() => {
        queryClient.invalidateQueries({
            queryKey: [URL_AND_KEYS.cases.byAgentFilter],
        });
        queryClient.invalidateQueries({
            queryKey: [URL_AND_KEYS.cases.key],
        });
        queryClient.removeQueries({
            queryKey: [
                URL_AND_KEYS.cases.byCaseId,
                URL_AND_KEYS.classification.byClassificationId,
            ],
        });
        queryClient.removeQueries({
            queryKey: [
                URL_AND_KEYS.cases.searchDescriptionCaseById,
                URL_AND_KEYS.cases.keyAdminCase,
            ],
            exact: true,
        });
        queryClient.removeQueries({
            queryKey: [
                URL_AND_KEYS.cases.keyCaseDraft,
                URL_AND_KEYS.cases.keyAdminCase,
            ],
            exact: true,
        });
    }, []);

    useEffect(() => {
        if (caseCacheData?.data?.transicion_id) {
            localStorage.setItem("last_transition_id", caseCacheData.data.transicion_id);
        }
    }, [caseCacheData?.data?.transicion_id]);

    return {
        caseCacheData: caseCacheData?.data || {},
        descriptionCaseCacheData,
        handleCacheData,
        status: caseCacheData?.status,
    };
};

export default useAdminCaseCacheData;
