import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { cn } from "@kace_v2/shared/utils/cn.util";
import Select from "@kace_v2/shared/ui/molecules/Select";
import Input from "@kace_v2/shared/ui/atoms/Input";
import Button from "@kace_v2/shared/ui/atoms/Button";
import { Plus, X } from "lucide-react";
import FieldWrapper from "@kace_v2/shared/ui/molecules/FieldWrapper";
import { FILTER_BUILDER } from "@kace_v2/shared/constants/filter-builder.constants";

const FilterBuilder = ({ className, initialValue = [], label, error, fieldOptions = [], onChange }) => {
    const [filters, setFilters] = useState(initialValue);

    const operatorOptions = useMemo(
        () =>
            Object.entries(FILTER_BUILDER.OPERATORS).map(([value, label]) => ({
                label,
                value,
            })),
        [FILTER_BUILDER.OPERATORS],
    );

    const typeOptions = useMemo(
        () =>
            Object.entries(FILTER_BUILDER.TYPES).map(([label, value]) => ({
                label,
                value,
            })),
        [FILTER_BUILDER.OPERATORS],
    );

    const handleAddFilter = () => {
        const newFilter = {
            field: "",
            operator: "",
            value: "",
            type: "",
        };
        const updatedFilters = [...filters, newFilter];
        setFilters(updatedFilters);
        onChange?.(updatedFilters);
    };

    const handleUpdateFilter = (index, key, value) => {
        const updatedFilters = filters.map((filter, i) => (i === index ? { ...filter, [key]: value } : filter));
        setFilters(updatedFilters);
        onChange?.(updatedFilters);
    };

    const handleRemoveFilter = (index) => {
        const updatedFilters = filters.filter((_, i) => i !== index);
        setFilters(updatedFilters);
        onChange?.(updatedFilters);
    };

    return (
        <FieldWrapper label={label} error={error} className="border rounded-md p-2">
            <div className="flex w-full justify-end items-center">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddFilter}
                    className="h-7 text-xs bg-transparent"
                >
                    <Plus className="h-3 w-3" />
                    Filtro
                </Button>
            </div>
            <div className={cn("space-y-2 max-h-96 overflow-auto", className)}>
                <div className="flex flex-wrap items-center gap-2">
                    {filters.map((filter, index) => (
                        <div
                            key={index}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-background text-sm shadow-sm px-2"
                        >
                            <Select
                                value={filter.field}
                                options={fieldOptions}
                                onValueChange={(value) => handleUpdateFilter(index, "field", value)}
                                placeholder="Campo"
                                position="popper"
                                className="h-7 w-40 bg-transparent px-2 text-xs shadow-none"
                            />

                            <Select
                                value={filter.operator}
                                options={operatorOptions}
                                onValueChange={(value) => handleUpdateFilter(index, "operator", value)}
                                placeholder="Operador"
                                position="popper"
                                className="h-7 w-24 bg-transparent px-1 text-xs shadow-none"
                            />

                            <Input
                                value={filter.value}
                                onChange={(e) => handleUpdateFilter(index, "value", e.target.value)}
                                className="h-7 w-40 bg-transparent px-2 text-xs shadow-none"
                                placeholder="valor"
                            />

                            <Select
                                value={filter.type}
                                options={typeOptions}
                                onValueChange={(value) => handleUpdateFilter(index, "type", value)}
                                placeholder="Tipo"
                                position="popper"
                                className="h-7 w-14 bg-transparent px-1 text-xs shadow-none"
                            />

                            <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveFilter(index)}>
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
        </FieldWrapper>
    );
};

FilterBuilder.propTypes = {
    className: PropTypes.string,
    initialValue: PropTypes.array,
    label: PropTypes.string,
    error: PropTypes.string,
    fieldOptions: PropTypes.arrayOf(
        PropTypes.shape({
            label: PropTypes.string.isRequired,
            value: PropTypes.string.isRequired,
        }),
    ),
    onChange: PropTypes.func,
};

export default FilterBuilder;
