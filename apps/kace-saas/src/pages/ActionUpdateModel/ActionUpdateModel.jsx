import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions"
import { ActionUpdateModelForm } from "./components/ActionUpdateModelForm"
import { ActionUpdateModelTableContainer } from "./components/ActionUpdateModelTableContainer"
import useActionUpdateModelActions from "./hooks/useActionUpdateModelActions"
import { useTranslation } from "react-i18next"
import usePermissionsUser from "../../hooks/usePermissionsUser"

const ActionUpdateModel = () => {
    const { t } = useTranslation()
    const {
        handleDeleteActionUpdateModel,
        handleUpdateActionUpdateModel,
        handleSeeActionUpdateModel
    } = useActionUpdateModelActions()
    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "actions",
        actions: [
            { name: "ActionUpdate", label: "Editar", handler: handleUpdateActionUpdateModel },
            { name: "ActionDelete", label: `${t("app.forms.delete")}`, handler: handleDeleteActionUpdateModel },
            { name: "ActionRead", label: `${t("app.forms.see")}`, handler: handleSeeActionUpdateModel }
        ],
        nameCreate: "ActionCreate"
    })
    return (
        <DashboardSectionCard title="app.title.updateModel">
            <div className="flex flex-col gap-4">
                {canBeCreate &&
                    <DefaultIndexActions nameDataTestId="update"

                        buttonModal={
                            <ActionUpdateModelForm />
                        }
                    />
                }
                <ActionUpdateModelTableContainer
                    arrayAction={arrayAction}
                />
            </div>
        </DashboardSectionCard>
    )
}

export default ActionUpdateModel
