import PropTypes from "prop-types";
import { formatTableDateTime } from "@/utils/main";
import { isEmptyClassificationValue } from "@/pages/Cases/components/CaseDataTable/utils/classificationLevels.util";
import { EmptyTableCell } from "../utils/emptyTableCell";

const CellDate = ({ row, accessorKey }) => {
    const value = row.original[accessorKey];

    if (isEmptyClassificationValue(value)) {
        return <EmptyTableCell />;
    }

    return <span>{formatTableDateTime(value)}</span>;
};

CellDate.propTypes = {
    row: PropTypes.object.isRequired,
    accessorKey: PropTypes.string.isRequired,
};

export default CellDate;
