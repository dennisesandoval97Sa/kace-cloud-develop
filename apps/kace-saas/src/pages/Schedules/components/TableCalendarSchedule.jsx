import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
    Input,
    Checkbox
} from "@kace/ui-shared"
import { useField, useFormikContext } from "formik"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { INITIAL_DATA_TABLE } from "../data/constants"
import PropTypes from "prop-types"
import { useTranslation } from "react-i18next"

export const TableCalendarSchedule = ({ isEditing, initialValues, ...props }) => {
    const { t } = useTranslation()
    const [dataTable, setDataTable] = useState(INITIAL_DATA_TABLE)
    const { resetForm } = useFormikContext()
    const [field, meta, helpers] = useField(props)
    const handleValues = (data) => {
        const dataFormat = dataTable.map((item) => {
            if (data[item.day]) {
                return {
                    ...item,
                    workingDay: true,
                    start: data[item.day].start,
                    end: data[item.day].end
                }
            }
            return item
        })
        setDataTable(dataFormat)
    }

    const validateChangeWorkingDay = () => {
        const count = dataTable.filter((item) => item.workingDay).length
        return count === 1
    }

    const handleChange = (value, day) => {
        if (!value) {
            const response = validateChangeWorkingDay()
            if (response) {
                toast.warning(t("schedules.alerts.selectDay"))
                return
            }
        }
        const newDataTable = dataTable.map((item) =>
            item.day === day
                ? {
                    ...item,
                    workingDay: value,
                    start: value ? "08:00" : "",
                    end: value ? "18:00" : ""
                }
                : item
        )
        setDataTable(newDataTable)
        helpers.setValue({
            ...field.value,
            [day]: {
                start: value ? "08:00" : "",
                end: value ? "18:00" : ""
            }
        })
    }

    const handleTimeStartChange = (value, day) => {
        if (value >= field.value[day].end) {
            toast.error(t("schedules.alerts.endDate"))
            return
        }
        helpers.setValue({
            ...field.value,
            [day]: {
                ...field.value[day],
                start: value
            }
        })
        const data = dataTable.map((item) =>
            item.day === day ? { ...item, start: value } : item
        )
        setDataTable(data)
    }

    const handleTimeEndChange = (value, day) => {
        if (value <= field.value[day].start) {
            toast.error(t("schedules.alerts.startDate"))
            return
        }
        helpers.setValue({
            ...field.value,
            [day]: {
                ...field.value[day],
                end: value
            }
        })
        const data = dataTable.map((item) =>
            item.day === day ? { ...item, end: value } : item
        )
        setDataTable(data)
    }

    useEffect(() => {
        if (!isEditing) {
            resetForm()
            setDataTable(INITIAL_DATA_TABLE)
        }
    }, [isEditing, resetForm])

    useEffect(() => {
        const test = dataTable.some((item) => item.workingDay)
        if (!test) {
            handleValues(field.value)
        }
    }, [field.value])

    useEffect(() => {
        if (initialValues) {
            handleValues(initialValues)
        }
    }, [initialValues])

    return (
        <Table className={`gap-2`} id="table_calendar_schedule" data-testid="table_calendar_schedule">
            <TableCaption>{t("schedules.text.select")}</TableCaption>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-[100px]">{t("schedules.text.day")}</TableHead>
                    <TableHead>{t("schedules.text.labor")}</TableHead>
                    <TableHead>{t("schedules.text.start")}</TableHead>
                    <TableHead>{t("schedules.text.end")}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {dataTable.map((item) => (
                    <TableRow key={item.day} id={`row_${item.day}`} data-testid={`row_${item.day}`}>
                        <TableCell id={`day_label_${item.day}`}
                            data-testid={`day_label_${item.day}`}
                        >
                            {t(`app.days.${item.day}`)}</TableCell>
                        <TableCell>
                            <Checkbox
                                checked={item.workingDay}
                                onCheckedChange={() =>
                                    handleChange(!item.workingDay, item.day)
                                }
                                id={`checkbox_${item.day}`}
                                data-testid={`checkbox_${item.day}`}
                            />
                        </TableCell>
                        <TableCell>
                            <Input
                                type="time"
                                value={item.start}
                                onChange={(e) =>
                                    handleTimeStartChange(
                                        e.target.value,
                                        item.day
                                    )
                                }
                                disabled={!item.workingDay}
                                id={`input_start_time_${item.day}_${item.start}`}
                                data-testid={`input_start_time_${item.day}_${item.start}`}
                            />
                        </TableCell>
                        <TableCell className="text-right">
                            <Input
                                type="time"
                                value={item.end}
                                onChange={(e) =>
                                    handleTimeEndChange(
                                        e.target.value,
                                        item.day
                                    )
                                }
                                disabled={!item.workingDay}
                                id={`input_finish_time_${item.day}_${item.end}`}
                                data-testid={`input_finish_time_${item.day}_${item.end}`}
                            />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
            <TableFooter>
                <TableRow>
                    <TableCell colSpan={3} id="table_working_days" data-testid="table_working_days">{t("schedules.text.workingDays")}</TableCell>
                    <TableCell className="text-right" id="working_days_count" data-testid="working_days_count">
                        {dataTable.filter((item) => item.workingDay)?.length}
                    </TableCell>
                </TableRow>
            </TableFooter>
        </Table>
    )
}

TableCalendarSchedule.propTypes = {
    isEditing: PropTypes.bool,
    initialValues: PropTypes.object
}
