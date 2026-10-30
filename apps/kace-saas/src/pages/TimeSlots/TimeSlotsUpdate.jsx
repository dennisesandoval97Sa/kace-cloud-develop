
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import TimeSlotsUpdateHandler from "./TimeSlotsUpdateHandler"

const TimeSlotsUpdate = () => {
    return (
        <DashboardSectionCard title={"app.title.timeSlots"}>
            <TimeSlotsUpdateHandler />
        </DashboardSectionCard>
    )
}

export default TimeSlotsUpdate
