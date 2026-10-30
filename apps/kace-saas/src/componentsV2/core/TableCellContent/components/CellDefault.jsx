import PropTypes from "prop-types";
import { isEmptyClassificationValue } from "@/pages/Cases/components/CaseDataTable/utils/classificationLevels.util";
import { EmptyTableCell } from "../utils/emptyTableCell";

const CellDefault = ({ row, accessorKey }) => {
    const value = row.original[accessorKey];

    if (isEmptyClassificationValue(value)) {
        return <EmptyTableCell />;
    }

    return <span>{value}</span>;
};

CellDefault.propTypes = {
    row: PropTypes.object.isRequired,
    accessorKey: PropTypes.string.isRequired,
};

export default CellDefault;
