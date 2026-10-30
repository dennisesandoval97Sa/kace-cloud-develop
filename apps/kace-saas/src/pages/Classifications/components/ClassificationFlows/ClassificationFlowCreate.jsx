import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard";
import CreateClassificationFlowForm from "./CreateClassificationFlowForm"
import useClassificationFlowCreate from "../../hooks/useClassificationFlowCreate";

export const ClassificationFlowCreate = () => {
    const {
        handleClassificationFlow,
        flow,
        isPending,
        isLoading
    } = useClassificationFlowCreate();

    return (
        <DashboardSectionCard>
            <CreateClassificationFlowForm
                dataHandler={handleClassificationFlow}
                data={flow}
                isSending={isPending || isLoading}
            />
        </DashboardSectionCard>
    )
}
