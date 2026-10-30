import PropTypes from "prop-types"
import { cn, Label, ToggleGroup, ToggleGroupItem } from "@/components/ui-shared"
import { useField } from "formik"
import { useTranslation } from "react-i18next"
import { useCallback, useMemo } from "react"
import { formatTestId } from "@/utils/src/helpers"

const SchemasToggleSelector = ({ name, label = "auxSchema.form.numberSign", className = "", options = [], values = [], defaultIndex = 2 }) => {
    const { t } = useTranslation()
    const [field, , helpers] = useField(name)

    const handleChange = useCallback((val) => helpers.setValue(val), [helpers])

    const items = useMemo(
        () =>
            options.map((opt, index) => {
                const safeValue = values[index] !== undefined ? values[index] : opt
                return (
                    <ToggleGroupItem
                        key={safeValue}
                        value={safeValue}
                        className="data-[state=on]:bg-primary hover:bg-transparent hover:border"
                        data-state={field?.value === safeValue ? "on" : "off"}
                        id={formatTestId("shcemas_toggle_selector", `${safeValue}`)}
                        data-testid={formatTestId("shcemas_toggle_selector", `${safeValue}`)}
                    >
                        {t(`auxSchema.form.${opt}`, opt)}
                    </ToggleGroupItem>
                );
            }),
        [t, values, options]
    )

    return (
        <div className={cn("flex flex-col gap-2 p-2 rounded-md border-input border", className)}>
            <Label className="font-semibold">{t(label)}</Label>
            <ToggleGroup
                type="single"
                value={field?.value || options[defaultIndex]}
                onValueChange={handleChange}
                className="w-full"
                variant="surface"
                color="red"
                id={formatTestId("schemas_toggle_selector", `${field?.value || options[defaultIndex]}`)}
                data-testid={formatTestId("schemas_toggle_selector", `${field?.value}`)}
            >
                {items}
            </ToggleGroup>
        </div>
    )
}

SchemasToggleSelector.propTypes = {
    name: PropTypes.string.isRequired,
    label: PropTypes.string,
    className: PropTypes.string,
    options: PropTypes.array,
    values: PropTypes.array,
    defaultIndex: PropTypes.number
}

export default SchemasToggleSelector
