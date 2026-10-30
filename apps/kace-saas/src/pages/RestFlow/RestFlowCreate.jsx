import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import RestFlowsForm from "./components/RestFlowsForm"
import useRestFlowCreate from "./hooks/useRestFlowCreate"

export const RestFlowsCreate = () => {
    const {
        handleRestFlow,
        restFlows,
        isPending,
        isLoading
    } = useRestFlowCreate()

    return (
        <DashboardSectionCard>
            <RestFlowsForm
                dataHandler={handleRestFlow}
                data={restFlows}
                isSending={isPending || isLoading}
            />
        </DashboardSectionCard>
    )
}
