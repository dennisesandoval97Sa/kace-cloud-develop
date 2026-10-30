import { ChevronsUpDown } from "lucide-react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";

const MAX_VISIBLE = 3;

const MultiSelectCompact = ({ selectedData = [], isLoading = false, placeholder = null }) => {
    const { t } = useTranslation();

    let displayText;
    if (isLoading) {
        displayText = t("genericTexts.loading");
    } else if (selectedData.length === 0) {
        displayText = placeholder || t("genericTexts.notingSelected");
    } else if (selectedData.length <= MAX_VISIBLE) {
        displayText = selectedData.map((i) => i.label).join(", ");
    } else {
        const visible = selectedData
            .slice(0, MAX_VISIBLE)
            .map((i) => i.label)
            .join(", ");
        displayText = `${visible} +${selectedData.length - MAX_VISIBLE}`;
    }

    return (
        <div className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm cursor-pointer">
            <span className="truncate text-left text-muted-foreground">{displayText}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </div>
    );
};

MultiSelectCompact.propTypes = {
    selectedData: PropTypes.array,
    isLoading: PropTypes.bool,
    placeholder: PropTypes.string,
};

export default MultiSelectCompact;
