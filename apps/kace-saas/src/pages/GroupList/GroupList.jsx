import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions"
import { GroupListTableContainer } from "./components/GroupListTableContainer"
import useGroupListActions from "./hooks/useGroupListActions"
import { GroupListForm } from "./components/GroupListForm"
import usePermissionsUser from "../../hooks/usePermissionsUser"
import { useTranslation } from "react-i18next"

const GroupList = () => {
    const { t } = useTranslation()
    const {
        handleDeleteGroupList,
        handleUpdateGroupList,
        handleSeeGroupList
    } = useGroupListActions()
    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "group-list",
        actions: [
            { name: "GroupListsUpdate", label: "Editar", handler: handleUpdateGroupList },
            { name: "GroupListsDelete", label: `${t("app.forms.delete")}`, handler: handleDeleteGroupList },
            { name: "GroupListsRead", label: `${t("app.forms.see")}`, handler: handleSeeGroupList }
        ],
        nameCreate: "GroupListsCreate"
    })
    return (
        <DashboardSectionCard title="app.title.groupList">
            <div className="flex flex-col gap-4">
                {canBeCreate && <DefaultIndexActions
                    buttonModal={
                        <GroupListForm />
                    }
                />}
                <GroupListTableContainer
                    arrayAction={arrayAction}
                />
            </div>
        </DashboardSectionCard>
    )
}

export default GroupList
