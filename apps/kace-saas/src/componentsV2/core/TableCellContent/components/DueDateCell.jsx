import PropTypes from "prop-types";
import { isEmptyClassificationValue } from "@/pages/Cases/components/CaseDataTable/utils/classificationLevels.util";
import { EmptyTableCell } from "../utils/emptyTableCell";

const DueDateCell = ({ value, ansColor }) => {
    if (isEmptyClassificationValue(value)) {
        return <EmptyTableCell />;
    }

    return (
        <div className="flex items-center gap-2">
            <span
                className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: ansColor || "transparent" }}
            />
            <span>{value}</span>
        </div>
    );
};

DueDateCell.propTypes = {
    value: PropTypes.string,
    ansColor: PropTypes.string,
};

export default DueDateCell;
