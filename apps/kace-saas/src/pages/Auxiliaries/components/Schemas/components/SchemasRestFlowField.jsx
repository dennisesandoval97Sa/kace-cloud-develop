import { useTranslation } from "react-i18next"
import PropTypes from "prop-types"

import {
    KField
} from "@kace/ui-shared"
import { useFormikContext } from "formik"
import InputCard from "@/components/core/Cards/InputCard"
import { SelectByUrl } from "@/components/core/SelectByUrl/SelectByUrl"
import { WS_REST_FLOWS_SERVICE } from "@/utils/URL"

const SchemasRestFlowField = ({ namePrefix, index }) => {
    const { t } = useTranslation()
    const { values, errors, touched, setFieldValue } = useFormikContext()

    return (
        <InputCard className="col-span-2">
            <KField>
                <SelectByUrl
                    name={`${namePrefix}.restflow_id`}
                    url={WS_REST_FLOWS_SERVICE}
                    value={values?.fields?.[index]?.restflow_id}
                    keyQuery="wsRestFlowsData"
                    setFieldValue={setFieldValue}
                    label={t("auxSchema.form.restFlow")}
                    itemLabel="description"
                    error={errors?.fields?.[index]?.restflow_id ?? ""}
                    touched={touched?.fields?.[index]?.restflow_id ?? false}
                />
            </KField>
        </InputCard>
    )
}

SchemasRestFlowField.propTypes = {
    namePrefix: PropTypes.string.isRequired,
    index: PropTypes.number.isRequired
}

export default SchemasRestFlowField
