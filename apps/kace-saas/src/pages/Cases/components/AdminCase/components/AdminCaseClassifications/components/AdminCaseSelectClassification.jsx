import {
    Label,
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue
} from "@kace/ui-shared"
import PropTypes from "prop-types"
import { useTranslation } from "react-i18next"

const AdminCaseSelectClassification = ({
    handle = () => {},
    options = [],
    name = "",
    label = "",
    value = "",
    disabled = false
}) => {
    const { t } = useTranslation()
    return (
        <div className="p-2 flex flex-col gap-2">
            <Label>{t(label)}</Label>
            <Select
                onValueChange={(value) => handle(name, value)}
                name={name}
                value={value}
                disabled={disabled}
            >
                <SelectTrigger className="col-span-2 flex gap-2 rounded-e-none">
                    <SelectValue
                        placeholder={t(
                            "classification.form.placeholder.selectedLevel"
                        )}
                    />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        <SelectLabel>{t("app.forms.optionsLabel")}</SelectLabel>
                        {options.map((option, index) => (
                            <SelectItem key={index} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                </SelectContent>
            </Select>
        </div>
    )
}

AdminCaseSelectClassification.propTypes = {
    options: PropTypes.array,
    handle: PropTypes.func,
    name: PropTypes.string,
    label: PropTypes.string,
    value: PropTypes.string,
    disabled: PropTypes.bool
}

export default AdminCaseSelectClassification
