import { useQuery } from "@tanstack/react-query";
import { AGENDA_SERVICE } from "../../../../../../utils/URL";
import { genericView } from "../../../../../../services/genericView";

export const useAgendaData = (selectedShedule) => {
    return useQuery({
        queryKey: ["isWeekendAgendas", selectedShedule],
        queryFn: async () => {
            return genericView(`${AGENDA_SERVICE}/${selectedShedule}`);
        },
        enabled: !!selectedShedule,
        staleTime: 0,
        gcTime: 1000 * 60 * 5,
    });
};
