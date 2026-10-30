import { useQuery } from "@tanstack/react-query";
import { genericView } from "@/services/genericView";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const useInteractionEmail = (emailId) => {
    const { data, isLoading } = useQuery({
        queryKey: ["interactions-email", emailId],
        queryFn: () => genericView(`${URL_AND_KEYS.emails.url}/${emailId}`),
        enabled: Boolean(emailId),
        staleTime: 1000 * 60,
        retry: 1,
    });

    return {
        email: Array.isArray(data) ? data[0] : (data ?? null),
        isLoading,
    };
};
