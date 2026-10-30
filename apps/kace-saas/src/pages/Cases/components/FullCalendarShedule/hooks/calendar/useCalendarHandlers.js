import {
    useHandleDateSelect,
    useHolidayDayCellHandler,
    useHolidayEventFilter,
} from "../shared/calendarHolidayHooks";
import { useHandleAppointment } from "../events/useAppointmentHandler";
import { useEventClickHandler } from "../events/useEventClickHandler";

export const useCalendarHandlers = ({
    idCase,
    selectedShedule,
    calendarApi,
    mode,
    mutate,
    setIdEvento,
    setVisualMode,
    setAvailableCustomTitle,
    setMode,
    setDateTime,
    activeForm,
    businessData,
}) => {
    const handleDateSelect = useHandleDateSelect({
        calendarApi,
        selectedShedule,
        setMode,
    });

    const handleAppointment = useHandleAppointment({
        idCase,
        mode,
        mutate,
        setIdEvento,
        setVisualMode,
    });

    const handleEventClick = useEventClickHandler({
        businessData,
        setAvailableCustomTitle,
        setMode,
        setDateTime,
        selectedShedule,
        activeForm,
    });

    const handleDayCellMount = useHolidayDayCellHandler(businessData);
    const holidayOnlyShow = useHolidayEventFilter(businessData);

    return {
        handleDateSelect,
        handleAppointment,
        handleEventClick,
        handleDayCellMount,
        holidayOnlyShow,
    };
};
