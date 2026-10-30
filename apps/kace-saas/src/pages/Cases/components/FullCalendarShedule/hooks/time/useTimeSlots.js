import { useQuery } from "@tanstack/react-query";
import { searchTimeSlot } from "../../../../data/Queries";

export const useTimeSlots = (selectedShedule) => {
    return useQuery({
        queryKey: ["timeSlots", selectedShedule],
        queryFn: async () => {
            return searchTimeSlot(selectedShedule);
        },
        enabled: !!selectedShedule,
    });
};
