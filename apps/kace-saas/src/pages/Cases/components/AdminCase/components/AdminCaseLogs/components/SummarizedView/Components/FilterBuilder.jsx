import React, { useState, useMemo, useCallback, useEffect } from "react";
import PropTypes from "prop-types";
import { Button, MultiSelect, DateTimePickerWithRange } from "@/components/ui-shared";
import { MultiSelectUsers } from "@/components/core/multiselector/MultiSelectUsers";
import { useTranslation } from "react-i18next";
import { Plus, X, Search } from "lucide-react";
import { AggregateIdSelector } from "./AggregateIdSelector";

const OPERATOR_TYPES = {
    INCLUDE: "in",
    EXCLUDE: "notIn",
    BETWEEN: "between",
};

const transformToApiFilter = (filter) => {
    let apiValue = filter.value;

    if (filter.field === "event_name" || filter.field === "initiated_by_user" || filter.field === "case_id") {
        apiValue = filter.value.map((v) => v.id).join(",");
    } else if (filter.field === "aggregate_id") {
        apiValue = Array.isArray(filter.value) ? filter.value.map((v) => v.id).join(",") : filter.value;
    }

    return {
        field: filter.field,
        value: apiValue,
        type: "AND",
        operator: filter.operator,
    };
};

const isFilterValid = (filter) => {
    if (filter.field === "occurred_at") return !!filter.value;
    if (Array.isArray(filter.value)) return filter.value.length > 0;
    return !!filter.value;
};

const FilterBuilder = ({
    onSearch,
    entitiesOptions,
    defaultEntityValues,
    isLoadingEntities,
    isLoadingMoreEntities,
    hasMoreEntities,
    onLoadMoreEntities,
    allowedEvents,
}) => {
    const { t } = useTranslation();
    const [filters, setFilters] = useState([]);
    const [entityValues, setEntityValues] = useState(defaultEntityValues || []);
    const [newFilterField, setNewFilterField] = useState("event_name");

    useEffect(() => {
        setEntityValues(defaultEntityValues || []);
    }, [defaultEntityValues]);

    const createOperators = useCallback(
        (includeLabel, excludeLabel) => [
            { value: OPERATOR_TYPES.INCLUDE, label: includeLabel },
            { value: OPERATOR_TYPES.EXCLUDE, label: excludeLabel },
        ],
        [],
    );

    const FIELDS = useMemo(
        () => ({
            event_name: {
                label: t("event_logs.filterByType"),
                operators: createOperators(t("event_logs.include"), t("event_logs.exclude")),
                renderInput: (value, onChange) => (
                    <MultiSelect
                        data={allowedEvents}
                        listValues={value || []}
                        setListValues={(val) => {
                            if (typeof val === "function") {
                                onChange(val(value || []));
                            } else {
                                onChange(val);
                            }
                        }}
                        className="w-full"
                        hideSearchButton
                        listMode
                        textSearch={t("app.forms.search")}
                    />
                ),
            },
            aggregate_id: {
                label: t("event_logs.filterByAggregateId"),
                operators: createOperators(t("event_logs.include"), t("event_logs.exclude")),
                renderInput: (value, onChange) => (
                    <AggregateIdSelector
                        listValues={Array.isArray(value) ? value : []}
                        setListValues={(val) => {
                            if (typeof val === "function") {
                                onChange(val(value || []));
                            } else {
                                onChange(val);
                            }
                        }}
                    />
                ),
            },
            occurred_at: {
                label: t("event_logs.filterByDateTime"),
                operators: [{ value: OPERATOR_TYPES.BETWEEN, label: t("event_logs.between") }],
                renderInput: (value, onChange) => (
                    <DateTimePickerWithRange onChange={onChange} noInitialDate value={value} />
                ),
            },
            initiated_by_user: {
                label: t("event_logs.filterByUser"),
                operators: createOperators(t("event_logs.include"), t("event_logs.exclude")),
                renderInput: (value, onChange) => (
                    <MultiSelectUsers
                        listValues={value || []}
                        setListValues={(val) => {
                            if (typeof val === "function") {
                                onChange(val(value || []));
                            } else {
                                onChange(val);
                            }
                        }}
                        enableSearch
                        className="w-full"
                        listMode
                    />
                ),
            },
        }),
        [t, createOperators, allowedEvents],
    );

    const getNextAvailableOperator = useCallback(
        (fieldKey) => {
            const fieldConfig = FIELDS[fieldKey];
            const usedOperators = filters.filter((f) => f.field === fieldKey).map((f) => f.operator);

            return (
                fieldConfig.operators.find((op) => !usedOperators.includes(op.value))?.value ||
                fieldConfig.operators[0].value
            );
        },
        [filters, FIELDS],
    );

    const isFieldMaxedOut = useCallback(
        (fieldKey) => {
            return filters.some((f) => f.field === fieldKey);
        },
        [filters],
    );

    const handleAddFilter = useCallback(() => {
        setFilters((prev) => [
            ...prev,
            {
                id: crypto.randomUUID(),
                field: newFilterField,
                operator: getNextAvailableOperator(newFilterField),
                value: null,
            },
        ]);
    }, [newFilterField, getNextAvailableOperator]);

    const handleRemoveFilter = useCallback((id) => {
        setFilters((prev) => prev.filter((f) => f.id !== id));
    }, []);

    const handleUpdateFilter = useCallback((id, key, newValue) => {
        setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, [key]: newValue } : f)));
    }, []);

    const handleSearchClick = useCallback(() => {
        if (entityValues.length === 0) return;

        const dynamicFilters = filters.filter(isFilterValid).map(transformToApiFilter);

        const entityFilter = entityValues.length
            ? transformToApiFilter({
                  field: "case_id",
                  value: entityValues,
                  type: "AND",
                  operator: OPERATOR_TYPES.INCLUDE,
              })
            : null;

        const apiFilters = entityFilter ? [entityFilter, ...dynamicFilters] : dynamicFilters;

        onSearch(apiFilters);
    }, [filters, onSearch, entityValues]);

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                <div className="w-full lg:basis-80 lg:shrink-0 lg:grow-0">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t("event_logs.filterByEntity")}
                    </label>
                    <MultiSelect
                        data={entitiesOptions}
                        listValues={entityValues}
                        setListValues={setEntityValues}
                        className="w-full"
                        hideSearchButton
                        listMode
                        textSearch={t("app.forms.search")}
                        isLoading={isLoadingEntities}
                        isLoadingMore={isLoadingMoreEntities}
                        hasMore={hasMoreEntities}
                        setPage={onLoadMoreEntities}
                    />
                    {entityValues.length === 0 && (
                        <p className="mt-1 text-xs text-amber-600">{t("event_logs.entityRequired")}</p>
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t("event_logs.addFilter")}
                        </label>
                        <div className="flex gap-2">
                            <select
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                                value={newFilterField}
                                onChange={(e) => setNewFilterField(e.target.value)}
                            >
                                {Object.entries(FIELDS).map(([key, config]) => (
                                    <option key={key} value={key} disabled={isFieldMaxedOut(key)}>
                                        {config.label}
                                    </option>
                                ))}
                            </select>
                            <Button
                                onClick={handleAddFilter}
                                icon={<Plus size={16} />}
                                disabled={isFieldMaxedOut(newFilterField)}
                            >
                                {t("app.forms.add")}
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                        {filters.map((filter) => {
                            const fieldConfig = FIELDS[filter.field];
                            const isFullWidth = filter.field === "aggregate_id";
                            return (
                                <div
                                    key={filter.id}
                                    className={
                                        isFullWidth
                                            ? "flex items-center gap-3 p-3 bg-gray-50 rounded border border-gray-200 col-span-full"
                                            : "flex items-center gap-3 p-3 bg-gray-50 rounded border border-gray-200"
                                    }
                                >
                                    <div className="font-medium w-[120px] shrink-0">{fieldConfig.label}</div>

                                    <select
                                        className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                                        value={filter.operator}
                                        onChange={(e) => handleUpdateFilter(filter.id, "operator", e.target.value)}
                                    >
                                        {fieldConfig.operators.map((op) => (
                                            <option key={op.value} value={op.value}>
                                                {op.label}
                                            </option>
                                        ))}
                                    </select>

                                    <div className="flex-1 min-w-0">
                                        {fieldConfig.renderInput(filter.value, (val) =>
                                            handleUpdateFilter(filter.id, "value", val),
                                        )}
                                    </div>

                                    <button
                                        onClick={() => handleRemoveFilter(filter.id)}
                                        className="text-gray-400 hover:text-red-500 transition-colors"
                                        aria-label="Remove filter"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            );
                        })}
                        {filters.length === 0 && (
                            <div className="text-center text-gray-500 py-4 text-sm italic">
                                {t("event_logs.noFilters")}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex justify-center mt-4">
                <Button
                    onClick={handleSearchClick}
                    className="flex items-center gap-2"
                    disabled={entityValues.length === 0 || (filters.length > 0 && !filters.some(isFilterValid))}
                >
                    <Search size={16} />
                    {t("app.forms.search")}
                </Button>
            </div>
        </div>
    );
};

FilterBuilder.propTypes = {
    onSearch: PropTypes.func.isRequired,
    entitiesOptions: PropTypes.array,
    defaultEntityValues: PropTypes.array,
    isLoadingEntities: PropTypes.bool,
    isLoadingMoreEntities: PropTypes.bool,
    hasMoreEntities: PropTypes.bool,
    onLoadMoreEntities: PropTypes.func,
    allowedEvents: PropTypes.array,
};

FilterBuilder.defaultProps = {
    entitiesOptions: [],
    defaultEntityValues: [],
    isLoadingEntities: false,
    isLoadingMoreEntities: false,
    hasMoreEntities: false,
    onLoadMoreEntities: () => null,
    allowedEvents: [],
};

export default FilterBuilder;
