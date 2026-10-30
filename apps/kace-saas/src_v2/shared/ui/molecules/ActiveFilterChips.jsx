import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, Portal } from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import Button from "@kace_v2/shared/ui/atoms/Button";
import DialogOverlay from "@kace_v2/shared/ui/atoms/DialogOverlay";
import DialogContent from "@kace_v2/shared/ui/atoms/DialogContent";
import DialogClose from "@kace_v2/shared/ui/atoms/DialogClose";
import DialogTitle from "@kace_v2/shared/ui/atoms/DialogTitle";
import { cn } from "@kace_v2/shared/utils/cn.util";
import { formatColumnLabel } from "@kace_v2/shared/utils/format-column-label.util";
import { inferIsStatusColumn, isRawUnifiedActive } from "@kace_v2/features/boards/utils/boardStatusColumn.util";

const MAX_VISIBLE_CHIPS = 3;

const findColumnByFilterField = (columns, entity, field) => {
    if (!Array.isArray(columns) || field === undefined || field === null) return null;
    const f = String(field);
    return (
        columns.find((c) => {
            if (!c) return false;
            const entityMatch = !entity || c.entity === entity;
            if (!entityMatch) return false;
            return c.alias === f || c.field === f || (typeof c.field === "string" && c.field.split(".").pop() === f);
        }) ?? null
    );
};

const formatFilterValueForDisplay = (operator, value) => {
    if (value === undefined || value === null) return "";
    if (operator === "between" && typeof value === "string") {
        const parts = value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        if (parts.length >= 2) {
            return parts
                .map((part) => {
                    const d = new Date(part);
                    return Number.isNaN(d.getTime()) ? part : d.toLocaleString();
                })
                .join(" — ");
        }
        const d = new Date(value.trim());
        if (!Number.isNaN(d.getTime())) return d.toLocaleString();
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
            const d = new Date(trimmed);
            if (!Number.isNaN(d.getTime())) return d.toLocaleString();
        }
    }
    return String(value);
};

const formatChipDisplayValue = (chip, columns, t) => {
    if (chip.displayValue !== undefined && chip.displayValue !== null && chip.displayValue !== "") {
        return String(chip.displayValue);
    }
    const col = findColumnByFilterField(columns, chip.entity, chip.field);
    if (
        col &&
        inferIsStatusColumn(col) &&
        chip.operator === "eq" &&
        chip.value !== null &&
        chip.value !== undefined &&
        chip.value !== ""
    ) {
        return isRawUnifiedActive(chip.value)
            ? t("boards.boardView.status.active", { defaultValue: "Activo" })
            : t("boards.boardView.status.inactive", { defaultValue: "Inactivo" });
    }
    return formatFilterValueForDisplay(chip.operator, chip.value);
};

const FilterChip = ({ chip, displayValue, className, dense = true }) => (
    <span
        className={cn(
            "inline-flex items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground",
            dense ? "max-w-[150px] truncate" : "max-w-full break-words whitespace-normal",
            className,
        )}
    >
        <span className="shrink-0 font-semibold text-foreground">{chip.label}</span>
        {chip.operator !== "null" && chip.operator !== "notNull" && displayValue !== "" && (
            <>
                <span className="shrink-0">:</span>
                <span
                    className={cn("text-foreground", dense ? "min-w-0 truncate" : "min-w-0")}
                    title={dense ? displayValue : undefined}
                >
                    {displayValue}
                </span>
            </>
        )}
    </span>
);

const ActiveFilterChips = ({ criteria, columns }) => {
    const { t } = useTranslation();
    const [modalOpen, setModalOpen] = useState(false);

    const chips = useMemo(() => {
        if (!criteria || !Array.isArray(criteria.filter) || criteria.filter.length === 0) return [];
        return criteria.filter.flatMap((f) => {
            if (f.groupType && Array.isArray(f.filters)) {
                return f.filters.map((subF) => ({
                    label: formatColumnLabel(subF.field ?? ""),
                    field: subF.field,
                    entity: subF.entity,
                    value: subF.value,
                    displayValue: subF.displayValue,
                    operator: subF.operator,
                }));
            }
            return [
                {
                    label: formatColumnLabel(f.field ?? ""),
                    field: f.field,
                    entity: f.entity,
                    value: f.value,
                    displayValue: f.displayValue,
                    operator: f.operator,
                },
            ];
        });
    }, [criteria]);

    if (chips.length === 0) return null;

    const visibleChips = chips.slice(0, MAX_VISIBLE_CHIPS);
    const hiddenCount = chips.length - visibleChips.length;

    return (
        <div className="flex flex-wrap items-center gap-1">
            {visibleChips.map((chip, index) => (
                <FilterChip
                    key={`${chip.label}-${chip.operator ?? ""}-${index}`}
                    chip={chip}
                    displayValue={formatChipDisplayValue(chip, columns, t)}
                />
            ))}
            {hiddenCount > 0 && (
                <>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 min-h-6 px-2 text-[11px] leading-none"
                        onClick={() => setModalOpen(true)}
                    >
                        {t("boards.boardView.moreActiveFilters", { count: hiddenCount })}
                    </Button>
                    <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                        <Portal>
                            <DialogOverlay />
                            <DialogContent className="flex max-h-[min(85vh,36rem)] w-full max-w-lg flex-col gap-4 overflow-hidden p-6">
                                <DialogClose>
                                    <Button size="icon" variant="outline" type="button">
                                        <X className="h-4 w-4" />
                                    </Button>
                                </DialogClose>
                                <DialogTitle className="shrink-0 pr-8">
                                    {t("boards.boardView.activeFiltersModalTitle")}
                                </DialogTitle>
                                <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch]">
                                    <ul className="flex list-none flex-col gap-2 pr-1">
                                        {chips.map((chip, index) => (
                                            <li
                                                key={`modal-${chip.label}-${chip.operator ?? ""}-${index}`}
                                                className="w-full min-w-0"
                                            >
                                                <FilterChip
                                                    chip={chip}
                                                    displayValue={formatChipDisplayValue(chip, columns, t)}
                                                    dense={false}
                                                />
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </DialogContent>
                        </Portal>
                    </Dialog>
                </>
            )}
        </div>
    );
};

export default ActiveFilterChips;
