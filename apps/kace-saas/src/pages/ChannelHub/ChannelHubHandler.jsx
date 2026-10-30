import { useTranslation } from "react-i18next";
import DefaultIndexActions from "@/components/core/DefaultIndexActions/DefaultIndexActions";
import usePermissionsUser from "@/hooks/usePermissionsUser";
import { ChannelHubTableContainer } from "./components/channel-hub-table-container";
import useActionsChannelHub from "./hooks/useActionsChannelHub";
import { ROUTES } from "@/config/routesDictionary";

export const buildChannelHubTableActions = ({ arrayAction, translate, handleRegister }) => {
    const canRegister = arrayAction.some((action) => action.permissionName === "ChannelHubUpdate");
    if (!canRegister) return arrayAction;

    return [
        ...arrayAction,
        {
            name: translate("channelHub.register"),
            permissionName: "ChannelHubUpdate",
            action: handleRegister,
            customizable: false,
            show: (row) => !row.original.channel_hub_connection_id,
        },
    ];
};

const ChannelHubHandler = () => {
    const { handleDelete, handleSee, handleUpdate, handleRegister } = useActionsChannelHub();
    const { t } = useTranslation();

    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "channel-hub",
        actions: [
            { name: "ChannelHubUpdate", label: t("app.forms.edit"), handler: handleUpdate },
            { name: "ChannelHubDelete", label: t("app.forms.delete"), handler: handleDelete },
            { name: "ChannelHubRead", label: t("app.forms.see"), handler: handleSee },
        ],
        nameCreate: "ChannelHubCreate",
    });

    const tableActions = buildChannelHubTableActions({ arrayAction, translate: t, handleRegister });

    return (
        <div className="flex flex-col gap-4">
            {canBeCreate && <DefaultIndexActions createUrl={ROUTES.CHANNEL_HUB_CREATE.path} />}
            <ChannelHubTableContainer arrayAction={tableActions} />
        </div>
    );
};

export default ChannelHubHandler;
