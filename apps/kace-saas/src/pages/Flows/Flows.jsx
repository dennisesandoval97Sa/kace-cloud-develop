import { useTranslation } from "react-i18next"
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions"
import usePermissionsUser from "../../hooks/usePermissionsUser"
import { FlowTableContainer } from "./components/FlowTableContainer"
import useFlowActions from "./hooks/useFlowActions"

const Flows = () => {
    const { handleDeleteFlow, handleSeeFlow, handleUpdateFlow } = useFlowActions()
    const { t } = useTranslation()
    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "flows",
        actions: [
            {
                name: "FlowsUpdate",
                label: "Editar",
                handler: handleUpdateFlow
            },
            {
                name: "FlowsDelete",
                label: `${t("app.forms.delete")}`,
                handler: handleDeleteFlow
            },
            {
                name: "FlowsRead",
                label: `${t("app.forms.see")}`,
                handler: handleSeeFlow
            }
        ],
        nameCreate: "FlowsCreate"
    })
    return (
        <DashboardSectionCard title="app.title.flows">
            <div className="flex flex-col gap-4">
                {canBeCreate && <DefaultIndexActions createUrl="/flujos/create" nameDataTestId="flows_create" />}
                <FlowTableContainer
                    arrayAction={arrayAction}
                />
            </div>
        </DashboardSectionCard>
    )
}
export default Flows
