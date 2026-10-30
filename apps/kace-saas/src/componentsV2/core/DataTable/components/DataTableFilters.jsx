import { memo, useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Form, Formik } from "formik";
import { Filter, X } from "lucide-react";
import {
    Button,
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    LoaderThreeDots,
} from "@/components/ui-shared";
import DataTableFilterInputs from "./DataTableFilterInputs";
import DataTableFilterPresets from "./DataTableFilterPresets";
import DataTableUpdate from "./DataTableUpdate";
import { formatFilterBadgeValue } from "@/components/ui-shared/src/components/table-component/helpers";
import { FilterBadgeUserName } from "@/components/ui-shared/src/components/table-component/FilterBadgeUserName";
import { SPECIAL_FIELDS } from "@/services/createSchemaFilter";

const getOptionLabelForValue = (field, value) => {
    const option = field?.options?.find((item) => String(item.value) === String(value));
    return option?.label ?? option?.name ?? null;
};

const DataTableFilters = ({
    schema,
    onApply,
    onClear,
    savedFilterList,
    onFilterSelect,
    onDeleteFilter = null,
    isFiltered = false,
    hasClearableBaseFilters = false,
    isLoading = false,
    currentFiltersValues = {},
    selectedFilter = "",
    pageSize = 10,
    pageSizeOptions = [10, 25, 50, 75, 100],
    onRefresh = null,
    isFetching = false,
}) => {
    const { t } = useTranslation();
    const [selectedPageSize, setSelectedPageSize] = useState(pageSize);

    useEffect(() => {
        setSelectedPageSize(pageSize);
    }, [pageSize]);

    const filterBadges =
        isFiltered &&
        Object.entries(currentFiltersValues).map(([key, value]) => {
            const displayValue = typeof value === "object" && value !== null ? value.value : value;
            if (displayValue === "" || displayValue === null || displayValue === undefined) return null;
            const field = schema?.find((f) => f.column_name === key);
            if (!field) return null;
            const chipText = (() => {
                if (field.data_type === SPECIAL_FIELDS.search_users && displayValue) {
                    return <FilterBadgeUserName userId={String(displayValue)} />;
                }
                if (field.data_type === SPECIAL_FIELDS.date || field.data_type === SPECIAL_FIELDS.datetime) {
                    return formatFilterBadgeValue(String(displayValue), field);
                }
                if (field.data_type === SPECIAL_FIELDS.switch_state) {
                    const isActive = value?.operator !== "neq" && ["true", "1"].includes(String(displayValue));
                    return isActive ? t("app.forms.active") : t("app.forms.inactive");
                }
                return value?.label || getOptionLabelForValue(field, displayValue) || String(displayValue);
            })();
            return (
                <span
                    key={key}
                    className="inline-flex max-w-sm shrink-0 flex-wrap items-center gap-x-1 gap-y-0.5 rounded-md border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
                >
                    <span className="shrink-0 font-semibold text-foreground">{field.header}</span>
                    <span>:</span>
                    <span className="min-w-0 break-words text-foreground">{chipText}</span>
                </span>
            );
        });

    return (
        <div
            className="flex w-full min-w-0 max-w-full flex-1 flex-row flex-wrap content-center items-center gap-2 overflow-visible"
            data-testid="dt_filter_group"
        >
            <div className="flex shrink-0 flex-wrap items-center gap-2" data-testid="dt_filter_toolbar">
                <Dialog
                    onOpenChange={(open) => {
                        if (open) setSelectedPageSize(pageSize);
                    }}
                >
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={isLoading} id="dt_filter" data-testid="dt_filter">
                            {isLoading ? <LoaderThreeDots /> : <Filter className="h-4 w-4" />}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[calc(100vw-3rem)] md:max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{t("app.text.filters")}</DialogTitle>
                            <DialogDescription>{t("app.text.filterHelp")}</DialogDescription>
                        </DialogHeader>
                        <Formik
                            initialValues={currentFiltersValues}
                            enableReinitialize={true}
                            onSubmit={(values) => {
                                onApply(values, selectedPageSize);
                            }}
                        >
                            {({ values, setFieldValue }) => (
                                <Form autoComplete="off">
                                    <div className="grid grid-flow-row-dense grid-cols-1 md:grid-cols-2 gap-4 py-4">
                                        {schema
                                            ?.filter((field) => field.filterData)
                                            .map((field) => (
                                                <div
                                                    key={field.column_name}
                                                    className={field.fullWidth ? "col-span-1 md:col-span-2" : undefined}
                                                >
                                                    <DataTableFilterInputs
                                                        type={field.data_type}
                                                        label={field.header}
                                                        name={field.column_name}
                                                        handle={setFieldValue}
                                                        value={values[field.column_name]}
                                                        filterData={field.filterData}
                                                        options={field.options || []}
                                                        fieldType={field?.field_type}
                                                        schemaColumnType={field?.schema_column_type}
                                                        maxLevel={field?.maxLevel}
                                                    />
                                                </div>
                                            ))}

                                        <div className="col-span-1 md:col-span-2 border-t pt-4 mt-2">
                                            <label
                                                htmlFor="pageSize"
                                                className="block text-sm font-medium text-gray-700 mb-2"
                                            >
                                                {t("app.text.recordsPerPage")}
                                            </label>
                                            <select
                                                id="pageSize"
                                                value={selectedPageSize}
                                                onChange={(e) => setSelectedPageSize(Number(e.target.value))}
                                                className="w-full md:w-48 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                            >
                                                {pageSizeOptions.map((option) => (
                                                    <option key={option} value={option}>
                                                        {option}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <div className="w-full flex justify-between items-center">
                                            {savedFilterList && (
                                                <DataTableFilterPresets
                                                    savedFilterList={savedFilterList}
                                                    onFilterSelect={onFilterSelect}
                                                    onDeleteFilter={onDeleteFilter}
                                                    selectedFilter={selectedFilter}
                                                />
                                            )}
                                            <DialogClose asChild>
                                                <Button
                                                    type="submit"
                                                    id="dt_filter_apply"
                                                    data-testid="dt_filter_apply"
                                                >
                                                    {t("button.search")}
                                                </Button>
                                            </DialogClose>
                                        </div>
                                    </DialogFooter>
                                </Form>
                            )}
                        </Formik>
                    </DialogContent>
                </Dialog>
                {(isFiltered || hasClearableBaseFilters) && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={onClear}
                        className="flex gap-2"
                        id="dt_filter_clear"
                        data-testid="dt_filter_clear"
                    >
                        <X className="h-4 w-4" />
                        <span className="truncate">{t("button.clearFilters")}</span>
                    </Button>
                )}
                {onRefresh && <DataTableUpdate onRefresh={onRefresh} isFetching={isFetching} />}
            </div>
            {isFiltered && (
                <div
                    className="flex min-w-[8rem] flex-1 flex-row flex-wrap content-start items-center justify-start gap-1.5 overflow-visible"
                    data-testid="dt_filter_chips"
                >
                    {filterBadges}
                </div>
            )}
        </div>
    );
};

DataTableFilters.propTypes = {
    schema: PropTypes.arrayOf(
        PropTypes.shape({
            column_name: PropTypes.string.isRequired,
            header: PropTypes.string.isRequired,
            data_type: PropTypes.string.isRequired,
            filterData: PropTypes.shape({
                field: PropTypes.string.isRequired,
                operator: PropTypes.string.isRequired,
                type: PropTypes.string.isRequired,
            }),
            label: PropTypes.string,
        }),
    ).isRequired,
    onApply: PropTypes.func.isRequired,
    onClear: PropTypes.func.isRequired,
    onFilterSelect: PropTypes.func.isRequired,
    onDeleteFilter: PropTypes.func,
    savedFilterList: PropTypes.arrayOf(PropTypes.string),
    isFiltered: PropTypes.bool,
    hasClearableBaseFilters: PropTypes.bool,
    isLoading: PropTypes.bool,
    currentFiltersValues: PropTypes.object,
    selectedFilter: PropTypes.string,
    pageSize: PropTypes.number,
    pageSizeOptions: PropTypes.arrayOf(PropTypes.number),
    onRefresh: PropTypes.func,
    isFetching: PropTypes.bool,
};

export default memo(DataTableFilters);
