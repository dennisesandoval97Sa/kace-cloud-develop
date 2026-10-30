import { useTranslation } from "react-i18next"

import usePermissionsUser from "@kace/hooks/usePermissionsUser"

import { AutomationSettingsTableContainer } from "./components/AutomationSettingsTableContainer"
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions"
import useAutomationSettingsActions from "./hooks/useAutomationSettingsActions"

const AutomationSettings = () => {
    const {
        handleUpdateAutomationSettings,
        handleDeleteAutomationSettings,
        handleSeeAutomationSettings
    } = useAutomationSettingsActions()
    const { t } = useTranslation()

    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "automation-settings",
        actions: [
            { name: "AutomationSettingsUpdate", label: "Editar", handler: handleUpdateAutomationSettings },
            { name: "AutomationSettingsDelete", label: `${t("app.forms.delete")}`, handler: handleDeleteAutomationSettings },
            { name: "AutomationSettingsRead", label: `${t("app.forms.see")}`, handler: handleSeeAutomationSettings }
        ],
        nameCreate: "AutomationSettingsCreate"
    })

    return (
        <DashboardSectionCard title={t("app.title.automationSettings")}>
            <div className="flex flex-col gap-4">
                {canBeCreate && (
                    <DefaultIndexActions createUrl="/automation-settings/create" nameDataTestId="automation_settings" />
                )}
                <AutomationSettingsTableContainer arrayAction={arrayAction} />
            </div>
        </DashboardSectionCard>
    );
}

export default AutomationSettings
