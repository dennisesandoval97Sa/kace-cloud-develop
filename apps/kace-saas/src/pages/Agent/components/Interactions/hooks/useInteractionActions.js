import useGeneralMutation from "@/hooks/useGeneralMutation";
import { API } from "@kace_v2/shared/constants/api.constants";

export const useInteractionActions = (interactionId, activeGroupId) => {
    const { mutate, isPending } = useGeneralMutation({
        keyQuery: ["agent-interactions", activeGroupId],
        invalidateQueries: false,
        optimisticListUpdate: false,
    });

    const closeInteraction = ({ motive } = {}) => {
        if (!interactionId || !activeGroupId || !motive) return Promise.resolve();

        return mutate({
            id: interactionId,
            url: API.ENDPOINTS.INTERACTIONS_BULK.AGENT_CLOSE,
            dataPost: {
                interaction_ids: [interactionId],
                motive,
            },
        });
    };

    return {
        isUpdatingInteractions: isPending,
        closeInteraction,
    };
};
