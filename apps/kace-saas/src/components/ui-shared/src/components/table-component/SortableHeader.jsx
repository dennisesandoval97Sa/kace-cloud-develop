import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import PropTypes from "prop-types";

export function SortableHeader({ children, direction, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex items-center gap-1 font-semibold cursor-pointer hover:text-foreground/80 select-none"
        >
            {children}
            {direction === "asc" ? (
                <ChevronUp className="h-4 w-4" />
            ) : direction === "desc" ? (
                <ChevronDown className="h-4 w-4" />
            ) : (
                <ChevronsUpDown className="h-4 w-4 opacity-40" />
            )}
        </button>
    );
}

SortableHeader.propTypes = {
    children: PropTypes.node,
    direction: PropTypes.oneOf(["asc", "desc", null, false]),
    onClick: PropTypes.func.isRequired,
};
