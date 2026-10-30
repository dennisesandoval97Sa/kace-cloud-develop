import { useTranslation } from "react-i18next"
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions"
import usePermissionsUser from "../../hooks/usePermissionsUser"
import { OneScriptForm } from "./components/OneScriptForm"
import { OneScriptTableContainer } from "./components/OneScriptTableContainer"
import { useOneScriptActions } from "./hooks/useOneScriptActions"
export const OneScript = () => {
    const { t } = useTranslation()
    const {
        handleDeleteOneScript,
        handleUpdateOneScript,
        handleSeeOneScript
    } = useOneScriptActions()
    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "onescripts",
        actions: [
            { name: "OneScriptsUpdate", label: "Editar", handler: handleUpdateOneScript },
            { name: "OneScriptsDelete", label: `${t("app.forms.delete")}`, handler: handleDeleteOneScript },
            { name: "OneScriptsRead", label: `${t("app.forms.see")}`, handler: handleSeeOneScript }
        ],
        nameCreate: "OneScriptsCreate"
    })
    return (
        <DashboardSectionCard title="app.title.oneScript">
            <div className="flex flex-col gap-4">
                {canBeCreate && (
                    <DefaultIndexActions buttonModal={<OneScriptForm />} nameDataTestId="onescripts" id="onescripts" />
                )}
                <OneScriptTableContainer arrayAction={arrayAction} />
            </div>
        </DashboardSectionCard>
    )
}

