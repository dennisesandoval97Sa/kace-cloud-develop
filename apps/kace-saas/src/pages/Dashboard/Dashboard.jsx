import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import { DashboardHandler } from "./DashboardHandler"

const Dashboard = () => {
    return (
        <DashboardSectionCard title="app.title.dashboard">
            <DashboardHandler />
        </DashboardSectionCard>
    )
}

export default Dashboard
