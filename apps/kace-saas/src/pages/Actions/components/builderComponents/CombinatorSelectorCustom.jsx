import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@kace/ui-shared";
import PropTypes from "prop-types";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export const CombinatorSelectorCustom = ({ ...props }) => {
    const { t } = useTranslation();
    const [isDisabled, setIsDisabled] = useState(false);
    const { handleOnChange, options, testID, title, value, disabled, rule } = props;
    useEffect(() => {
        if (rule) {
            setIsDisabled(rule.field === "");
        }
    }, [rule, disabled]);
    return (
        <Select
            onValueChange={(value) => {
                handleOnChange(value);
            }}
            data-testid={`combinator_select_${testID}`}
            id={`combinator_select_${testID}`}
            value={value}
            disabled={isDisabled}
        >
            <SelectTrigger
                className="lg:w-auto flex gap-2 min-w-16"
                data-testid={`combinator_trigger_${testID}`}
                id={`combinator_trigger_${testID}`}
            >
                <SelectValue
                    placeholder={
                        title !== "Combinators"
                            ? t("actions.querybuilder.operators")
                            : t("actions.querybuilder.conditions")
                    }
                />
            </SelectTrigger>
            <SelectContent
                data-testid={`combinator_select_content_${testID}`}
                id={`combinator_select_content_${testID}`}
            >
                <SelectGroup>
                    <SelectLabel>
                        {title !== "Combinators"
                            ? t("actions.querybuilder.operators")
                            : t("actions.querybuilder.conditions")}
                    </SelectLabel>
                    {options.map((item) => (
                        <SelectItem
                            key={item.value}
                            value={item.value}
                            data-testid={`combinator_option_${testID}_${item.value}`}
                            id={`combinator_option_${testID}_${item.value}`}
                        >
                            {t(`actions.querybuilder.operatorLabels.${item.value}`, item.label)}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
};

CombinatorSelectorCustom.propTypes = {
    handleOnChange: PropTypes.func.isRequired,
    options: PropTypes.array.isRequired,
    testID: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
    disabled: PropTypes.bool.isRequired,
    rule: PropTypes.object,
};
