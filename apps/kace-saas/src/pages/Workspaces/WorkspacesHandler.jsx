import DefaultIndexActions from "@/components/core/DefaultIndexActions/DefaultIndexActions";
import useActionsWorkspace from "./hooks/useActionsWorkspace";
import { WorkspaceTableContainer } from "./components/WorkspaceTableContainer";
import usePermissionsUser from "@/hooks/usePermissionsUser";
import { useTranslation } from "react-i18next";
import { hasPendingChannelHubAccounts } from "./utils/channelHubRules";

const WorkspacesHandler = () => {
    const { handleDeleteWorkspace, handleUpdateWorkspace, handleSeeWorkspace, handleRegisterTags } =
        useActionsWorkspace();
    const { t } = useTranslation();
    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "workspaces",
        actions: [
            {
                name: "WorkspacesRegisterTags",
                permissionName: "WorkspacesUpdate",
                label: `${t("workspace.actions.registerTags")}`,
                handler: handleRegisterTags,
                show: (row) =>
                    Boolean(row?.original?.tag_creation_flow_id) && hasPendingChannelHubAccounts(row?.original),
            },
            {
                name: "WorkspacesUpdate",
                label: `${t("app.forms.update")}`,
                handler: handleUpdateWorkspace,
            },
            {
                name: "WorkspacesDelete",
                label: `${t("app.forms.delete")}`,
                handler: handleDeleteWorkspace,
            },
            {
                name: "WorkspacesRead",
                label: `${t("app.forms.see")}`,
                handler: handleSeeWorkspace,
            },
        ],
        nameCreate: "WorkspacesCreate",
    });
    return (
        <div className="flex flex-col gap-4">
            {canBeCreate && <DefaultIndexActions createUrl="/workspaces/create" nameDataTestId="workspaces" />}
            <WorkspaceTableContainer arrayAction={arrayAction} />
        </div>
    );
};

export default WorkspacesHandler;
