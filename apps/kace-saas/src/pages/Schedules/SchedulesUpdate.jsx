import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import ScheduleForm from "./components/ScheduleForm"
import useScheduleActions from "./hooks/useScheduleActions"

const SchedulesUpdate = () => {
    const { isPendingSend, handleSchedule, schedule, isEditing} = useScheduleActions()
    return (
        <DashboardSectionCard title="app.title.schedules">
            <ScheduleForm dataHandler={handleSchedule} data={schedule} isSending={isPendingSend} isEditing={isEditing}/>
        </DashboardSectionCard>
    )
}

export default SchedulesUpdate
