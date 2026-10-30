import useGenericSearchQuery from "@/hooks/useGenericSearchQuery";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const useAdminInteractions = ({ caseId, filter, isActive }) => {
    const { data: interactions = [], isLoading: loadingInteractions } = useGenericSearchQuery({
        url: `${URL_AND_KEYS.interactions.associate}/search`,
        keyQuery: `admin-cases-${caseId}-interactions`,
        select: (data) => data?.data || [],
        filter,
        enabled: !!caseId && isActive,
    });

    return {
        interactions,
        loadingInteractions,
    };
};

export default useAdminInteractions;
