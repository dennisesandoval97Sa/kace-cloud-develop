import { cn } from "@/components/ui-shared";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";

const MultiSelectDefault = ({ dataTestid, selectedData = [], isLoading = false }) => {
    const { t } = useTranslation();
    return <div
        className={cn(
            "flex gap-2 min-h-24 w-auto border-input border-2 justify-center items-center rounded-md text-left flex-wrap p-2 overflow-hidden cursor-pointer",
            { "cursor-no-drop": isLoading },
        )}
        id={`trigger_multiselect_${dataTestid}`}
        data-testid={`trigger_multiselect_${dataTestid}`}
    >
        {isLoading ? (
            <p>{t("genericTexts.loading")}</p>
        ) : selectedData.length === 0 ? (
            <span>{t("genericTexts.notingSelected")}</span>
        ) : (
            <>
                {selectedData.slice(0, 5).map((item, index) => (
                    <div key={item.id} className="bg-blueCustom rounded-full px-3 py-1 text-white">
                        {item.label}
                    </div>
                ))}
            </>
        )}
    </div>;
};

MultiSelectDefault.propTypes = {
    dataTestid: PropTypes.string.isRequired,
    selectedData: PropTypes.array.isRequired,
    isLoading: PropTypes.bool,

};

export default MultiSelectDefault;
