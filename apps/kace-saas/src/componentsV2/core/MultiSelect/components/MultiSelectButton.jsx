import { Button } from "@/components/ui-shared";
import PropTypes from "prop-types";

const MultiSelectButton = ({
    id = "btn_select_combo_box",
    isDisabled = false,
    placeholder = "Opciones...",
    variant = "default",
}) => {
    return (
        <Button
            className="justify-between w-full"
            data-testid={`btn_select_combo_box`}
            disabled={isDisabled}
            id={id}
            type="button"
            variant={variant}
        >
            <span className="w-full text-start truncate">{`${placeholder}`}</span>
        </Button>
    );
};

MultiSelectButton.propTypes = {
    id: PropTypes.string,
    isDisabled: PropTypes.bool,
    selectedData: PropTypes.arrayOf(PropTypes.object),
    placeholder: PropTypes.string,
    variant: PropTypes.string,
};

export default MultiSelectButton;
