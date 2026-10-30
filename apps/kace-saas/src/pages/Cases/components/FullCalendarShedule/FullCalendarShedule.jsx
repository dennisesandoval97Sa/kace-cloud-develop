import PropTypes from "prop-types"
import { Form, Formik } from "formik"
import { useNavigate } from "react-router-dom"
import { joiFormikAdapter } from "../../../../utils/main"
import useConfigAgentData from "../../../../hooks/useConfigAgentData"
import { casoCalendar } from "../../../../schemas/CasoSchema"
import { initialValuesAppointment } from "../../data/Constants"
import { EventForm } from "./components/CalendarLayout/EventForm"
import { CalendarToolbar } from "./components/CalendarLayout/CalendarToolbar"
import useCalendarScheduler from "./hooks/events/useCalendarScheduler"
import { CalendarView } from "./components/CalendarLayout/CalendarView"
import { GeneralLoader } from "../../../../components/ui-shared"

export const FullCalendarShedule = ({
    idCase,
    admin,
    pageBack = false,
    clientId = ""
}) => {
    const navigate = useNavigate()
    const stateCases = useConfigAgentData()

    const { data, state, actions, refs, utils, status } = useCalendarScheduler({
        idCase,
        admin
    })

    const { visualMode, availableForm, holidayOnlyShow } = state || {}
    const {
        eventData,
        businessHours,
        holidays,
        timeSlots,
        dateTime: selectedTime
    } = data || {}

    const {
        handleDateSelect,
        handleEventClick,
        handleAppointment,
        setSelectedShedule,
        setVisualMode,
        setIdEvento
    } = actions || {}

    const { calendarRef } = refs || {}
    const { handleDayCellMount } = utils || {}
    const { isLoading } = status || {}

    const handleReschedule = (setValue) => {
        setVisualMode(false)
        setValue("fecha_anterior", selectedTime.start.date || "")
        setValue("is_reschedule", true)
        setValue("id", selectedTime.id || "")
        setValue("date", "")
        setValue("date_end", "")
        setValue("start_time", "")
        setValue("end_time", "")
    }

    if (stateCases.isFetching || stateCases.isLoading) {
        return <GeneralLoader/>
    }

    return (
        <Formik
            initialValues={initialValuesAppointment}
            validationSchema={joiFormikAdapter(casoCalendar)}
            onSubmit={(values, { resetForm }) => {
                handleAppointment(values)

                resetForm({
                    values: {
                        ...initialValuesAppointment,
                        agenda_id: values.agenda_id
                    }
                })
            }}
        >
            {({ setFieldValue }) => {
                return (
                    <Form autoComplete="off">
                        <div className="max-sm:col-span-1 w-full">
                            <CalendarToolbar
                                setVisualMode={setVisualMode}
                                setIdEvento={setIdEvento}
                                onBack={() => navigate(-1)}
                                visualMode={visualMode}
                                pageBack={pageBack}
                            />

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <CalendarView
                                    handleDateSelect={handleDateSelect}
                                    handleEventClick={handleEventClick}
                                    calendarRef={calendarRef}
                                    businessHours={businessHours}
                                    holidays={holidays}
                                    timeSlots={timeSlots}
                                    visualMode={visualMode}
                                    holidayOnlyShow={holidayOnlyShow}
                                    handleDayCellMount={handleDayCellMount}
                                    events={eventData}
                                />
                                <EventForm
                                    time={selectedTime}
                                    setSelectedShedule={setSelectedShedule}
                                    availableForm={availableForm}
                                    visualMode={visualMode}
                                    idCase={idCase}
                                    clientId={clientId}
                                    isLoading={isLoading}
                                    reasign={() =>
                                        handleReschedule(setFieldValue)
                                    }
                                    eventData={eventData}
                                />
                            </div>
                        </div>
                    </Form>
                )
            }}
        </Formik>
    )
}

FullCalendarShedule.propTypes = {
    idCase: PropTypes.string.isRequired,
    pageBack: PropTypes.bool,
    admin: PropTypes.bool,
    clientId: PropTypes.string
}
