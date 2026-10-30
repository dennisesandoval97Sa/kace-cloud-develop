import { useField } from "formik"
import PropTypes from "prop-types"
import { Button, DatePicker } from "@kace/ui-shared"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { TrashIcon } from "lucide-react"
import { forwardRef } from "react"

export const DatePickerHolidays = forwardRef(({ ...props }, ref) => {
    const [field, meta, helpers] = useField(props)
    const { t } = useTranslation()

    const formatDate = (date) => {
        const year = date.getUTCFullYear()
        const month = String(date.getUTCMonth() + 1).padStart(2, "0")
        const day = String(date.getUTCDate()).padStart(2, "0")
        return `${year}-${month}-${day}`
    }

    const handleNewValue = (newValue) => {
        const formatNewDate = formatDate(newValue)
        if (!field.value.includes(formatNewDate)) {
            helpers.setValue([...field.value, formatNewDate])
        } else {
            toast.warning(t("schedules.alerts.dateAdded"))
        }
    }
    return (
        <div className="gap-2 flex flex-col">
            <DatePicker
                id="datepicker_holidays"
                data-testid="datepicker_holidays"
                onChange={handleNewValue}
                value=""
                placeholder={t("schedules.text.selectDay")}
            />
            <div
                id="list_holidays"
                data-testid="list_holidays"
                className="w-full border border-input rounded-md p-2 max-h-36 overflow-auto flex flex-col gap-2"
            >
                {field.value.length === 0 ? (
                    <span
                        id="no_information"
                        data-testid="no_information"
                    >
                        {t("app.text.noInformation")}
                    </span>
                ) : (
                    field.value.map((date, index) => {
                        const formatted = formatDate(new Date(date))
                        return (
                            <div
                                key={index}
                                id={`holiday_item_${index}_and_${formatted}`}
                                data-testid={`holiday_item_${index}_and_${formatted}`}
                                className="flex items-center justify-between w-full gap-4"
                            >
                                <span
                                    id={`holiday_date_${formatted}`}
                                    data-testid={`holiday_date_${formatted}`}
                                >
                                    {formatted}
                                </span>
                                <Button
                                    type="button"
                                    id={`delete_date_${formatted}`}
                                    data-testid={`delete_date_${formatted}`}
                                    size="icon"
                                    className="h-6 w-6 rounded-md"
                                    variant="destructive"
                                    ref={ref}
                                    onClick={() =>
                                        helpers.setValue(
                                            field.value.filter(
                                                (value) => value !== date
                                            )
                                        )
                                    }
                                >
                                    <TrashIcon width={18} height={18} />
                                </Button>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
})
DatePickerHolidays.propTypes = {
    children: PropTypes.node,
    isVisible: PropTypes.bool,
    setModalStatus: PropTypes.func
}

DatePickerHolidays.displayName = "DatePickerHolidays"
