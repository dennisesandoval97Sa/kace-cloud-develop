import { useTranslation } from "react-i18next"
import { FieldArray, useFormikContext } from "formik"
import PropTypes from "prop-types"
import { PlusIcon, Trash2 } from "lucide-react"
import {
    AlertModalShared,
    Button,
    InputForm as Input,
    KField
} from "@/components/ui-shared"
import { useMemo } from "react"

const SchemasRegexReplace = ({ namePrefix, index }) => {
    const { t } = useTranslation()
    const { values } = useFormikContext()

    const fieldArrayName = `${namePrefix}.regexReplace`

    const replacementRules = useMemo(() => values?.fields?.[index]?.regexReplace ?? [], [values, index, namePrefix])
    const hasRegexReplacements = useMemo(() => !!replacementRules.length, [replacementRules])

    return (
        <FieldArray name={fieldArrayName}>
            {({ push, remove }) => (
                <div className={`col-span-2 flex flex-col ${hasRegexReplacements ? "gap-4 border-input border p-4 rounded-md" : ""}`}>
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                            {t("auxSchema.form.regexReplace", "Regex Replacements")}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                push({ pattern: "", string: "" })
                            }}
                        >
                            <PlusIcon />
                        </Button>
                    </div>

                    {hasRegexReplacements && (
                        <ul className="flex flex-col gap-3">
                            <li className="flex items-center gap-3 px-1">
                                <label className="flex-1 text-xs font-semibold text-gray-600">{t("auxSchema.form.pattern", "Pattern")}</label>
                                <label className="flex-1 text-xs font-semibold text-gray-600">{t("auxSchema.form.replacementString", "Replacement")}</label>
                                <div className="w-8" />
                            </li>

                            {replacementRules.map((_, itemIndex) => (
                                <li key={itemIndex} className="flex items-start gap-3">
                                    <div className="flex-1">
                                        <KField>
                                            <Input
                                                name={`${fieldArrayName}[${itemIndex}].pattern`}
                                                type="text"
                                                placeholder="e.g., [^a-zA-Z0-9]"
                                            />
                                        </KField>
                                    </div>

                                    <div className="flex-1">
                                        <KField>
                                            <Input
                                                name={`${fieldArrayName}[${itemIndex}].string`}
                                                type="text"
                                                placeholder="e.g., -"
                                            />
                                        </KField>
                                    </div>

                                    <AlertModalShared
                                        nameAcceptAction={t("app.forms.delete")}
                                        nameCancelAction={t("app.forms.cancel")}
                                        handleAcceptAction={() => remove(itemIndex)}
                                        buttonAction={
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="text-red-600 hover:text-red-600 hover:bg-red-50 mt-1"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        }
                                    />
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </FieldArray>
    )
}

SchemasRegexReplace.propTypes = {
    namePrefix: PropTypes.string.isRequired,
    index: PropTypes.number.isRequired
}

export default SchemasRegexReplace
