import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "../ui/alert-dialog";
import PropTypes from "prop-types";
import { Filter, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DEFAULT_FILTER_SCOPE, FILTER_SCOPES, getScopedViewFilters } from "./helpers";

export const SearchFilter = ({
    handleSelectFilter,
    handleDeleteFilter,
    nameTable = "",
    dataUser,
    selectedFilter = null,
    scope = DEFAULT_FILTER_SCOPE,
}) => {
    const [open, setOpen] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState(selectedFilter);
    const [pendingDelete, setPendingDelete] = useState(null);
    const { t } = useTranslation();

    useEffect(() => {
        setSelectedStatus(selectedFilter);
    }, [selectedFilter]);

    const filterSave = useMemo(
        () => Object.keys(getScopedViewFilters(dataUser?.filters, nameTable, scope)),
        [dataUser, nameTable, scope],
    );

    const confirmDelete = async () => {
        const status = pendingDelete;
        if (!status) return;
        const deleted = await handleDeleteFilter?.(status);
        if (deleted) {
            setSelectedStatus((current) => (current === status ? null : current));
        }
        setPendingDelete(null);
    };

    return (
        <>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        className={`w-auto justify-start max-w-80 truncate ${selectedStatus && "bg-greenCustom/40"}`}
                        id="btn_search_filter_save"
                        data-testid="btn_search_filter_save"
                    >
                        {selectedStatus ? (
                            <span
                                className="flex gap-2 items-center font-semibold text-greenCustom"
                                id="search_filter_and_selectstate"
                                data-testid="search_filter_and_selectstate"
                            >
                                <Filter />
                                {selectedStatus}
                            </span>
                        ) : (
                            <span
                                className="flex gap-2"
                                id="search_filter_save_span"
                                data-testid="search_filter_save_span"
                            >
                                <Filter width={18} height={18} />
                                {t("text.saved_filters")}
                            </span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    className="w-[240px] p-0"
                    align="start"
                    data-testid="search_filter_popover"
                    id="search_filter_popover"
                >
                    <StatusList
                        setOpen={setOpen}
                        setSelectedStatus={setSelectedStatus}
                        filterSave={filterSave}
                        handleSelectFilter={handleSelectFilter}
                        onRequestDelete={(status) => {
                            setOpen(false);
                            setPendingDelete(status);
                        }}
                    />
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
                    data-testid="filter_delete_alert"
                    id="filter_delete_alert"
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
                        <AlertDialogCancel data-testid="filter_delete_alert_cancel">
                            {t("app.forms.cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
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

SearchFilter.propTypes = {
    handleSelectFilter: PropTypes.func.isRequired,
    handleDeleteFilter: PropTypes.func,
    nameTable: PropTypes.string,
    dataUser: PropTypes.object,
    selectedFilter: PropTypes.string,
    scope: PropTypes.oneOf(Object.values(FILTER_SCOPES)),
};

const StatusList = ({ setOpen, setSelectedStatus, filterSave = [], handleSelectFilter, onRequestDelete }) => {
    const { t } = useTranslation();
    return (
        <Command>
            <CommandInput
                placeholder={t("app.text.filterName")}
                id="filter_save_input"
                data-testid="filter_save_input"
            />
            <CommandList>
                <CommandEmpty data-testid="filter_empty" id="filter_empty">
                    {t("app.text.noResultsFound")}
                </CommandEmpty>
                <CommandGroup>
                    {filterSave.filter(Boolean).map((status) => (
                        <CommandItem
                            key={status}
                            className="flex items-center justify-between gap-1 pr-1"
                            data-testid={`filter_option_${status}`}
                            id={`filter_option_${status}`}
                            value={status}
                            onSelect={() => {
                                setSelectedStatus(status);
                                setOpen(false);
                                handleSelectFilter(status);
                            }}
                        >
                            <span className="min-w-0 flex-1 truncate">{status}</span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                                data-testid={`filter_delete_${status}`}
                                id={`filter_delete_${status}`}
                                aria-label={`${t("app.text.deleteFilter")} ${status}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onRequestDelete?.(status);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") e.stopPropagation();
                                }}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </CommandItem>
                    ))}
                </CommandGroup>
            </CommandList>
        </Command>
    );
};

StatusList.propTypes = {
    setOpen: PropTypes.func.isRequired,
    setSelectedStatus: PropTypes.func.isRequired,
    filterSave: PropTypes.array,
    handleSelectFilter: PropTypes.func.isRequired,
    onRequestDelete: PropTypes.func,
};
