import { apiService } from "@kace/utils";
import { API } from "@kace_v2/shared/constants/api.constants";
import { isSystemInboxWorkspaceId } from "@/utils/systemInboxWorkspace";

export const moveInteractions = ({ interaction_ids, workspace_id }) => {
    if (isSystemInboxWorkspaceId(workspace_id)) return Promise.resolve();
    return apiService.post(API.ENDPOINTS.INTERACTIONS_BULK.MOVE, { interaction_ids, workspace_id });
};

export const closeInteractions = ({ interaction_ids, motive }) =>
    apiService.post(API.ENDPOINTS.INTERACTIONS_BULK.CLOSE, { interaction_ids, motive });

export const deleteInteractions = ({ interaction_ids, motive }) =>
    apiService.post(API.ENDPOINTS.INTERACTIONS_BULK.DELETE, { interaction_ids, motive });
