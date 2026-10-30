import { useTranslation } from "react-i18next"
import PropTypes from "prop-types"

import {
    InputForm as Input,
    KField
} from "@kace/ui-shared"
import SchemasRestFlowField from "./SchemasRestFlowField"
import InputCard from "@/components/core/Cards/InputCard"
import SchemasToggleSelector from "./SchemasToggleSelector"

const SchemasBooleanField = ({ namePrefix, index }) => {
    const { t } = useTranslation()

    return (
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 border-l-4 border-gray-200">
            <InputCard className="flex flex-col gap-4">
                <KField>
                    <SchemasToggleSelector
                        name={`${namePrefix}.default`}
                        label="auxSchema.form.default"
                        options={["none", "true", "false"]}
                        values={[null, true, false]}
                        defaultIndex={2}
                    />
                </KField>
            </InputCard>
            <InputCard className="col-span-2">
                <KField>
                    <Input
                        name={`${namePrefix}.truthyValues`}
                        label={t("auxSchema.form.truthyValues")}
                        type="text"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
            </InputCard>
            <InputCard className="col-span-2">
                <KField>
                    <Input
                        name={`${namePrefix}.falsyValues`}
                        label={t("auxSchema.form.falsyValues")}
                        type="text"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
            </InputCard>

            <SchemasRestFlowField index={index} namePrefix={namePrefix} />
        </div>
    )
}

SchemasBooleanField.propTypes = {
    namePrefix: PropTypes.string.isRequired,
    index: PropTypes.number.isRequired
}

export default SchemasBooleanField
