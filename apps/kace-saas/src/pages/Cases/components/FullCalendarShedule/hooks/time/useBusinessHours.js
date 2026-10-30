import { useQuery } from "@tanstack/react-query";
import { GROUP_SERVICE, SCHEDULES_SERVICE } from "../../../../../../utils/URL";
import { genericView } from "../../../../../../services/genericView";

export const useBusinessHours = (idUser, idGroup) => {
    return useQuery({
        queryKey: ["bussinessHours", idUser, idGroup],
        queryFn: async () => {
            return genericView(
                `${GROUP_SERVICE}/${idGroup}${SCHEDULES_SERVICE}`,
            );
        },
        enabled: !!idGroup,
        staleTime: 0,
        gcTime: 1000 * 60 * 5,
    });
};
