import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions"
import { NotificationsAgentTableContainer } from "./components/NotificationsAgentTableContainer"
import useNotificationsAgentAction from "./hooks/useNotificationsAgentAction"
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import { useTranslation } from "react-i18next"
import usePermissionsUser from "../../hooks/usePermissionsUser"

const NotificationsAgent = () => {
    const {
        handleAssingForm,
        handleDeleteNotificationsAgent,
        handleSeeNotificationsAgent,
        handleUpdateNotificationsAgent
    } = useNotificationsAgentAction()
    const { t } = useTranslation()
    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "user-notifications",
        actions: [
            {
                name: "UserNotificationsUpdate",
                label: "Editar",
                handler: handleUpdateNotificationsAgent
            },
            {
                name: "UserNotificationsDelete",
                label: `${t("app.forms.delete")}`,
                handler: handleDeleteNotificationsAgent
            },
            {
                name: "UserNotificationsRead",
                label: `${t("app.forms.see")}`,
                handler: handleSeeNotificationsAgent
            }
        ],
        nameCreate: "UserNotificationsCreate"
    })
    return (
        <DashboardSectionCard
            title={"app.title.notificationsAgent"}
            data-testid="dashboardCardNotificationsAgent"
        >
            <div className="flex flex-col gap-4">
                {canBeCreate && (
                    <DefaultIndexActions
                        createUrl="/notifications-agent/create"
                        nameDataTestId="notifications_agent"
                    />
                )}
                <NotificationsAgentTableContainer
                    arrayAction={arrayAction}
                    handleAssingForm={handleAssingForm}
                />
            </div>
        </DashboardSectionCard>
    )
}

export default NotificationsAgent
