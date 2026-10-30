import { useTranslation } from "react-i18next"
import PropTypes from "prop-types"

import {
    InputForm as Input,
    KField
} from "@kace/ui-shared"
import { useFormikContext } from "formik"
import { useMemo } from "react"
import SchemasRestFlowField from "./SchemasRestFlowField"
import InputCard from "@/components/core/Cards/InputCard"
import { SwitchStateAdmin } from "@/components/core/switchState/SwitchStateAdmin"
import SchemasToggleSelector from "./SchemasToggleSelector"

const SchemasNumberField = ({ namePrefix, index }) => {
    const { t } = useTranslation()
    const { values } = useFormikContext()

    const field = useMemo(() => values.fields[index], [values])
    const isInteger = useMemo(() => field.integer, [field])

    const validateDecimal = (e) => {
        const char = e.data
        if (char != null && char !== "" && !/^[0-9,.]*$/.test(char)) {
            e.preventDefault()
        }
    }

    return (
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 border-l-4 border-gray-200">
            <InputCard>
                <KField>
                    <Input
                        name={`${namePrefix}.default`}
                        label={t("auxSchema.form.default")}
                        type="number"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
            </InputCard>
            <InputCard>
                <KField>
                    <SwitchStateAdmin
                        name={`${namePrefix}.integer`}
                        title={t("auxSchema.form.integer")}
                        tipo="boolean"
                        trueText={t("auxSchema.form.integer")}
                        falseText={t("auxSchema.form.decimal")}
                    />
                </KField>
            </InputCard>
            <InputCard className="flex flex-col gap-4">
                <KField>
                    <SchemasToggleSelector
                        name={`${namePrefix}.numberSign`}
                        label="auxSchema.form.numberSign"
                        options={["positive", "negative", "both"]}
                    />
                </KField>
            </InputCard>
            {
                !isInteger && (
                    <InputCard>
                        <KField>
                            <Input
                                name={`${namePrefix}.precision`}
                                label={t("auxSchema.form.precision")}
                                type="number"
                                className="flex flex-col items-start justify-start text-start"
                            />
                        </KField>
                    </InputCard>
                )
            }
            {
                isInteger && (
                    <InputCard>
                        <KField>
                            <SwitchStateAdmin
                                name={`${namePrefix}.port`}
                                title={t("auxSchema.form.port")}
                                tipo="boolean"
                                trueText={t("auxSchema.form.true")}
                                falseText={t("auxSchema.form.false")}
                            />
                        </KField>
                    </InputCard>
                )
            }
            <InputCard>
                <KField>
                    <Input
                        name={`${namePrefix}.min`}
                        label={t("auxSchema.form.min")}
                        type="number"
                        step={isInteger ? "1" : "any"}
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
            </InputCard>
            <InputCard>
                <KField>
                    <Input
                        name={`${namePrefix}.max`}
                        label={t("auxSchema.form.max")}
                        type="number"
                        step={isInteger ? "1" : "any"}
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
            </InputCard>

            <InputCard>
                <KField>
                    <Input
                        name={`${namePrefix}.valid`}
                        label={t("auxSchema.form.whitelist")}
                        type="text"
                        className="flex flex-col items-start justify-start text-start"
                        onBeforeInput={validateDecimal}
                    />
                </KField>
            </InputCard>

            <InputCard>
                <KField>
                    <Input
                        name={`${namePrefix}.invalid`}
                        label={t("auxSchema.form.blacklist")}
                        type="text"
                        className="flex flex-col items-start justify-start text-start"
                        onBeforeInput={validateDecimal}
                    />
                </KField>
            </InputCard>

            <InputCard>
                <KField>
                    <Input
                        name={`${namePrefix}.multiple`}
                        label={t("auxSchema.form.multiple")}
                        type="number"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
            </InputCard>

            <InputCard>
                <KField>
                    <SwitchStateAdmin
                        name={`${namePrefix}.unsafe`}
                        title={t("auxSchema.form.unsafeInteger")}
                        tipo="boolean"
                        trueText={t("auxSchema.form.unsafe")}
                        falseText={t("auxSchema.form.safe")}
                    />
                </KField>
            </InputCard>

            <SchemasRestFlowField index={index} namePrefix={namePrefix} />
        </div>
    )
}

SchemasNumberField.propTypes = {
    namePrefix: PropTypes.string.isRequired,
    index: PropTypes.number.isRequired
}

export default SchemasNumberField
