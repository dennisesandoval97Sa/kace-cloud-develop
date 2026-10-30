
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import GroupUpdateHandler from "./GroupsUpdateHandler"

const GroupUpdate = () => {
    return (
        <DashboardSectionCard title={"app.title.group"}>
            <GroupUpdateHandler />
        </DashboardSectionCard>
    )
}

export default GroupUpdate
