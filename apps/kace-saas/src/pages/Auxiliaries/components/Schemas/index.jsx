import { useTranslation } from "react-i18next"
import useAuxSchemaActions from "./hooks/useAuxSchemaActions"
import SchemasDataTable from "./components/SchemasDataTable"
import DefaultIndexActions from "@/components/core/DefaultIndexActions/DefaultIndexActions"
import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard"

const AuxSchemas = () => {
    const { t } = useTranslation()
    const { arrayAction, canBeCreate } = useAuxSchemaActions()

    return (
        <DashboardSectionCard title={t("app.title.auxSchemas")}>
            <div className="flex flex-col gap-4">
                {canBeCreate && <DefaultIndexActions createUrl="/aux/schemas/create" />}
                <SchemasDataTable actions={arrayAction} />
            </div>
        </DashboardSectionCard>
    )
}

export default AuxSchemas
