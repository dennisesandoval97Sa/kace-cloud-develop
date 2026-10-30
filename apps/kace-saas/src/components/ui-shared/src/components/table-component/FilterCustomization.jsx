import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from "../ui/dialog";
import PropTypes from "prop-types";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

import { SearchFilter } from "./search-filter-save";
import { InputValueDepend } from "./InputValueDepend";
import { DialogNewFilter } from "./DialogNewFilter";
import { useForm } from "react-hook-form";
import { LoaderThreeDots } from "../LoaderThreeDots";
import { Filter, RefreshCcw, X } from "lucide-react";
import { useMemo, useState } from "react";
import useHookFilter from "./hooks/useHookFilter";
import { useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { formatFilterBadgeValue, DEFAULT_FILTER_SCOPE, FILTER_SCOPES, getScopedViewFilters } from "./helpers";
import { buildEmptyFilterFormValues, getFilterDialogOpenValues } from "./filterDialogOpenValues";
import { SPECIAL_FIELDS } from "@/services/createSchemaFilter";
import { FilterBadgeUserName } from "./FilterBadgeUserName";

export const FILTER_DIALOG_CONTENT_CLASS =
    "w-[calc(100vw-1.5rem)] max-w-4xl md:max-w-5xl max-h-[min(92vh,56rem)] overflow-hidden flex flex-col";

export const FILTER_DIALOG_FORM_CLASS = "min-h-0 flex-1 overflow-y-auto";

export function FilterCustomization({
    nameHelper = [],
    nameTable = {},
    isLoadingHeaders = false,
    refetch,
    isFetching = false,
    showFilterGeneric,
    columnsToFilter = [],
    fieldsCustomerFilters = null,
    baseFilters = [],
    onClear = null,
    children = null,
    scope = DEFAULT_FILTER_SCOPE,
}) {
    const title = useSelector((state) => state.filterCases.title);
    const { handleSubmit, control, reset, setValue } = useForm({
        defaultValues: {},
    });
    const { t } = useTranslation();
    const pathName = useLocation();
    const [appliedValues, setAppliedValues] = useState({});
    const [selectedSavedFilter, setSelectedSavedFilter] = useState(null);
    const [filterDialogOpen, setFilterDialogOpen] = useState(false);
    const formColumnNames = useMemo(() => columnsToFilter.map(({ column_name }) => column_name), [columnsToFilter]);
    const numberFieldNames = useMemo(
        () =>
            columnsToFilter
                .filter(({ data_type }) => data_type === SPECIAL_FIELDS.number)
                .map(({ column_name }) => column_name),
        [columnsToFilter],
    );

    const {
        modalNewFilter,
        toastAlertFilter,
        onSubmit,
        handleSelectFilter,
        handleDeleteFilter,
        dataFiltersUser,
        handleNewFilter,
        setModalNewFilter,
        handleHelpers,
        handleClear,
    } = useHookFilter({
        nameHelper,
        nameTable,
        setValue,
        reset,
        fieldsCustomerFilters,
        baseFilters,
        formColumnNames,
        numberFieldNames,
        scope,
    });

    const hasAppliedFilters = Object.values(appliedValues).some((v) => v !== "" && v !== null && v !== undefined);
    const appliedFilterEntries = hasAppliedFilters
        ? Object.entries(appliedValues).filter(([, value]) => value !== "" && value !== null && value !== undefined)
        : [];

    const filterActions = (
        <div className="flex gap-2 items-center" data-testid="filter_customization_actions">
            {showFilterGeneric && (
                <Dialog
                    open={filterDialogOpen}
                    onOpenChange={(open) => {
                        setFilterDialogOpen(open);
                        if (!open) return;
                        handleHelpers();
                        toast.dismiss(toastAlertFilter);
                        reset(getFilterDialogOpenValues(appliedValues, formColumnNames));
                    }}
                >
                    <DialogTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0 p-2"
                            id="btn_filter"
                            data-testid="btn_filter"
                        >
                            {isLoadingHeaders ? <LoaderThreeDots /> : <Filter className="w-5 h-5 shrink-0" />}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className={FILTER_DIALOG_CONTENT_CLASS}>
                        <DialogHeader>
                            <DialogTitle>{t("app.text.filters")}</DialogTitle>
                            <DialogDescription>{t("app.text.filterHelp")}</DialogDescription>
                        </DialogHeader>
                        <form
                            className={FILTER_DIALOG_FORM_CLASS}
                            data-testid="filter_customization_form"
                            onSubmit={handleSubmit((data) => {
                                const hasData = Object.values(data).some((v) => v !== "");
                                if (hasData) {
                                    setAppliedValues(data);
                                } else {
                                    setAppliedValues({});
                                }
                                onSubmit(data);
                            })}
                            autoComplete="off"
                        >
                            <div className="grid grid-flow-row-dense grid-cols-1 md:grid-cols-2 gap-2 py-4">
                                {columnsToFilter?.length &&
                                    columnsToFilter.map(({ column_name, header, data_type, options, maxLevel }) => (
                                        <div className="flex flex-col gap-4" key={column_name}>
                                            <Label
                                                htmlFor={column_name}
                                                className="text-left ml-2 mt-2"
                                                id={`filter_label_${column_name}`}
                                                data-testid={`filter_label_${column_name}`}
                                            >
                                                {header === "Nivel 1"
                                                    ? "Niveles"
                                                    : nameTable.table === "helps" && column_name === "titulo"
                                                      ? "Titulo"
                                                      : header}
                                            </Label>
                                            {InputValueDepend(data_type, column_name, options, control, maxLevel)}
                                        </div>
                                    ))}
                            </div>
                            <DialogFooter>
                                <div className="flex w-full justify-between">
                                    <SearchFilter
                                        selectedFilter={selectedSavedFilter}
                                        handleSelectFilter={(name) => {
                                            const restored = handleSelectFilter(name) ?? {};
                                            setSelectedSavedFilter(name);
                                            setAppliedValues(restored);
                                            if (Object.keys(restored).length > 0) {
                                                setFilterDialogOpen(false);
                                            }
                                        }}
                                        handleDeleteFilter={async (name) => {
                                            const deleted = await handleDeleteFilter(name);
                                            if (deleted && selectedSavedFilter === name) {
                                                setAppliedValues({});
                                                setSelectedSavedFilter(null);
                                            }
                                            return deleted;
                                        }}
                                        nameTable={nameTable.view}
                                        dataUser={dataFiltersUser}
                                        scope={scope}
                                    />
                                    <DialogClose asChild>
                                        <Button type="submit" id="btn_filter_search" data-testid="btn_filter_search">
                                            {t("app.forms.search")}
                                        </Button>
                                    </DialogClose>
                                </div>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            )}
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => refetch()}
                            className={`flex gap-2 ${isFetching && "text-primary"} max-w-52 sm:max-w-none`}
                            id="btn_update"
                            data-testid="btn_update"
                        >
                            <span className="min-w-[20px] min-h-[20px] shrink-0 flex items-center justify-center">
                                <RefreshCcw className={`w-5 h-5 ${isFetching && "animate-spin"}`} />
                            </span>
                            <span className="truncate hidden sm:inline">
                                {(isFetching ? t("app.states.updating") : t("app.button.update")) +
                                    (pathName.pathname === "/cases" ? ` ${title}` : "")}
                            </span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>
                            {(isFetching ? t("app.states.updating") : t("app.button.update")) +
                                (pathName.pathname === "/cases" ? ` ${title}` : "")}
                        </p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            {hasAppliedFilters && (
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                        const emptyValues = buildEmptyFilterFormValues(formColumnNames);
                        handleClear();
                        reset(emptyValues);
                        setAppliedValues({});
                        setSelectedSavedFilter(null);
                        onClear?.();
                    }}
                    className="flex gap-2 shrink-0"
                    id="btn_clear_filters"
                    data-testid="btn_clear_filters"
                >
                    <X className="h-4 w-4" />
                    <span className="truncate hidden sm:inline">{t("button.clearFilters")}</span>
                </Button>
            )}
        </div>
    );

    return (
        <div
            className="flex flex-col gap-2 w-full min-w-0"
            data-testid="filter_customization_toolbar"
            id="filter_customization_toolbar"
        >
            {typeof children === "function" ? children(filterActions) : filterActions}
            {appliedFilterEntries.length > 0 && (
                <div
                    className="flex w-full min-w-0 flex-wrap items-center gap-1.5"
                    data-testid="filter_customization_chips"
                    id="filter_customization_chips"
                >
                    {appliedFilterEntries.map(([key, value]) => {
                        const col = columnsToFilter?.find((c) => c.column_name === key);
                        if (!col) return null;
                        const displayValue =
                            col.data_type === SPECIAL_FIELDS.search_users && typeof value === "string" && value
                                ? null
                                : formatFilterBadgeValue(value, col);
                        return (
                            <span
                                key={key}
                                className="inline-flex max-w-[16rem] items-center gap-1 px-2 py-1 rounded-md bg-muted text-muted-foreground text-xs font-medium border shrink-0"
                                data-testid={`filter_chip_${key}`}
                                id={`filter_chip_${key}`}
                                title={`${col.header}: ${displayValue ?? value}`}
                            >
                                <span className="font-semibold text-foreground shrink-0">{col.header}</span>
                                <span className="shrink-0">:</span>
                                <span className="text-foreground truncate">
                                    {col.data_type === SPECIAL_FIELDS.search_users &&
                                    typeof value === "string" &&
                                    value ? (
                                        <FilterBadgeUserName userId={value} />
                                    ) : (
                                        displayValue
                                    )}
                                </span>
                            </span>
                        );
                    })}
                </div>
            )}
            <DialogNewFilter
                open={modalNewFilter}
                existingNames={Object.keys(getScopedViewFilters(dataFiltersUser?.filters, nameTable.view, scope))}
                save={async (name) => {
                    const saved = await handleNewFilter(name);
                    if (saved) setSelectedSavedFilter(name);
                }}
                setOpen={setModalNewFilter}
            />
        </div>
    );
}

FilterCustomization.propTypes = {
    filterSave: PropTypes.array,
    nameHelper: PropTypes.array,
    nameTable: PropTypes.shape({
        url: PropTypes.string.isRequired,
        key: PropTypes.string.isRequired,
        view: PropTypes.oneOfType([PropTypes.string, PropTypes.oneOf([null])]),
        entity: PropTypes.string,
    }),
    isLoadingHeaders: PropTypes.bool,
    refetch: PropTypes.func,
    isFetching: PropTypes.bool,
    showFilterGeneric: PropTypes.bool,
    columnsToFilter: PropTypes.array,
    fieldsCustomerFilters: PropTypes.array,
    baseFilters: PropTypes.array,
    onClear: PropTypes.func,
    children: PropTypes.func,
    scope: PropTypes.oneOf(Object.values(FILTER_SCOPES)),
};
