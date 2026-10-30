import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions"
import useRolesActions from "./hooks/useRolesActions"
import { RolesTableContainer } from "./components/RolesTableContainer"
import { useTranslation } from "react-i18next"
import usePermissionsUser from "../../hooks/usePermissionsUser"

const Roles = () => {
    const { t } = useTranslation()
    const {
        handleDeleteRoles,
        handleUpdateRoles
    } = useRolesActions()
    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "roles",
        actions: [
            { name: "RolesUpdate", label: "Editar", handler: handleUpdateRoles },
            { name: "RolesDelete", label: `${t("app.forms.delete")}`, handler: handleDeleteRoles }
        ],
        nameCreate: "RolesCreate"
    })
    return (
        <DashboardSectionCard title={t("app.title.roles")}>
            <div className="flex flex-col gap-4">
                {canBeCreate &&
                    <DefaultIndexActions createUrl="/roles/create" nameDataTestId="roles" />
                }
                <RolesTableContainer
                    arrayAction={arrayAction}
                />
            </div>
        </DashboardSectionCard>
    )
}

export default Roles
