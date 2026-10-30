import PropTypes from "prop-types"
import { useTranslation } from "react-i18next"
import { Button } from "@kace/ui-shared"
import { ChevronLeft } from "lucide-react"

export const CalendarToolbar = ({
    onBack,
    visualMode,
    pageBack,
    setVisualMode,
    setIdEvento
}) => {
    const { t } = useTranslation()

    const onToggleMode = (value) => {
        setIdEvento(null)
        setVisualMode(value)
    }

    return (
        <>
            {pageBack && (
                <Button
                    variant="outline"
                    size="icon"
                    onClick={onBack}
                    type="button"
                    id="cal_toolbar_back"
                    data-testid="cal_toolbar_back"
                >
                    <ChevronLeft />
                </Button>
            )}
            <div
                className={
                    "flex items-center py-2.5 space-x-3 flex-1 justify-center"
                }
            >
                <Button
                    disabled={visualMode}
                    onClick={() => onToggleMode(true)}
                    type="button"
                    id="cal_toolbar_myApointments"
                    data-testid="cal_toolbar_myApointments"
                >
                    {t("diary.calendar.appointment.title.myApointments")}
                </Button>
                <Button
                    disabled={!visualMode}
                    onClick={() => onToggleMode(false)}
                    type="button"
                    id="cal_toolbar_createappointment"
                    data-testid="cal_toolbar_createappointment"
                >
                    {t("diary.calendar.appointment.title.createApointments")}
                </Button>
            </div>
        </>
    )
}

CalendarToolbar.propTypes = {
    onBack: PropTypes.func,
    onToggleMode: PropTypes.func,
    visualMode: PropTypes.bool,
    pageBack: PropTypes.bool,
    setVisualMode: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
    setIdEvento: PropTypes.oneOfType([PropTypes.func, PropTypes.string])
}
