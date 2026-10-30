import { Button } from "@/components/ui-shared";
import PropTypes from "prop-types";
import { ChevronsUpDown } from "lucide-react";

const MultiSelectInput = ({ isDisabled = false, selectedData = [], placeholder = "Opciones..." }) => {
    return <Button
        variant="outline"
        className="justify-between w-full"
        data-testid={`btn_select_combo_box`}
        disabled={isDisabled}
        id={`btn_select_combo_box`}
        type="button"
    >
        <span
            className="w-full text-start truncate"
        >
            {selectedData.length ? selectedData[0]?.label : `${placeholder}`}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>;
};

MultiSelectInput.propTypes = {
    isDisabled: PropTypes.bool,
    selectedData: PropTypes.arrayOf(PropTypes.object),
    placeholder: PropTypes.string,
};

export default MultiSelectInput;
