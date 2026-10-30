import PropTypes from "prop-types";
import { isEmptyClassificationValue } from "@/pages/Cases/components/CaseDataTable/utils/classificationLevels.util";

export const EMPTY_TABLE_CELL_LABEL = "-";

export const EmptyTableCell = () => <span className="text-slate-400">{EMPTY_TABLE_CELL_LABEL}</span>;

export const formatTableCellValue = (value) => {
    if (isEmptyClassificationValue(value)) {
        return EMPTY_TABLE_CELL_LABEL;
    }

    return value;
};

EmptyTableCell.propTypes = {};
