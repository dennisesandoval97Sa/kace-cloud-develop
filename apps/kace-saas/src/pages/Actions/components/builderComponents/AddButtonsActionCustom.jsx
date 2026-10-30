import { Button } from "@kace/ui-shared";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";

export const AddButtonsActionCustom = ({ ...props }) => {
    const { t } = useTranslation();
    const { handleOnClick, label, level } = props;
    const isRuleLabel = label.toLowerCase().includes("rule");

    if (!level && isRuleLabel) return null;

    const translatedLabel = t(isRuleLabel ? "actions.querybuilder.addRule" : "actions.querybuilder.addGroup", label);
    return (
        <Button
            className={`flex gap-2 h-8 font-semibold
                ${isRuleLabel ? "bg-yellowCustom hover:bg-yellowCustom/80" : "bg-blueCustom hover:bg-blueCustom/80"} `}
            onClick={handleOnClick}
            data-testid={`btn_${isRuleLabel ? "add_rule" : "add_group"}`}
            id={`btn_${isRuleLabel ? "add_rule" : "add_group"}`}
        >
            {translatedLabel}
        </Button>
    );
};

AddButtonsActionCustom.propTypes = {
    handleOnClick: PropTypes.func.isRequired,
    label: PropTypes.string.isRequired,
    level: PropTypes.number.isRequired,
};
