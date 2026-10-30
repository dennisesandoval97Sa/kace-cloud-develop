import { useState } from "react";
import { sendInformation } from "../../../../../../services/generic-send-information.js";
import { getLocalStorageInfoUser } from "../../../../helpers.js";

import { useCalendarRefs } from "../calendar/useCalendarRefs.js";
import { useCalendarHandlers } from "../calendar/useCalendarHandlers.js";
import { useCalendarMutation } from "../calendar/useCalendarMutation.js";
import { useCalendarData } from "../calendar/useCalendarData.js";
import { useCalendarState } from "../calendar/useCalendarState.js";

const useCalendarScheduler = ({ idCase, admin }) => {
    const { idUser, idGroup } = getLocalStorageInfoUser();
    const { calendarRef, calendarApi } = useCalendarRefs();

    const [selectedShedule, setSelectedShedule] = useState(null);

    const { businessHours, holidays, eventData, timeSlots, businessData } =
        useCalendarData({ idUser, idGroup, idCase, selectedShedule, admin });

    const {
        mode,
        dateTime,
        visualMode,
        availableForm,
        setVisualMode,
        setAvailableForm,
        setAvailableCustomTitle,
        activeForm,
        setMode,
        setDateTime,
        setIdEvento,
    } = useCalendarState({ selectedShedule, idEvento: null });

    const { mutate, isPending } = useCalendarMutation({
        idUser,
        idCase,
        selectedShedule,
        setAvailableForm,
        sendInformation,
    });

    const {
        handleDateSelect,
        handleAppointment,
        handleEventClick,
        handleDayCellMount,
        holidayOnlyShow,
    } = useCalendarHandlers({
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
    });

    return {
        data: {
            eventData,
            businessHours,
            holidays,
            timeSlots,
            dateTime,
        },
        state: {
            visualMode,
            availableForm,
            holidayOnlyShow,
        },
        actions: {
            handleDateSelect,
            handleEventClick,
            handleAppointment,
            setSelectedShedule,
            setVisualMode,
            setIdEvento,
        },
        refs: {
            calendarRef,
        },
        utils: {
            handleDayCellMount,
        },
        status: {
            isLoading: isPending,
        },
    };
};

export default useCalendarScheduler;
