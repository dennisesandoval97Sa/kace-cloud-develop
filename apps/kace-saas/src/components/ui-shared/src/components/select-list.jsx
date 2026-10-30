import { forwardRef, useEffect, useState } from "react"
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectGroup,
    SelectLabel,
    SelectItem
} from "./ui/select"
import PropTypes from "prop-types"
import { t } from "i18next"
import { formatTestId } from "@/utils/src/helpers"

const SelectList = forwardRef(({
    value,
    onChange,
    options = [],
    disabled = false,
}, ref) => {
    const [optionsFormat, setOptionsFormat] = useState([])
    useEffect(() => {
        if (options.length > 0) {
            setOptionsFormat(options.map((option) => {
                if (typeof option === "string") {
                    return { value: option, name: option }
                }

                return option
            }))
        }
    }, [options])
    return (
        <Select onValueChange={onChange} defaultValue={value} id={formatTestId("select_list", `${value}`)} data-testid={formatTestId("select_list", `${value}`)}>
            <SelectTrigger disabled={disabled} className="w-full" data-testid="btn_select_list_content" id="select_list_content">
                <SelectValue
                    placeholder="Seleccione una opción"
                    ref={ref}
                    id={formatTestId("select_list_value", `${value}`)}
                    data-testid={formatTestId("select_list_value", `${value}`)}
                />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup data-testid="select_list_group" id="select_list_group">
                    <SelectLabel id="select_list_options" data-testid="select_list_options">
                        {t("app.forms.optionsLabel")}
                    </SelectLabel>
                    {optionsFormat.map((option) => (
                        <SelectItem
                            value={option.value}
                            key={option.value}
                            id={formatTestId("select_list", `${option.name}`)}
                            data-testid={formatTestId("select_list", `${option.name}`)}
                        >
                            {option.name}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
})

SelectList.displayName = "SelectList"

SelectList.propTypes = {
    selectValue: PropTypes.string,
    options: PropTypes.array,
    onChange: PropTypes.func,
    value: PropTypes.string,
    disabled: PropTypes.bool,
}

export default SelectList
