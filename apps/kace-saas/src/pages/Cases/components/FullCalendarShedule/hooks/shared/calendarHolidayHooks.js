import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

/**
 * Método que oculta los eventos que no son festivos y se encuentra en un día festivo
 * como lo son las franjas horarias la cuales se renderizan por dia de la semana [0,1,2,3,4,5,6]
 *
 * @param {event} info informacion del evento
 */
export const useHolidayDayCellHandler = (businessData) => {
    return useCallback(
        (info) => {
            const date = info.date.toISOString().split("T")[0];
            if (businessData?.holiday_dates?.includes(date)) {
                const bottomElement = info.el.querySelector(
                    ".fc-daygrid-day-bottom",
                );
                if (bottomElement) bottomElement.style.display = "none";
            }
        },
        [businessData],
    );
};

/**
 * Método para ocultar la celda de +numero de eventos en un día festivo
 * @param {*} info evento de fullcalendar.io
 */

export const useHolidayEventFilter = (businessData) => {
    return useCallback(
        (info) => {
            const date = info.event.start.toISOString().split("T")[0];
            if (
                businessData?.holiday_dates?.includes(date) &&
                !info.event?.extendedProps?.holiday
            ) {
                info.el.style.display = "none";
            }
        },
        [businessData],
    );
};

export const useHandleDateSelect = ({
    calendarApi,
    selectedShedule,
    setMode,
}) => {
    const { t } = useTranslation();

    return useCallback(
        (selectInfo) => {
            setMode(false);

            if (!selectedShedule) {
                toast.info(t("diary.calendar.appointment.message.selectDiary"));
                return;
            }

            if (selectInfo.allDay && selectInfo.view.type === "dayGridMonth") {
                calendarApi?.changeView("timeGridDay", selectInfo.startStr);
            } else {
                calendarApi?.unselect();
            }
        },
        [selectedShedule, calendarApi],
    );
};

/**
 * Method that adds Cypress test identifiers to FullCalendar elements
 */
export const useCalendarTestIds = () => {
    const dayCellTestIdHandler = useCallback((info) => {
        const date = info.date.toISOString().split("T")[0];
        const time = info.date.toTimeString().split(" ")[0].replace(/:/g, "-");

        info.el.setAttribute("data-testid", `daycell_${date}`);

        const eventsContainer = info.el.querySelector(".fc-daygrid-day-events");
        if (eventsContainer) {
            eventsContainer.setAttribute("data-testid", `daycell_events_${date}_${time}`);
        }
    }, []);

    const eventTestIdHandler = useCallback((info) => {
        info.el.setAttribute("data-testid", `event_${info.event.id}`);
    }, []);

    return {
        dayCellTestIdHandler,
        eventTestIdHandler,
    };
};
