import PropTypes from "prop-types"
import InputCard from "../../../../../../../components/core/Cards/InputCard"
import { SelectByUrl } from "../../../../../../../components/core/SelectByUrl/SelectByUrl"
import { AGENDA_SERVICE } from "../../../../../../../utils/URL"
import { useTranslation } from "react-i18next"

export const DiarySelector = ({
    values,
    setFieldValue,
    errors,
    touched,
    handlerOptionsTypes,
    isSuccess
}) => {
    const { t } = useTranslation()

    return (
        <InputCard className="py-2" aria-label="Diary selection card">
            <SelectByUrl
                label={t("diary.calendar.appointment.field.diary")}
                name="agenda_id"
                url={AGENDA_SERVICE}
                keyQuery="listShedule"
                value={values?.agenda_id}
                setFieldValue={setFieldValue}
                error={errors?.agenda_id}
                touched={touched?.agenda_id}
                typeForm={handlerOptionsTypes}
                enabledMode={isSuccess}
                aria-label="Select diary from list"
            />
        </InputCard>
    )
}

DiarySelector.propTypes = {
    values: PropTypes.shape({
        agenda_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    }),
    setFieldValue: PropTypes.func,
    errors: PropTypes.shape({
        agenda_id: PropTypes.string
    }),
    touched: PropTypes.shape({
        agenda_id: PropTypes.bool
    }),
    handlerOptionsTypes: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.object
    ]),
    isSuccess: PropTypes.bool
}
