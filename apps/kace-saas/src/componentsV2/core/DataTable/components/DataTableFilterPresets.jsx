import { memo, useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    Button,
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui-shared";
import { Filter, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

const DataTableFilterPresets = ({
    onFilterSelect,
    onDeleteFilter = null,
    savedFilterList = [],
    selectedFilter = null,
}) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [currentFilter, setCurrentFilter] = useState(selectedFilter);
    const [pendingDelete, setPendingDelete] = useState(null);

    useEffect(() => {
        setCurrentFilter(selectedFilter);
    }, [selectedFilter]);

    const handleSelect = (filterName) => {
        onFilterSelect(filterName);
        setCurrentFilter(filterName);
        setOpen(false);
    };

    const confirmDelete = async () => {
        const filterToDelete = pendingDelete;
        if (!filterToDelete) return;
        const deleted = await onDeleteFilter?.(filterToDelete);
        if (deleted) {
            setCurrentFilter((current) => (current === filterToDelete ? null : current));
        }
        setPendingDelete(null);
    };

    return (
        <>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        className={`w-auto justify-start max-w-80 truncate ${currentFilter && "bg-greenCustom/40"}`}
                        id="dt_filter_dropdown"
                        data-testid="dt_filter_dropdown"
                    >
                        {currentFilter ? (
                            <span className="flex gap-2 items-center font-semibold text-greenCustom">
                                <Filter />
                                {currentFilter}
                            </span>
                        ) : (
                            <span className="flex gap-2">
                                <Filter width={18} height={18} /> {t("app.text.savedFilters")}
                            </span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[240px] p-0" align="start">
                    <Command>
                        <CommandInput
                            placeholder={t("app.text.filterName")}
                            id="dt_filter_input"
                            data-testid="dt_filter_input"
                        />
                        <CommandList>
                            <CommandEmpty id="dt_filter_empty" data-testid="dt_filter_empty">
                                {t("app.text.noResultsFound")}
                            </CommandEmpty>
                            <CommandGroup>
                                {savedFilterList.filter(Boolean).map((filterName) => (
                                    <CommandItem
                                        key={filterName}
                                        className="flex items-center justify-between gap-1 pr-1"
                                        value={filterName}
                                        onSelect={() => handleSelect(filterName)}
                                        id={`dt_filter_${filterName}`}
                                        data-testid={`dt_filter_${filterName}`}
                                    >
                                        <span className="min-w-0 flex-1 truncate">{filterName}</span>
                                        {onDeleteFilter && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                                                id={`dt_filter_delete_${filterName}`}
                                                data-testid={`dt_filter_delete_${filterName}`}
                                                aria-label={`${t("app.text.deleteFilter")} ${filterName}`}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setOpen(false);
                                                    setPendingDelete(filterName);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") e.stopPropagation();
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            <AlertDialog
                open={!!pendingDelete}
                onOpenChange={(nextOpen) => {
                    if (!nextOpen) setPendingDelete(null);
                }}
            >
                <AlertDialogContent
                    className="w-[calc(100%-2rem)] max-w-md"
                    id="filter_delete_alert"
                    data-testid="filter_delete_alert"
                >
                    <AlertDialogHeader>
                        <AlertDialogTitle data-testid="filter_delete_alert_title">
                            {t("app.text.deleteFilter")}
                        </AlertDialogTitle>
                        <AlertDialogDescription data-testid="filter_delete_alert_description">
                            {t("app.text.confirmDeleteFilter")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel id="filter_delete_alert_cancel" data-testid="filter_delete_alert_cancel">
                            {t("app.forms.cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            id="filter_delete_alert_confirm"
                            data-testid="filter_delete_alert_confirm"
                            onClick={(event) => {
                                event.preventDefault();
                                confirmDelete();
                            }}
                        >
                            {t("app.text.deleteFilter")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

DataTableFilterPresets.propTypes = {
    onFilterSelect: PropTypes.func.isRequired,
    onDeleteFilter: PropTypes.func,
    savedFilterList: PropTypes.arrayOf(PropTypes.string).isRequired,
    selectedFilter: PropTypes.string,
};

export default memo(DataTableFilterPresets);
