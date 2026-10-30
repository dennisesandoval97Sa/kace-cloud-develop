import SelectList from "../select-list"
import { Input } from "../ui/input"
import { Controller } from "react-hook-form"
import { SwitchState } from "../SwitchState"
import { es } from "date-fns/locale"
import { DatePickerWithRange } from "../DatePickerWithRange"
import { SelectColors } from "../SelectColors"
import { SelectIcons } from "../SelectIcons"
import { ComboBoxForValue } from "../comboBoxForValue/ComboBoxForValue"
import { SelectByListLevels } from "../SelectByListLevels"

export function InputValueDependDeprecate(
    value = "",
    id = "",
    options = [],
    control,
    setLevel
) {
    const normalizedValue = value?.toLowerCase()
    if (id.includes("nivel1")) {
        return (
            <Controller
                name={id}
                control={control}
                render={({ field }) => (
                    <SelectByListLevels {...field} label={id} setValueOfLevel={setLevel} />
                )}
            />
        )
    }
    if ((id.includes("by") || id === "user_id") && normalizedValue === "string") {
        return (
            <Controller
                name={id}
                control={control}
                render={({ field }) => (
                    <ComboBoxForValue {...field} id={id} className="col-span-3" />
                )}
            />
        )
    }
    if ((normalizedValue === "number" || normalizedValue === "boolean") && (id.includes("status") || id.includes("is_active") || id.includes("is_dynamic_body") || id.includes("is_dynamic_header") || id.includes("value_dynamic"))) {
        return (
            <Controller
                name={id}
                control={control}
                render={({ field }) => (
                    <SwitchState {...field} />
                )}
            />
        )
    }
    if (normalizedValue === "string" && id.includes("color")) {
        return (
            <Controller
                name={id}
                control={control}
                render={({ field }) => {
                    return <SelectColors {...field} id={id} className="col-span-4" />
                }}
            />
        )
    }
    if (normalizedValue === "string" && id.includes("icon_class")) {
        return (
            <Controller
                name={id}
                control={control}
                render={({ field }) => {
                    return <SelectIcons {...field} id={id} className="col-span-4" />
                }}
            />
        )
    }
    if (normalizedValue === "string" && id !== "action_type") {
        return (
            <Controller
                name={id}
                control={control}
                render={({ field }) => {
                    return <Input {...field} id={id} className="col-span-3" />
                }}
            />
        )
    }
    if (normalizedValue === "number") {
        return (
            <Controller
                name={id}
                control={control}
                render={({ field }) => {
                    return <Input {...field} id={id} className="col-span-3" type="number" onChange={(e) => {
                        field.onChange(e.target.valueAsNumber || 0)
                    }} />
                }}
            />
        )
    }
    if (normalizedValue === "list" || id.includes("action_type")) {
        return (
            <Controller
                name={id}
                control={control}
                render={({ field }) => (
                    <SelectList {...field} label={id} options={options} />
                )}
            />
        )
    }
    if (normalizedValue === "date" || id.includes("fecha")) {
        return (
            <Controller
                name={id}
                control={control}
                render={({ field }) => <DatePickerWithRange {...field} setValue={field.setValue} id={id} locale={es} />}
            />
        )
    }
}
