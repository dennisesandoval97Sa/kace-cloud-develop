import { Button } from "@kace/ui-shared"
import PropTypes from "prop-types"

import { useTranslation } from "react-i18next"
import SheduleForm from "../SheduleForm/SheduleForm"

export const EventForm = ({
    time,
    setSelectedShedule,
    availableForm,
    visualMode,
    idCase,
    clientId,
    isLoading,
    reasign,
    eventData
}) => {
    const { t } = useTranslation()

    const modeButton = time?.mode ? t("button.update") : t("button.save")

    return (
        <div className="flex-1 lg:pt-14">
            <div>
                <SheduleForm
                    info={time}
                    selected={setSelectedShedule}
                    active={availableForm}
                    page={visualMode}
                    idCase={idCase}
                    clientId={clientId}
                    eventData={eventData}
                />
            </div>

            <div className="flex flex-row justify-center items-center py-2.5 space-x-3">
                {availableForm && (
                    <Button
                        type="submit"
                        disabled={isLoading}
                        className={`${isLoading && "cursor-not-allowed opacity-40"}`}
                        id="btn_event_form_submit"
                        data-testid="btn_event_form_submit"
                    >
                        {isLoading ? "Enviando..." : modeButton}
                    </Button>
                )}
                {time?.id && visualMode && (
                    <Button
                        onClick={reasign}
                        type="button"
                        variant="secondary"
                        id="btn_event_form_reasign"
                        data-testid="btn_event_form_reasign"
                    >
                        {t("diary.calendar.appointment.title.reschedule")}
                    </Button>
                )}
            </div>
        </div>
    )
}

EventForm.propTypes = {
    time: PropTypes.object.isRequired,
    setSelectedShedule: PropTypes.func.isRequired,
    availableForm: PropTypes.bool.isRequired,
    visualMode: PropTypes.bool.isRequired,
    idCase: PropTypes.string.isRequired,
    clientId: PropTypes.string.isRequired,
    isLoading: PropTypes.bool.isRequired,
    reasign: PropTypes.func.isRequired,
    eventData: PropTypes.array.isRequired
}
