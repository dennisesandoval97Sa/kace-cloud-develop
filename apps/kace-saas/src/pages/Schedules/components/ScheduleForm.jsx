import { PropTypes } from "prop-types"
import { Formik, Form } from "formik"
import { joiFormikAdapter } from "@kace/utils"
import { useTranslation } from "react-i18next"
import FormCard from "../../../components/core/Cards/FormCard"
import InputCard from "../../../components/core/Cards/InputCard"
import SectionForm from "../../../components/core/Cards/section-form"
import { InputForm as Input, KField, Separator, FormikStatusMessages } from "@kace/ui-shared"
import { shiftManagementBase } from "../../../schemas/ShiftManagementSchema"
import { DatePickerHolidays } from "./DatePickerHolidays"
import { TableCalendarSchedule } from "./TableCalendarSchedule"

const ScheduleForm = ({
    dataHandler,
    data = {},
    isSending = false,
    isEditing = false
}) => {
    const { t } = useTranslation()
    const handleDeleteNoWorkingDays = (data) => {
        Object.keys(data).forEach((day) => {
            const { start, end } = data[day]
            if (start === "" && end === "") {
                delete data[day]
            }
        })
        return data
    }
    return (
        <Formik
            enableReinitialize={true}
            initialValues={data}
            validationSchema={joiFormikAdapter(shiftManagementBase)}
            onSubmit={(values, { setErrors, setStatus }) => {
                values.work_days = handleDeleteNoWorkingDays(values.work_days)
                dataHandler(values, setErrors, setStatus)
            }}
        >
            {({ initialValues, status }) => {
                return (
                    <Form className="flex w-full justify-center" autoComplete="off">
                        <FormCard isId={data?.id} title={t("app.title.schedules")} isSending={isSending}>
                            <div className="flex flex-col col-span-3 gap-8">
                                <FormikStatusMessages formikStatus={status} />
                                <SectionForm
                                    title={t("schedules.text.workingDays")}
                                    id="schedules_title_working_days"
                                    dataTestId="schedules_title_working_days"
                                >
                                    <InputCard>
                                        <KField>
                                            <Input
                                                type="text"
                                                name="description"
                                                label={t("schedules.form.name")}
                                                placeholder="L a V de 9:00 a 18:00"
                                                className="flex flex-col items-start justify-start text-start"
                                            />
                                        </KField>
                                    </InputCard>
                                    <Separator className="bg-gray-400" />
                                    <KField>
                                        <TableCalendarSchedule
                                            name="work_days"
                                            isEditing={isEditing}
                                            initialValues={
                                                initialValues.work_days
                                            }
                                        />
                                    </KField>
                                </SectionForm>
                            </div>
                            <div className="flex flex-col gap-8 col-start-4 col-span-2">
                                <SectionForm
                                    title={t("schedules.text.holidays")}
                                    className="w-full"
                                    id="schedules_form_holidays"
                                    dataTestId="schedules_form_holidays"
                                >
                                    <KField>
                                        <DatePickerHolidays name="holiday_dates" />
                                    </KField>
                                </SectionForm>
                            </div>
                        </FormCard>
                    </Form>
                )
            }}
        </Formik>
    )
}
ScheduleForm.propTypes = {
    dataHandler: PropTypes.func.isRequired,
    data: PropTypes.object,
    isSending: PropTypes.bool,
    isEditing: PropTypes.bool
}
export default ScheduleForm
