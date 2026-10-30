import { useTranslation } from "react-i18next"
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions"
import usePermissionsUser from "../../hooks/usePermissionsUser"
import { NotificationsClientTableContainer } from "./components/NotificationsClientTableContainer"
import useNotificationsClientAction from "./hooks/useNotificationsClientAction"

const NotificationsClient = () => {
    const {
        handleDeleteNotificationsClient,
        handleSeeNotificationsClient,
        handleUpdateNotificationsClient
    } = useNotificationsClientAction()
    const { t } = useTranslation()
    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "client-notifications",
        actions: [
            {
                name: "ClientNotificationsUpdate",
                label: "Editar",
                handler: handleUpdateNotificationsClient
            },
            {
                name: "ClientNotificationsDelete",
                label: `${t("app.forms.delete")}`,
                handler: handleDeleteNotificationsClient
            },
            {
                name: "ClientNotificationsRead",
                label: `${t("app.forms.see")}`,
                handler: handleSeeNotificationsClient
            }
        ],
        nameCreate: "ClientNotificationsCreate"
    })
    return (
        <DashboardSectionCard
            title={"app.title.notificationsClient"}
            data-testid="dashboardCardNotificationsClient"
        >
            <div className="flex flex-col gap-4">
                {canBeCreate && (
                    <DefaultIndexActions
                        createUrl="/notifications-client/create"
                        nameDataTestId="notifications_client"
                    />
                )}
                <NotificationsClientTableContainer
                    arrayAction={arrayAction}
                />
            </div>
        </DashboardSectionCard>
    )
}

export default NotificationsClient
