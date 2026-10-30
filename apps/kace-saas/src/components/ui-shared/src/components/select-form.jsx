import PropTypes from "prop-types";
import {
    Select as SelectCustom,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue
} from "./ui/select"
import { useField } from "formik"
import { Label } from "./ui/label"
import { cn } from "../lib/utils"
import { useTranslation } from "react-i18next"
import { formatTestId } from "@/utils/src/helpers"

export const SelectForm = ({
    options = [],
    label = "",
    className = "w-full",
    dependentFieldId = "",
    handle = () => null,
    optionsLabels = [],
    ...props
}) => {
    const { t } = useTranslation();
    const [field, meta, helpers] = useField(props);
    const id = props.id ? props.id : props.name;
    const handleChange = (value) => {
        helpers.setValue(value);
        handle(value);
    };
    return (
        <div className={cn("flex flex-col gap-2", className)}>
            <div className="flex justify-between w-full items-center">
                <Label
                    htmlFor={id}
                    className={`text-sm text-right flex justify-end ${meta.touched && meta.error && "text-redCustom font-semibold"}`}
                    id={formatTestId("select_form", `${label}`)}
                    data-testid={formatTestId("select_form", `${label}`)}
                >
                    {label}
                </Label>
                {meta.touched && meta.error && (
                    <Label
                        className="text-redCustom font-semibold"
                        id="select_form_error"
                        data-testid="select_form_error"
                    >
                        {meta.error}
                    </Label>
                )}
            </div>
            <SelectCustom
                id={id}
                data-testid={formatTestId(("select_form_custom", `${field.value || id}`))}
                data-dependent-field-id={dependentFieldId}
                onValueChange={handleChange}
                value={field.value}
                onBlur={() => helpers.setTouched(true)}
                {...props}
            >
                <SelectTrigger
                    className="w-full"
                    id={formatTestId("btn_select_form_trigger", `${field.value}`, { clean: true })}
                    data-testid={formatTestId("btn_select_form_trigger", `${field.value}`, { clean: true })}
                >
                    <SelectValue placeholder={t("app.forms.options")} />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup defaultValue={field.value} id="select_form_group" data-testid="select_form_group">
                        <SelectLabel>{t("app.forms.optionsLabel")}</SelectLabel>
                        {options.map((option, index) => (
                            <SelectItem value={option.value} key={`${option.value}${index}`} id={formatTestId("select_form_item", `${option.value}`)}
                                data-testid={formatTestId("select_form_item", `${option.value}`)}>
                                <span
                                    className="flex gap-2 items-center"
                                    id={formatTestId("select_form_span", `${option.label}`)}
                                    data-testid={formatTestId("select_form_span", `${option.label}`)}
                                >
                                    {option.icon} {t(option.label)}
                                </span>
                            </SelectItem>
                        ))}

                        {optionsLabels.map((element) => (
                            <SelectGroup
                                key={element.label}
                                id="select_form_group_element"
                                datat-testid="select_form_group_element"
                            >
                                <SelectLabel className="font-bold">{element.label}</SelectLabel>
                                {element.data &&
                                    element.data.map((option, idx) => (
                                        <SelectItem
                                            value={option.value}
                                            key={`${option.value}${idx}`}
                                            className="ml-2"
                                            id={formatTestId("select_form_element_item", `${option.value}${idx}`)}
                                            data-testid={formatTestId(
                                                "select_form_element_item",
                                                `${option.value}${idx}`,
                                            )}
                                        >
                                            {t(option.label)}
                                        </SelectItem>
                                    ))}
                            </SelectGroup>
                        ))}
                    </SelectGroup>
                </SelectContent>
            </SelectCustom>
        </div>
    );
};
SelectForm.propTypes = {
    name: PropTypes.string.isRequired,
    options: PropTypes.arrayOf(
        PropTypes.shape({
            value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
            label: PropTypes.string.isRequired,
        }),
    ).isRequired,
    id: PropTypes.string,
    label: PropTypes.string,
    dependentFieldId: PropTypes.string,
    className: PropTypes.string,
    field: PropTypes.object,
    meta: PropTypes.object,
    handle: PropTypes.func,
    optionsLabels: PropTypes.array,
};
