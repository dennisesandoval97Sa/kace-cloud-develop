import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCalendarAppointments } from "./useCalendarAppointments";
import { useAgendaData } from "../shared/useAgendaData";
import { formatNewEvent } from "../../helpers/calendarHelpers";
import {
    createHoliday,
    formatTimeSlots,
    groupSchedules,
} from "../../../../helpers";
import { useBusinessHours } from "../time/useBusinessHours";
import { useTimeSlots } from "../time/useTimeSlots";

export const useCalendarData = ({
    idUser,
    idGroup,
    idCase,
    selectedShedule,
    admin,
}) => {
    const { t } = useTranslation();
    const [businessHours, setBusinessHours] = useState([]);
    const [holidays, setHolidays] = useState([]);
    const [eventData, setEventData] = useState([]);
    const [timeSlots, setTimeSlots] = useState([]);

    const { data: businessData, isSuccess: successBusiness } = useBusinessHours(
        idUser,
        idGroup,
    );
    const { data: appointmentsData } = useCalendarAppointments(
        idUser,
        idCase,
        selectedShedule,
        admin,
    );
    const { data: timeSlotsData, isSuccess: successTimeSlots } =
        useTimeSlots(selectedShedule);
    const { data: agendaData, isSuccess: successAgenda } =
        useAgendaData(selectedShedule);

    useEffect(() => {
        if (appointmentsData) {
            setEventData(formatNewEvent(appointmentsData));
        }
    }, [appointmentsData]);

    useEffect(() => {
        if (successBusiness) {
            setBusinessHours(groupSchedules(businessData.work_days));
            setHolidays(
                createHoliday(
                    businessData.holiday_dates,
                    t("diary.calendar.holiday.title"),
                ),
            );
        }
    }, [businessData, successBusiness]);

    useEffect(() => {
        if (successBusiness && successTimeSlots && successAgenda) {
            setTimeSlots(
                formatTimeSlots(
                    timeSlotsData.data,
                    businessData.work_days,
                    agendaData.is_for_weekend,
                ),
            );
        }
    }, [
        timeSlotsData,
        businessData,
        agendaData,
        successTimeSlots,
        successBusiness,
        successAgenda,
    ]);

    return {
        businessHours,
        holidays,
        eventData,
        timeSlots,
        businessData,
    };
};
