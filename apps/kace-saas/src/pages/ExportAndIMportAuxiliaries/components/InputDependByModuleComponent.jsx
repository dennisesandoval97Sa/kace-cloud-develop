import { SwitchStateAdmin } from "@/components/core/switchState/SwitchStateAdmin"
import { DatePickerWithRange } from "@/components/ui-shared/src/components/DatePickerWithRange"
import { ComboBoxForValue } from "@/components/ui-shared/src/components/comboBoxForValue/ComboBoxForValue"
import { InputForm as Input, KField, Label } from "@kace/ui-shared"
import PropTypes from "prop-types"

export const InputDependByModuleComponent = ({
    objectModule = null,
    setFieldValue,
    value
}) => {
    if (objectModule.type === "string") {
        return (
            <div className="p-2 rounded-md flex-1 min-w-[300px]">
                <KField>
                    <Input
                        name={objectModule.column}
                        label={objectModule.label}
                        type={objectModule.typeInput}
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
            </div>
        )
    }
    if (objectModule.type === "boolean") {
        return (
            <div className="p-2 rounded-md flex-1 min-w-[300px] flex items-end">
                <SwitchStateAdmin name={objectModule.column} className="w-full"/>
            </div>
        )
    }
    if (objectModule.type === "date") {
        return (
            <div className="p-2 rounded-md flex-1 min-w-[300px]">
                <Label>{objectModule.label}</Label>
                <DatePickerWithRange
                    noInitialDate
                    onChange={(value) =>
                        setFieldValue(objectModule.column, value)
                    }
                    name={objectModule.column}
                />
            </div>
        )
    }
    if (objectModule.type === "search") {
        return (
            <div className="p-2 rounded-md flex-1 min-w-[300px]">
                <Label>{objectModule.label}</Label>
                <ComboBoxForValue
                    onChange={(value) => setFieldValue(objectModule.column, value)}
                    name={objectModule.column}
                    value={value}
                />
            </div>
        )
    }
}

InputDependByModuleComponent.propTypes = {
    objectModule: PropTypes.object,
    setFieldValue: PropTypes.func,
    value: PropTypes.any
}
