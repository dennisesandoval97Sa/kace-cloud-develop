import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import useGeneralMutation from "@/hooks/useGeneralMutation";
import { genericHandleSendInformation } from "@/services/genericHandleSendInformation";
import useUserInformation from "@/hooks/useUserInformation";

export const useAssociateInteractionCases = (interactionId, mutationConfig = {}) => {
    const { active_group_id: activeGroupId } = useUserInformation();
    const { mutate, isPending } = useGeneralMutation({
        keyQuery: ["associateInteractionCases", activeGroupId],
        path: URL_AND_KEYS.interactions.agent.associate,
        ...mutationConfig,
    });

    const associateInteractionCases = (values, options = {}) => {
        if (!interactionId || !activeGroupId) return;

        const payload = genericHandleSendInformation({
            values: {
                caso_id: values.caso_id,
                interaction_id: interactionId,
            },
            urlService: URL_AND_KEYS.interactions.agent.associate,
            pending: isPending,
            options: { generateId: false },
        });

        mutate(payload, options);
    };

    return {
        associateInteractionCases,
        isPending,
    };
};
