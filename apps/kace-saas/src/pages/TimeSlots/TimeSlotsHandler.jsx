import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions"
import useActionsTimeSlots from "./hooks/useActionsTimeSlots"
import { TimeSlotsTableContainer } from "./components/TimeSlotsTableContainer"

const TimeSlotsHandler = () => {
    const { arrayAction, canBeCreate } = useActionsTimeSlots()
    return (
        <div className="flex flex-col gap-4">
            {canBeCreate && (
                <DefaultIndexActions createUrl="/appointment-time-slots/create" nameDataTestId="time_slots" />
            )}
            <TimeSlotsTableContainer arrayAction={arrayAction} />
        </div>
    );
}

export default TimeSlotsHandler
