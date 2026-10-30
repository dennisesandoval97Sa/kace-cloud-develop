import { useTranslation } from "react-i18next"
import { ClassificationTableContainer } from "./components/classification-table-container"
import useClassificationAction from "./hooks/useClassificationAction"
import usePermissionsUser from "@/hooks/usePermissionsUser"
import DefaultIndexActions from "@/components/core/DefaultIndexActions/DefaultIndexActions"
import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard"

const ClassificationsHandler = () => {
    const {
        handleAssingForm,
        handleDeleteClassification,
        handleSeeClassification,
        handleUpdateClassification,
        handleUpdateClassificationFlow,
    } = useClassificationAction()
    const { t } = useTranslation()
    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "classifications",
        actions: [
            {
                name: "ClassificationUpdate",
                label: "Editar",
                handler: handleUpdateClassification
            },
            {
                name: "ClassificationDelete",
                label: `${t("app.forms.delete")}`,
                handler: handleDeleteClassification
            },
            {
                name: "ClassificationRead",
                label: `${t("app.forms.see")}`,
                handler: handleSeeClassification
            },
        ],
        nameCreate: "ClassificationCreate"
    })
    return (
        <DashboardSectionCard
            title={"app.title.classifications"}
            data-testid="dashboardCardClassification"
        >
            <div className="flex flex-col gap-4">
                {canBeCreate && (
                    <DefaultIndexActions
                        createUrl="/clasificaciones/create"
                        nameDataTestId="classification_create"
                    />
                )}
                <ClassificationTableContainer
                    arrayAction={arrayAction}
                    handleAssingForm={handleAssingForm}
                    handleUpdateClassificationFlow={handleUpdateClassificationFlow}
                />
            </div>
        </DashboardSectionCard>
    )
}

export default ClassificationsHandler
