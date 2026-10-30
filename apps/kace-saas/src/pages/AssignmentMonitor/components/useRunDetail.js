import { useQuery } from "@tanstack/react-query";
import { genericView } from "../../../services/genericView";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";

const useRunDetail = (runId) => {
    const { data, isLoading, isError } = useQuery({
        queryKey: ["assignmentRunDetail", runId],
        queryFn: () => genericView(`${URL_AND_KEYS.assignmentRuns.url}/${runId}`),
        enabled: !!runId,
        refetchOnWindowFocus: false,
    });

    return { run: data ?? null, isLoading, isError };
};

export default useRunDetail;
