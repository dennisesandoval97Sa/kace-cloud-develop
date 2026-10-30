import PropTypes from "prop-types"
import FullCalendar from "@fullcalendar/react"
import interactionPlugin from "@fullcalendar/interaction"
import enLocale from "@fullcalendar/core/locales/en-gb"
import esLocale from "@fullcalendar/core/locales/es"
import timeGridPlugin from "@fullcalendar/timegrid"
import dayGridPlugin from "@fullcalendar/daygrid"
import { useTranslation } from "react-i18next"
import { EventShedule } from "./EventShedule"
import { useCalendarTestIds } from "../../hooks/shared/calendarHolidayHooks"
import { assignCalendarButtonTestIds } from "../../helpers/assignCalendarBtnTestIds"

export const CalendarView = ({
    handleDateSelect,
    handleEventClick,
    calendarRef,
    businessHours,
    holidays,
    events,
    timeSlots,
    visualMode,
    holidayOnlyShow,
    handleDayCellMount
}) => {
    const { t } = useTranslation()

    const {
        dayCellTestIdHandler,
        eventTestIdHandler
    } = useCalendarTestIds()

    const dayCellDidMount = (info) => {
        dayCellTestIdHandler(info)
        handleDayCellMount?.(info)
    }

    const eventDidMount = (info) => {
        eventTestIdHandler(info)
        holidayOnlyShow?.(info)
    }

    const handleViewDidMount = () => {
        assignCalendarButtonTestIds()
    }

    return (
        <div className="flex-1 overflow-y-auto">
            <FullCalendar
                ref={calendarRef}
                id="calendar_view"
                data-testid="calendar_view"
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                headerToolbar={{
                    left: "prev,next today",
                    center: "title",
                    right: "dayGridMonth,timeGridWeek,timeGridDay"
                }}
                locales={[esLocale, enLocale]}
                locale={t("diary.calendar.language")}
                initialView="dayGridMonth"
                eventContent={EventShedule}
                editable={false}
                selectable={true}
                selectMirror={false}
                selectOverlap={true}
                eventOverlap={false}
                allDaySlot={false}
                dayMaxEventRows={3}
                moreLinkClick={"day"}
                select={handleDateSelect}
                eventClick={handleEventClick}
                businessHours={businessHours}
                events={[
                    ...(visualMode ? [] : timeSlots || []),
                    ...(visualMode ? events || [] : []),
                    ...holidays
                ]}
                dayCellDidMount={dayCellDidMount}
                eventDidMount={eventDidMount}
                viewDidMount={handleViewDidMount}
            />
        </div>
    )
}

CalendarView.propTypes = {
    handleDateSelect: PropTypes.func,
    handleEventClick: PropTypes.func,
    calendarRef: PropTypes.object,
    businessHours: PropTypes.oneOfType([
        PropTypes.bool,
        PropTypes.array,
        PropTypes.object
    ]),
    holidays: PropTypes.array,
    events: PropTypes.array,
    timeSlots: PropTypes.array,
    visualMode: PropTypes.bool,
    holidayOnlyShow: PropTypes.func,
    handleDayCellMount: PropTypes.func
}
