import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions"
import AllowedConnectionsTableContainer from "./AllowedConnectionsTableContainer"
import useAllowedConnectionsActions from "./hooks/useAllowedConnectionsActions"
import AllowedConnectionsForm from "./components/AllowedConnectionsForm"
import usePermissionsUser from "../../hooks/usePermissionsUser"
import { useTranslation } from "react-i18next"

const AllowedConnections = () => {
    const {
        handleUpdateAllowedConnections,
        handleDeleteAllowedConnections,
        handleSeeAllowedConnections
    } = useAllowedConnectionsActions()
    const { t } = useTranslation()
    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "allowed-connections",
        actions: [
            { name: "AllowedConnectionUpdate", label: "Editar", handler: handleUpdateAllowedConnections },
            { name: "AllowedConnectionDelete", label: `${t("app.forms.delete")}`, handler: handleDeleteAllowedConnections },
            { name: "AllowedConnectionRead", label: `${t("app.forms.see")}`, handler: handleSeeAllowedConnections }
        ],
        nameCreate: "AllowedConnectionCreate"
    })
    return (
        <DashboardSectionCard title={"app.title.allowedConnections"}>
            <div className="flex flex-col gap-4">
                {canBeCreate && (
                    <DefaultIndexActions
                        buttonModal={<AllowedConnectionsForm />}
                        nameDataTestId="allowed_connections"
                    />
                )}
                <AllowedConnectionsTableContainer arrayAction={arrayAction} />
            </div>
        </DashboardSectionCard>
    );
}

export default AllowedConnections
