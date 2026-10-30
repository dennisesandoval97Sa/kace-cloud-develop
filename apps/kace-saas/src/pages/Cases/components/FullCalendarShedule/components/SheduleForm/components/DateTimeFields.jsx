import { useTranslation } from "react-i18next"
import { KField, InputForm as Input } from "@kace/ui-shared"
import InputCard from "../../../../../../../components/core/Cards/InputCard"

export const DateTimeFields = () => {
    const { t } = useTranslation()

    return (
        <>
            <InputCard className="py-2 grid grid-cols-2 gap-2">
                <KField>
                    <Input
                        id="date"
                        name="date"
                        label={t("diary.calendar.appointment.field.date")}
                        type="text"
                        placeholder={t("diary.calendar.appointment.field.date")}
                        disabled={true}
                        className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-center align-middle	ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        data-testid="date"
                    />
                </KField>

                <KField>
                    <Input
                        id="date_end"
                        name="date_end"
                        label={t("diary.calendar.appointment.field.dateEnd")}
                        type="text"
                        placeholder={t(
                            "diary.calendar.appointment.field.dateEnd"
                        )}
                        disabled={true}
                        className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-center align-middle	ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        data-testid="date_end"
                    />
                </KField>

                <KField>
                    <Input
                        id="start_time"
                        type="time"
                        placeholder={t("diary.calendar.appointment.field.time")}
                        name="start_time"
                        label={t("diary.calendar.appointment.field.time")}
                        disabled={true}
                        className="flex justify-between min-h-[40px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-center align-middle	ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        data-testid="start_time"
                    />
                </KField>

                <KField>
                    <Input
                        id="end_time"
                        type="time"
                        placeholder={t(
                            "diary.calendar.appointment.field.timeEnd"
                        )}
                        name="end_time"
                        label={t("diary.calendar.appointment.field.timeEnd")}
                        disabled={true}
                        className="flex justify-between min-h-[40px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-center align-middle	ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        data-testid="end_time"
                    />
                </KField>
            </InputCard>
        </>
    )
}

DateTimeFields.propTypes = {}

export default DateTimeFields
