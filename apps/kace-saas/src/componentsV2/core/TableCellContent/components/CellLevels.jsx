import PropTypes from "prop-types";
import { ChevronRight, ChevronDown } from "lucide-react";
import {
    getClassificationDisplay,
    getSeparatorClassificationDisplay,
} from "@/pages/Cases/components/CaseDataTable/utils/classificationLevels.util";
import { EmptyTableCell } from "../utils/emptyTableCell";

const CellLevels = ({ row, accessorKey = "nivel1", separator }) => {
    const rootKey = accessorKey || "nivel1";
    const { label, count, hasExpandableChildren } = separator
        ? getSeparatorClassificationDisplay(row.original, rootKey, separator)
        : getClassificationDisplay(row.original, rootKey);
    const isExpanded = row.getIsExpanded();

    if (!count) {
        return <EmptyTableCell />;
    }

    return (
        <div className="flex gap-2 items-center">
            <div className="flex items-center justify-center border border-greenCustom rounded-full bg-greenCustom/40 text-greenCustom">
                <p className="h-6 w-6 flex justify-center items-center font-semibold text-lg">{count}</p>
                {hasExpandableChildren ? (
                    <button type="button" onClick={() => row.toggleExpanded()}>
                        {isExpanded ? <ChevronDown /> : <ChevronRight />}
                    </button>
                ) : (
                    <ChevronRight className="opacity-50" />
                )}
            </div>
            <span className="flex justify-center items-center">{label}</span>
        </div>
    );
};

CellLevels.propTypes = {
    row: PropTypes.object.isRequired,
    accessorKey: PropTypes.string,
    separator: PropTypes.string,
};

export default CellLevels;
