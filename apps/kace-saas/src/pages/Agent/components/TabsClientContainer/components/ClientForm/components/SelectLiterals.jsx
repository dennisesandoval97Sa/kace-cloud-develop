import { formatTestId } from "@/utils/src/helpers"
import {
    cn,
    Label,
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue
} from "@kace/ui-shared"
import { PropTypes } from "prop-types"
import { useEffect, useState } from "react"

export const SelectLiterals = ({
    handleOptions,
    currentData = {},
    name = "",
    value = "",
    error = "",
    touched = false,
    setField,
    fieldLabel = "",
    disabled = false,
    initialValue
}) => {
    const [options, setOptions] = useState([])
    const [label, setLabel] = useState("")
    const [selectedValue, setSelectedValue] = useState(value)

    useEffect(() => {
        const { label, data: newOptions } = handleOptions(name, currentData)
        setOptions(newOptions ?? [])
        setLabel(label || fieldLabel)
    }, [currentData, name, fieldLabel, handleOptions])

    useEffect(() => {
        if (value !== "") {
            setSelectedValue(value)
        } else {
            setSelectedValue(initialValue)
        }
    }, [value, currentData, initialValue])

    return (
        <div className="flex flex-col gap-2">
            <div className="flex justify-between">
                <Label
                    className={cn(error && touched && "text-redCustom")}
                    id={formatTestId("select_literals", `${label}`)}
                    data-testid={formatTestId("select_literals", `${label}`)}
                >
                    {label}
                </Label>
                {error && touched && <Label className="text-redCustom font-semibold">{error}</Label>}
            </div>
            <Select
                onValueChange={(newValue) => {
                    setSelectedValue(newValue);
                    setField(name, newValue);
                }}
                value={selectedValue}
                disabled={disabled}
                id={formatTestId("select_literals", `${selectedValue || "empty"}`)}
                data-testid={formatTestId("select_literals", `${selectedValue || "empty"}`)}
            >
                <SelectTrigger
                    className={cn("w-full", error && touched && "border-redCustom text-redCustom")}
                    id="select_literals_options"
                    data-testid="select_literals_options"
                >
                    <SelectValue placeholder="Seleccione una opción" />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup defaultValue={selectedValue} id="select_literals_groups" data-testid="select_literals_groups">
                        <SelectLabel>Opciones</SelectLabel>
                        {options.map((option, index) => (
                            <SelectItem value={option.value} key={`${option.value}${index}`}
                                id={formatTestId("select_literals_item", `${option.label}`)}
                                data-testid={formatTestId("select_literals_item", `${option.label}`)}
                            >
                                <span className="flex gap-2 items-center">{option.label}</span>
                            </SelectItem>
                        ))}
                    </SelectGroup>
                </SelectContent>
            </Select>
        </div>
    );
}

SelectLiterals.propTypes = {
    handleOptions: PropTypes.func,
    currentData: PropTypes.object,
    name: PropTypes.string,
    value: PropTypes.string,
    error: PropTypes.string,
    touched: PropTypes.bool,
    setField: PropTypes.func,
    disabled: PropTypes.bool,
    fieldLabel: PropTypes.string,
    initialValue: PropTypes.string
}
