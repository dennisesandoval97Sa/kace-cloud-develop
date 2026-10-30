import useGeneralMutation from "@/hooks/useGeneralMutation";
import { genericHandleSendInformation } from "@/services/genericHandleSendInformation";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const useInteractionClient = (interactionId) => {
    const { mutate, isPending } = useGeneralMutation({
        keyQuery: "interactionsClientUpdate",
        path: URL_AND_KEYS.interactions.url,
    });

    const assignClient = ({ clientId }) => {
        if (!interactionId || !clientId) return;

        const payload = genericHandleSendInformation({
            values: {
                id: interactionId,
                client_id: clientId,
            },
            urlService: URL_AND_KEYS.interactions.url,
            pending: isPending,
        });

        mutate(payload);
    };

    return {
        assignClient,
        isPending,
    };
};
