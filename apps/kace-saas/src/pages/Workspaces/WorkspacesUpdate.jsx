
import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard"
import WorkspacesUpdateHandler from "./WorkspacesUpdateHandler"

const WorkspacesUpdate = () => {
    return (
        <DashboardSectionCard title={"app.title.workspaces"}>
            <WorkspacesUpdateHandler />
        </DashboardSectionCard>
    )
}

export default WorkspacesUpdate
