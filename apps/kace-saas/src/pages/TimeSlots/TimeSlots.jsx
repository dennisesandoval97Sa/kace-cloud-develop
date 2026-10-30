
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import TimeSlotsHandler from "./TimeSlotsHandler"

const TimeSlots = () => {
    return (
        <DashboardSectionCard title="app.title.timeSlots">
            <TimeSlotsHandler />
        </DashboardSectionCard>
    )
}

export default TimeSlots
