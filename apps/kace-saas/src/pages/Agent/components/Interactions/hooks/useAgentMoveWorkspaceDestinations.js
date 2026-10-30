import { useMemo } from "react";
import useGenericGetQuery from "@/hooks/useGenericGetQuery";
import useUserInformation from "@/hooks/useUserInformation";
import { excludeSystemInboxWorkspaces } from "@/utils/systemInboxWorkspace";
import { API } from "@kace_v2/shared/constants/api.constants";

export const agentMoveWorkspaceDestinationsKey = (userId, activeGroupId, interactionId) => [
    "agent-move-workspace-destinations",
    userId,
    activeGroupId,
    interactionId,
];

const selectMoveDestinations = (response) => {
    const payload = response?.data?.data ?? response?.data ?? [];
    return Array.isArray(payload) ? payload : [];
};

export const useAgentMoveWorkspaceDestinations = ({ interactionId, activeGroupId }) => {
    const { user } = useUserInformation();
    const hasActiveScope = Boolean(user?.id && activeGroupId && interactionId);
    const query = useGenericGetQuery({
        url: API.ENDPOINTS.INTERACTIONS_BULK.AGENT_MOVE_DESTINATIONS(interactionId),
        keyQuery: agentMoveWorkspaceDestinationsKey(user?.id, activeGroupId, interactionId),
        enabled: hasActiveScope,
        select: selectMoveDestinations,
    });
    const workspaces = useMemo(() => excludeSystemInboxWorkspaces(query.data ?? []), [query.data]);

    return {
        ...query,
        hasActiveScope,
        workspaces,
    };
};

export default useAgentMoveWorkspaceDestinations;
