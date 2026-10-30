import { useFormikContext } from "formik"
import PropTypes from "prop-types"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { SelectByUrl } from "../../../../../../components/core/SelectByUrl/SelectByUrl"
import InputCard from "../../../../../../components/core/Cards/InputCard"
import { AGENDA_SERVICE } from "../../../../../../utils/URL"
import DateTimeFields from "./components/DateTimeFields"
import { CheckBoxContainer } from "../../../../../GeneralSetup/components/GeneralSetupFormComponents/CheckBoxContainer"
import { LocationFields } from "./components/LocationFields"
import { useSheduleForm } from "./hooks/useSheduleForm"

const SheduleForm = ({
    info,
    selected,
    active,
    page,
    idCase,
    clientId = "",
    eventData
}) => {
    const { t } = useTranslation()

    const { ciudad, departamento } = eventData?.[0]?.custom_fields?.data || {}

    const { setFieldValue, values, handleChange, errors, touched } =
        useFormikContext()

    useEffect(() => {
        if (ciudad || departamento) {
            setFieldValue(
                "departamento",
                eventData?.[0]?.custom_fields?.data.departamento
            )
            setFieldValue("ciudad", eventData?.[0]?.custom_fields?.data.ciudad)
        }
    }, [ciudad, departamento, setFieldValue, values])

    const { handlerOptionsTypes, isSuccess } = useSheduleForm({
        info,
        setFieldValue,
        values,
        handleChange,
        idCase,
        clientIdProp: clientId
    })

    useEffect(() => {
        if (values?.agenda_id) {
            selected(values.agenda_id)
        }
    }, [values.agenda_id])

    return (
        <>
            <InputCard className="py-2">
                <SelectByUrl
                    label={t("diary.calendar.appointment.field.diary")}
                    name="agenda_id"
                    url={AGENDA_SERVICE}
                    keyQuery="listShedule"
                    value={values.agenda_id}
                    setFieldValue={setFieldValue}
                    error={errors.agenda_id}
                    touched={touched.agenda_id}
                    typeForm={handlerOptionsTypes}
                    enabledMode={isSuccess}
                />
            </InputCard>

            {values.agenda_id && (
                <p className="text-center">
                    {page &&
                        !active &&
                        t("diary.calendar.appointment.field.update")}
                </p>
            )}

            {active && <DateTimeFields />}
            {active && page && (
                <CheckBoxContainer
                    text={t("diary.calendar.appointment.field.canceled")}
                    value={values?.is_canceled}
                    setFieldValue={setFieldValue}
                    name="is_canceled"
                />
            )}
            {active && <LocationFields values={values} />}
        </>
    )
}

export default SheduleForm

SheduleForm.propTypes = {
    info: PropTypes.object,
    selected: PropTypes.func,
    active: PropTypes.bool,
    page: PropTypes.bool,
    idCase: PropTypes.string,
    clientId: PropTypes.string,
    eventData: PropTypes.array
}
