import { useTranslation } from "react-i18next"
import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard"
import DefaultIndexActions from "@/components/core/DefaultIndexActions/DefaultIndexActions"
import useDefinitionsActions from "./hooks/useDefinitionsActions"
import DefinitionsDataTable from "./components/DefinitionsDataTable"
import DefinitionsForm from "./components/DefinitionsForm"

const Definitions = () => {
    const { t } = useTranslation()
    const { arrayAction, canBeCreate } = useDefinitionsActions()

    return (
        <DashboardSectionCard title={t("navbar.definitions")}>
            <div className="flex flex-col gap-4">
                {canBeCreate && (
                    <DefaultIndexActions buttonModal={<DefinitionsForm />} />
                )}

                <DefinitionsDataTable actions={arrayAction} />
            </div>
        </DashboardSectionCard>
    )
}

export default Definitions
