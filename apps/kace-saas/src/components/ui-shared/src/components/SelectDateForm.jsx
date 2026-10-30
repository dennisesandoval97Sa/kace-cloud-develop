import { DatePicker } from "../components/date-picker/date-picker"
import { Label } from "./ui/label"

export const SelectDateForm = ({
    setValue,
    value = "",
    name = "",
    title,
    error,
    touched = false
}) => {
    const handleNewValue = (newValue) => {
        const formatNewDate = newValue.toISOString()
        setValue(name, formatNewDate)
    }
    return (
        <div className="flex flex-col gap-2">
            <div
                className={`flex justify-between font-semibold text-sm ${error && touched && "text-redCustom"}`}
            >
                <Label className="font-semibold text-sm">{title}</Label>
                {error && touched && <span>{error}</span>}
            </div>
            <DatePicker onChange={handleNewValue} value={value} />
        </div>
    )
}
