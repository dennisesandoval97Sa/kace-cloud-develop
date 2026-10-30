import PropTypes from "prop-types";
import { Input } from "@/components/ui-shared";
import { useTranslation } from "react-i18next";

const MassiveExecutionInput = ({ defaultValue = "", handleChange = () => {}, placeholder }) => {
    const { t } = useTranslation();

    return (
        <Input
            placeholder={placeholder ?? t("massiveExecution.auxClient.valuePlaceholder")}
            value={defaultValue}
            onChange={handleChange}
            className="flex-1"
        />
    );
};

MassiveExecutionInput.propTypes = {
    defaultValue: PropTypes.string,
    handleChange: PropTypes.func,
    placeholder: PropTypes.string,
};

export default MassiveExecutionInput;
