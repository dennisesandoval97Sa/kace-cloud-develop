import PropTypes from "prop-types";
import { SelectItem } from "../../SelectBase";

const SelectOptions = ({ options, t, translateOptions = true }) => {
    if (Array.isArray(options) && options.length > 0) {
        return (
            <>
                {options?.map((option, index) => (
                    <SelectItem
                        value={option.value}
                        key={`${option.value}${index}`}
                        data-testid={`select_option_${option.value}`}
                        id={`select_option_${option.value}`}
                    >
                        <span className="flex gap-2 items-center">
                            {option.icon}
                            {translateOptions ? t(`fieldsClient.${option.label}`, option.label) : option.label}
                        </span>
                    </SelectItem>
                ))}
            </>
        );
    } else {
        return (
            <div className="flex justify-center items-center p-4">
                <p>{t("generalSetup.form.labels.without_options")}</p>
            </div>
        );
    }
};

SelectOptions.propTypes = {
    t: PropTypes.func.isRequired,
    options: PropTypes.array,
    translateOptions: PropTypes.bool,
};

export default SelectOptions;
