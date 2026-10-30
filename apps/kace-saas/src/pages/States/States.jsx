import { useTranslation } from "react-i18next"
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions"
import usePermissionsUser from "../../hooks/usePermissionsUser"
import { StatesForm } from "./components/StatesForm"
import { StatesTableContainer } from "./components/StatesTableContainer"
import useStatesActions from "./hooks/useStatesActions"

const States = () => {
    const { t } = useTranslation()
    const {
        handleDeleteState, handleSeeState, handleUpdateState
    } = useStatesActions()
    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "state",
        actions: [
            { name: "StatesRead", label: `${t("app.forms.see")}`, handler: handleSeeState },
            { name: "StatesUpdate", label: "Editar", handler: handleUpdateState },
            { name: "StatesDelete", label: `${t("app.forms.delete")}`, handler: handleDeleteState }
        ],
        nameCreate: "StatesCreate"
    })
    return (
        <DashboardSectionCard title="app.title.states">
            <div className="flex flex-col gap-4">
                {canBeCreate &&
                <DefaultIndexActions
                    buttonModal={
                        <StatesForm
                        />
                    }
                />
                }
                <StatesTableContainer
                    arrayAction={arrayAction}
                />
            </div>
        </DashboardSectionCard>
    )
}

export default States
