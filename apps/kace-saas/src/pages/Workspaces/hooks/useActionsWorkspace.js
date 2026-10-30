import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/config/routesDictionary";
import useGeneralDelete from "@/hooks/useGeneralDelete";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiService } from "@/utils/main";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { hasPendingChannelHubAccounts } from "../utils/channelHubRules";

const useActionsWorkspace = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { t } = useTranslation();
    const { mutate: deleteAction } = useGeneralDelete({
        keyQuery: URL_AND_KEYS.workspaces.key,
    });
    const { mutate: registerTagsAction, isPending: isRegisteringTags } = useMutation({
        mutationFn: async (workspace) => {
            return apiService.post(`${URL_AND_KEYS.workspaces.url}/${workspace.id}/channel-hub-tags/register`, {});
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [URL_AND_KEYS.workspaces.key] });
            toast.success(t("workspace.actions.registerTagsSuccess"));
        },
        onError: (error) => {
            queryClient.invalidateQueries({ queryKey: [URL_AND_KEYS.workspaces.key] });
            toast.error(error?.response?.data?.message ?? t("workspace.actions.registerTagsError"));
        },
    });

    const getWorkspaceFromActionArgs = (idOrWorkspace, _reference, workspace) => {
        if (workspace) return workspace;
        if (idOrWorkspace && typeof idOrWorkspace === "object") return idOrWorkspace;
        return { id: idOrWorkspace };
    };

    return {
        handleUpdateWorkspace: (id) => {
            navigate(`${ROUTES.WORKSPACE.path}/update/${id}`);
        },
        handleDeleteWorkspace: (id) => {
            deleteAction({ id, url: URL_AND_KEYS.workspaces.url });
        },
        handleSeeWorkspace: (id) => {
            navigate(`${ROUTES.WORKSPACE.path}/update/${id}?action=see`);
        },
        handleRegisterTags: (idOrWorkspace, reference, workspaceArg) => {
            const workspace = getWorkspaceFromActionArgs(idOrWorkspace, reference, workspaceArg);
            if (!workspace?.id) {
                toast.error(t("workspace.actions.registerTagsError"));
                return;
            }

            if (!workspace?.tag_creation_flow_id) {
                toast.error(t("workspace.actions.registerTagsMissingFlow"));
                return;
            }

            if (!hasPendingChannelHubAccounts(workspace)) {
                toast.error(t("workspace.actions.registerTagsAlreadyRegistered"));
                return;
            }

            registerTagsAction(workspace);
        },
        isRegisteringTags,
    };
};

export default useActionsWorkspace;
