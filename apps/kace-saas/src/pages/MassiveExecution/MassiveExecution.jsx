import { useTranslation } from "react-i18next"
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import MassiveExecutionTableContainer from "./components/MassiveExecutionTableContainer"
import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions"

const MassiveExecution = () => {
    const { t } = useTranslation()
    return (
        <DashboardSectionCard title={t("massiveExecution.title")}>
            <div className="flex flex-col gap-4">
                <DefaultIndexActions createUrl="/massive-execution/execute" />
                <MassiveExecutionTableContainer />
            </div>
        </DashboardSectionCard>
    )
}

export default MassiveExecution
