import PropTypes from "prop-types";
import { ChevronRight } from "lucide-react";
import { isEmptyClassificationValue } from "@/pages/Cases/components/CaseDataTable/utils/classificationLevels.util";
import { EmptyTableCell } from "../utils/emptyTableCell";

const CellClassification = ({ row, accessorKey, separator }) => {
    const value = row.original[accessorKey];

    if (isEmptyClassificationValue(value)) {
        return <EmptyTableCell />;
    }

    if (separator && typeof value === "string") {
        const parts = value.split(separator);
        return (
            <div className="flex items-center gap-1 flex-wrap">
                {parts.map((part, index) => (
                    <span key={`${part}-${index}`} className="flex items-center gap-1">
                        {index > 0 && <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" />}
                        <span className="flex items-center">{part}</span>
                    </span>
                ))}
            </div>
        );
    }

    return <span className="flex items-center">{value}</span>;
};

CellClassification.propTypes = {
    row: PropTypes.object.isRequired,
    accessorKey: PropTypes.string.isRequired,
    separator: PropTypes.string,
};

export default CellClassification;
