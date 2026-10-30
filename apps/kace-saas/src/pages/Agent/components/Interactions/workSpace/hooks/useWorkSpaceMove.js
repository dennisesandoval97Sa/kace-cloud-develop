import useGeneralMutation from "@/hooks/useGeneralMutation";
import { isSystemInboxWorkspaceId } from "@/utils/systemInboxWorkspace";
import { API } from "@kace_v2/shared/constants/api.constants";

export const useWorkSpaceMove = (interactionId, activeGroupId) => {
    const { mutate, isPending } = useGeneralMutation({
        keyQuery: ["agent-interactions", activeGroupId],
        invalidateQueries: false,
        optimisticListUpdate: false,
    });

    const moveInteractionToWorkspace = (values, options = {}) => {
        if (!interactionId || !activeGroupId || isSystemInboxWorkspaceId(values.workspaceId)) {
            return Promise.resolve();
        }

        const payload = {
            id: interactionId,
            url: API.ENDPOINTS.INTERACTIONS_BULK.AGENT_MOVE,
            dataPost: {
                interaction_ids: [interactionId],
                workspace_id: values.workspaceId,
            },
        };

        return mutate(payload, options);
    };

    return {
        moveInteractionToWorkspace,
        isUpdatingInteractions: isPending,
    };
};
