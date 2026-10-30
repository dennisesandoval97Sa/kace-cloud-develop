import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard"
import WorkspacesHandler from "./WorkspacesHandler"

const Workspaces = () => {
    return (
        <DashboardSectionCard title="app.title.workspaces">
            <WorkspacesHandler />
        </DashboardSectionCard>
    )
}

export default Workspaces
