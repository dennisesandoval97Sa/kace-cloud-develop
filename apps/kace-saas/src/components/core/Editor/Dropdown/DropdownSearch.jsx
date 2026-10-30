import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";

export const DropdownSearch = ({ value, onChange, placeholder }) => {
    const { t } = useTranslation();
    return (
        <div className="px-2 py-1 border-b">
            <input
                type="search"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder={placeholder ?? t("app.dropdown.searchPlaceholder")}
                aria-label={t("app.dropdown.searchAriaLabel")}
                className="w-full px-2 py-1 text-sm rounded border focus:outline-none focus:ring-1"
            />
        </div>
    );
};

DropdownSearch.propTypes = {
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    placeholder: PropTypes.string,
};
