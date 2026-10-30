import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions"
import useActionsGroup from "./hooks/useActionsGroup"
import { GroupTableContainer } from "./components/group-table-container"
import usePermissionsUser from "../../hooks/usePermissionsUser"
import { useTranslation } from "react-i18next"

const GroupsHandler = () => {
    const { handleDeleteGroup, handleUpdateGroup, handleSeeGroup } = useActionsGroup()
    const { t } = useTranslation()
    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "groups",
        actions: [
            {
                name: "GroupsUpdate",
                label: "Editar",
                handler: handleUpdateGroup
            },
            {
                name: "GroupsDelete",
                label: `${t("app.forms.delete")}`,
                handler: handleDeleteGroup
            },
            {
                name: "GroupsRead",
                label: `${t("app.forms.see")}`,
                handler: handleSeeGroup
            }
        ],
        nameCreate: "GroupsCreate"
    })
    return (
        <div className="flex flex-col gap-4">
            {canBeCreate && <DefaultIndexActions createUrl="/group/create" nameDataTestId="group" />}
            <GroupTableContainer arrayAction={arrayAction} />
        </div>
    );
}

export default GroupsHandler
