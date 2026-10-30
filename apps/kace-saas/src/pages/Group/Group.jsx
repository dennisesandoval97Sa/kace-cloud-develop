
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import GroupsHandler from "./GroupsHandler"

const Group = () => {
    return (
        <DashboardSectionCard title="app.title.group">
            <GroupsHandler />
        </DashboardSectionCard>
    )
}

export default Group
