import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@kace_v2/shared/constants/query-keys.constants";
import { fetchAns } from "@kace_v2/features/boards/services/ans.service";

const useAns = (enabled = false) => {
    return useQuery({
        queryKey: QUERY_KEYS.ANS.ROOT,
        queryFn: fetchAns,
        enabled: Boolean(enabled),
        staleTime: 15 * 60 * 1000,
    });
};

export default useAns;
