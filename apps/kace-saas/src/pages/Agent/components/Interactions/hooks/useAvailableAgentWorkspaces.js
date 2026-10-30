import { useMemo } from "react";
import useGenericGetQuery from "@/hooks/useGenericGetQuery";
import useUserInformation from "@/hooks/useUserInformation";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { excludeSystemInboxWorkspaces } from "@/utils/systemInboxWorkspace";

const selectAvailableWorkspaces = (response) => {
    const payload = response?.data?.data ?? response?.data ?? [];
    return Array.isArray(payload) ? payload : [];
};

export const useAvailableAgentWorkspaces = () => {
    const { user, active_group_id: activeGroupId } = useUserInformation();
    const hasActiveScope = Boolean(user?.id && activeGroupId);
    const query = useGenericGetQuery({
        url: `${URL_AND_KEYS.workspaces.url}/available`,
        keyQuery: ["agent-workspaces-available", activeGroupId],
        enabled: hasActiveScope,
        select: selectAvailableWorkspaces,
    });
    const workspaces = useMemo(() => excludeSystemInboxWorkspaces(query.data ?? []), [query.data]);

    return {
        ...query,
        activeGroupId,
        hasActiveScope,
        workspaces,
    };
};

export default useAvailableAgentWorkspaces;
