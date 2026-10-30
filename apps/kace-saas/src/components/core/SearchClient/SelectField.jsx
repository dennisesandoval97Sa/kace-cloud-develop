import { formatTestId } from "@/utils/src/helpers"
import {
    cn,
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue
} from "@kace/ui-shared"
import { useField } from "formik"
import { PropTypes } from "prop-types"
import { useTranslation } from "react-i18next"
import { X } from "lucide-react";

export const SelectField = ({
    options,
    className = "w-full",
    handle = () => null,
    ...props
}) => {
    const { t } = useTranslation()
    const [field, meta, helpers] = useField(props)
    const id = props.id ? props.id : props.name
    const handleChange = (value) => {
        helpers.setValue(value)
        handle(value)
    };

    const handlerClear = () => {
        helpers.setValue("")
        handle("")
    }
    return (
        <div className={cn("flex items-center gap-2", className)}>
            <Select
                id={id}
                onValueChange={handleChange}
                value={field.value}
                onBlur={() => helpers.setTouched(true)}
                {...props}
                data-testid={`select_field_${field.value}`}
            >
                <SelectTrigger
                    className="rounded-none"
                    id={formatTestId("select_field_trigger", `${field.value === "-" ? "empty" : field.value}`)}
                    data-testid={formatTestId("select_field_trigger", `${field.value === "-" ? "empty" : field.value}`)}
                >
                    <SelectValue
                        placeholder={t("app.forms.options")}
                        className={`${meta.error !== undefined && "text-redCustom"}`}
                        id={formatTestId("select_field_value", `${field.value}`)}
                        data-testid={formatTestId("select_field_value", `${field.value}`)}
                    />
                </SelectTrigger>
                <SelectContent
                    id={formatTestId("select_field_content", `${field.value}`)}
                    data-testid={formatTestId("select_field_content", `${field.value}`)}
                >
                    <SelectGroup
                        id={formatTestId("select_field_group", `${field.value}`)}
                        data-testid={formatTestId("select_field_group", `${field.value}`)}
                    >
                        <SelectLabel id="select_field_label" data-testid="select_field_label">Opciones</SelectLabel>
                        {options.map((option, index) => (
                            <SelectItem
                                value={option.value}
                                key={`${option.value}${index}`}
                                id={formatTestId("select_field_item", `${option.label}`)}
                                data-testid={formatTestId("select_field_item", `${option.label}`)}
                            >
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                </SelectContent>
            </Select>
            {field.value && (
                <X
                    className="h-4 w-4 opacity-60 hover:opacity-100 cursor-pointer"
                    onClick={handlerClear}
                    id={`clear_select_${props.name}`}
                    data-testid={`clear_select_${props.name}`}
                />
            )}
        </div>
    )
}

SelectField.propTypes = {
    name: PropTypes.string.isRequired,
    options: PropTypes.arrayOf(
        PropTypes.shape({
            value: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
                .isRequired,
            label: PropTypes.string.isRequired
        })
    ).isRequired,
    id: PropTypes.string,
    className: PropTypes.string,
    field: PropTypes.object,
    meta: PropTypes.object,
    handle: PropTypes.func
}
