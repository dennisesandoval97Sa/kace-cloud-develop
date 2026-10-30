import { useTranslation } from "react-i18next"
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions"
import { GeneralSetupTableContainer } from "./components/GeneralSetupTableContainer"
import useActionsGeneralSetup from "./hooks/useActionGeneralSetup"
import usePermissionsUser from "../../hooks/usePermissionsUser"

const GeneralSetup = () => {
    const {
        handleUpdateGeneralSetup,
        handleDeleteGeneralSetup,
        handleSeeGeneralSetup
    } = useActionsGeneralSetup()
    const { t } = useTranslation()
    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "global-configurations",
        actions: [
            {
                name: "GlobalConfigurationsUpdate",
                label: "Editar",
                handler: handleUpdateGeneralSetup
            },
            {
                name: "GlobalConfigurationsDelete",
                label: `${t("app.forms.delete")}`,
                handler: handleDeleteGeneralSetup
            },
            {
                name: "GlobalConfigurationsRead",
                label: `${t("app.forms.see")}`,
                handler: handleSeeGeneralSetup
            }
        ],
        nameCreate: "GlobalConfigurationsCreate"
    })
    return (
        <DashboardSectionCard title={"app.title.generalSetup"}>
            <div className="flex flex-col gap-4">
                {canBeCreate && (
                    <DefaultIndexActions createUrl="/general-setup/create" nameDataTestId="general_setup" />
                )}
                <GeneralSetupTableContainer arrayAction={arrayAction} />
            </div>
        </DashboardSectionCard>
    )
}

export default GeneralSetup
