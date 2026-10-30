import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions"
import { GenerateCsvTableContainer } from "./components/GenerateCsv-table-container"
import useGenerateCsvAction from "./hooks/useGenerateCsvAction"
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import { useTranslation } from "react-i18next"
import usePermissionsUser from "../../hooks/usePermissionsUser"

export const GenerateCsvHandler = () => {
    const { handleDeleteGenerateCsv, handleSeeGenerateCsv } =
        useGenerateCsvAction()
    const { t } = useTranslation()
    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "csv-export-views",
        actions: [
            {
                name: "GenerateCsvDelete",
                label: `${t("app.forms.delete")}`,
                handler: handleDeleteGenerateCsv
            },
            {
                name: "GenerateCsvRead",
                label: `${t("app.forms.see")}`,
                handler: handleSeeGenerateCsv
            }
        ],
        nameCreate: "GenerateCsvCreate"
    })

    return (
        <DashboardSectionCard title="Generador CSV">
            <div className="flex flex-col gap-4">
                {canBeCreate && (
                    <DefaultIndexActions createUrl="/generate-csv/create" />
                )}
                <GenerateCsvTableContainer arrayAction={arrayAction} />
            </div>
        </DashboardSectionCard>
    )
}
