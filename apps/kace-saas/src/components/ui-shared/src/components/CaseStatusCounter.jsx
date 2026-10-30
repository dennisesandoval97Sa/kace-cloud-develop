import PropTypes from "prop-types";
import { getContrastForeground } from "@kace_v2/shared/utils/get-contrast-foreground.util";
import { cn } from "../lib/utils";

export const CaseStatusCounter = ({ title, icon, number, color = null, compact = false }) => {
    const foreground = getContrastForeground(color);
    return (
        <div
            className={cn(
                "flex items-center border border-black/10 transition-all duration-200 hover:border-black/15",
                compact
                    ? "h-6 min-h-[1.5rem] gap-0.5 rounded-sm border px-1.5 py-px hover:shadow-sm"
                    : "h-9 gap-2 rounded-lg px-3 py-2 hover:shadow-md",
            )}
            style={{ backgroundColor: color }}
        >
            {icon ? (
                <span className="flex shrink-0 items-center" style={{ color: foreground }}>
                    {icon}
                </span>
            ) : null}
            <div
                className={cn("flex min-w-0 items-baseline", compact ? "flex-nowrap gap-0.5" : "gap-2")}
                style={{ color: foreground }}
            >
                <span
                    className={cn("tabular-nums", compact ? "text-xs font-bold leading-none" : "text-xl font-semibold")}
                >
                    {number}
                </span>
                <span
                    className={cn(
                        "truncate opacity-90",
                        compact ? "max-w-[3.75rem] text-[10px] font-bold leading-tight" : "text-xs",
                    )}
                >
                    {title}
                </span>
            </div>
        </div>
    );
};

CaseStatusCounter.propTypes = {
    title: PropTypes.string.isRequired,
    icon: PropTypes.node,
    number: PropTypes.number.isRequired,
    color: PropTypes.string,
    compact: PropTypes.bool,
};
