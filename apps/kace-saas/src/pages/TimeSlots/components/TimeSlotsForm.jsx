import { useTranslation } from "react-i18next"
import { PropTypes } from "prop-types"
import { Form, Formik } from "formik"
import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import InputCard from "../../../components/core/Cards/InputCard"
import { AGENDA_SERVICE } from "@kace/urls"
import SectionForm from "../../../components/core/Cards/section-form"
import { joiFormikAdapter } from "@kace/utils"
import { TimeSlotsSchemaForm } from "../../../schemas/TimeSlotsSchema"
import FormCard from "../../../components/core/Cards/FormCard"
import { SelectByUrl } from "../../../components/core/SelectByUrl/SelectByUrl"
import { InputForm as Input, KField } from "@kace/ui-shared"
import { initialValues } from "../data"
import { SwitchStateAdmin } from "../../../components/core/switchState/SwitchStateAdmin"

const TimeSlotsForm = ({
    dataHandler,
    data = {},
    isSending = false,
    handleTimeStartChange,
    handleTimeEndChange
}) => {
    const location = useLocation()
    const { t } = useTranslation()
    const [formValues, setFormValues] = useState(data)
    const state = location.state

    useEffect(() => {
        if (Object.entries(data).length !== 0) {
            Object.entries(data).forEach(([key, value]) => {
                setFormValues((state) => ({
                    ...state,
                    [key]: value || initialValues[key] || ""
                }))
            })
        }
    }, [data])

    return (
        <Formik
            enableReinitialize={true}
            initialValues={formValues}
            validationSchema={joiFormikAdapter(TimeSlotsSchemaForm)}
            onSubmit={(values) => dataHandler(values)}
        >
            {({ values, setFieldValue, touched, errors }) => (
                <Form className="flex w-full justify-center" autoComplete="off">
                    <FormCard
                        isId={data?.id}
                        title={t("app.title.timeSlots")}
                        isSending={isSending}
                        genericTitle={state?.see ?? true}
                    >
                        <div className="flex flex-col col-span-3 gap-8">
                            <SectionForm
                                title={t("timeSlots.form.general")}
                                id="time_slots_form_general"
                                dataTestId="time_slots_form_general"
                            >
                                <InputCard>
                                    <KField>
                                        <Input
                                            id="description"
                                            name="description"
                                            label={t("timeSlots.form.description")}
                                            type="text"
                                            placeholder={t("timeSlots.placeholder.description")}
                                            className="flex flex-col items-start justify-start text-start"
                                        />
                                    </KField>
                                </InputCard>
                                <InputCard>
                                    <KField>
                                        <Input
                                            id="start_time"
                                            name="start_time"
                                            label={t("timeSlots.form.start_time")}
                                            placeholder={t("timeSlots.placeholder.start_time")}
                                            type="time"
                                            className="flex flex-col items-start justify-start text-start"
                                            onChange={(e) =>
                                                handleTimeStartChange(e.target.value, values.end_time, setFieldValue)
                                            }
                                        />
                                    </KField>
                                </InputCard>
                                <InputCard>
                                    <KField>
                                        <Input
                                            id="end_time"
                                            name="end_time"
                                            label={t("timeSlots.form.end_time")}
                                            placeholder={t("timeSlots.placeholder.end_time")}
                                            type="time"
                                            className="flex flex-col items-start justify-start text-start"
                                            onChange={(e) =>
                                                handleTimeEndChange(e.target.value, values.start_time, setFieldValue)
                                            }
                                        />
                                    </KField>
                                </InputCard>
                                <InputCard>
                                    <KField>
                                        <Input
                                            id="max_appointments"
                                            name="max_appointments"
                                            label={t("timeSlots.form.max_appointments")}
                                            placeholder={t("timeSlots.placeholder.max_appointments")}
                                            type="number"
                                            min="0"
                                            className="flex flex-col items-start justify-start text-start"
                                        />
                                    </KField>
                                </InputCard>
                            </SectionForm>
                        </div>
                        <div className="flex flex-col gap-8 col-start-4 col-span-2">
                            <SectionForm
                                title={t("timeSlots.form.associateAgenda")}
                                id="timme_slot_form_agenda"
                                dataTestId="timme_slot_form_agenda"
                            >
                                <InputCard>
                                    <KField>
                                        <SelectByUrl
                                            name="agenda_id"
                                            url={AGENDA_SERVICE}
                                            value={values.agenda_id}
                                            keyQuery="agenda"
                                            setFieldValue={setFieldValue}
                                            itemLabel="description"
                                            error={errors.agenda_id}
                                            touched={touched.agenda_id}
                                            method="post"
                                        />
                                    </KField>
                                </InputCard>
                            </SectionForm>
                            <SectionForm>
                                <InputCard>
                                    <KField>
                                        <SwitchStateAdmin name="is_active" shouldBool />
                                    </KField>
                                </InputCard>
                            </SectionForm>
                        </div>
                    </FormCard>
                </Form>
            )}
        </Formik>
    );
}
TimeSlotsForm.propTypes = {
    dataHandler: PropTypes.func.isRequired,
    data: PropTypes.object,
    isSending: PropTypes.bool,
    handleTimeStartChange: PropTypes.func,
    handleTimeEndChange: PropTypes.func
}
export default TimeSlotsForm
