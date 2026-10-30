import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import { FlowsForm } from "./components/FlowsForm"

const FlowsUpdate = () => {
    return (
        <DashboardSectionCard title={"app.title.flows"}>
            <FlowsForm
            />
        </DashboardSectionCard>
    )
}

export default FlowsUpdate
