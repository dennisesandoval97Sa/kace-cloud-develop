import { useQuery } from "@tanstack/react-query";
import { searchRelationDiaryGroup } from "../../../../../data/Queries";

export const useRelationGroup = (idGroup) => {
    return useQuery({
        queryKey: ["relationGroup", idGroup],
        queryFn: async () => {
            return searchRelationDiaryGroup(idGroup);
        },
        refetchOnWindowFocus: false,
        retry: 3,
        staleTime: 1000 * 60 * 60,
        enabled: !!idGroup,
    });
};
