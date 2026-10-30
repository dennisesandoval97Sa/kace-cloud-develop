import PropTypes from "prop-types";
import { Button } from "@/components/ui-shared";

const CreateClientButton = ({ onClick, disabled = false, className = "", label }) => {
    return (
        <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={disabled}
            onClick={onClick}
            data-testid="btn_create_client"
            className={className}
            id="btn_create_client"
        >
            {label}
        </Button>
    );
};

CreateClientButton.propTypes = {
    onClick: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
    className: PropTypes.string,
    label: PropTypes.string,
};

export default CreateClientButton;
