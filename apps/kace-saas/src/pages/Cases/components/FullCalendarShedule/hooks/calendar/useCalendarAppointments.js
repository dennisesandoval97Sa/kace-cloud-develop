import { useQuery } from "@tanstack/react-query";
import { searchAppointments } from "../../../../data/Queries";

export const useCalendarAppointments = (
    idUser,
    idCase,
    selectedShedule,
    admin,
) => {
    return useQuery({
        queryKey: ["calendar", idUser, idCase, selectedShedule],
        queryFn: async () => {
            return searchAppointments(idCase, idUser, admin, selectedShedule);
        },
        enabled: !!selectedShedule,
        staleTime: 0,
        gcTime: 1000 * 60 * 5,
    });
};
