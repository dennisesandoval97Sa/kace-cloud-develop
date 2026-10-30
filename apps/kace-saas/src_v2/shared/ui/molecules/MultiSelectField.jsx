import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import FieldWrapper from "@kace_v2/shared/ui/molecules/FieldWrapper";
import Popover from "@kace_v2/shared/ui/molecules/Popover";
import { Check, ChevronsUpDown, Loader2, Search, X } from "lucide-react";
import { cn } from "@kace_v2/shared/utils/cn.util";
import { useInView } from "react-intersection-observer";

const MultiSelectField = ({
    className,
    defaultOptions = [],
    selectedValues = [],
    label,
    error,
    placeholder = "Seleccionar opciones...",
    loadingMessage = "Buscando...",
    emptyMessage = "No se encontraron opciones",
    searchErrorMessage = "Ocurrió un error al buscar. Intenta nuevamente.",
    disabled = false,
    isFetchingNextPage = false,
    hasNextPage = false,
    onChange = () => {},
    onSearch = () => {},
    fetchNextPage = () => {},
}) => {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [options, setOptions] = useState(defaultOptions);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedOptions, setSelectedOptions] = useState([]);
    const [searchError, setSearchError] = useState(false);

    const { ref, inView } = useInView();

    const handleSelect = useCallback(
        (option) => {
            const newValues = selectedValues.includes(option.value)
                ? selectedValues.filter((v) => v !== option.value)
                : [...selectedValues, option.value];

            onChange(newValues);

            if (!selectedValues.includes(option.value)) {
                setSelectedOptions((prev) => [...prev, option]);
            }
        },
        [selectedValues, onChange, setSelectedOptions],
    );

    const handleSelectAll = useCallback(() => {
        const currentOptions = options.map((opt) => opt.value);
        const combinedValues = Array.from(new Set([...selectedValues, ...currentOptions]));

        onChange(combinedValues);

        setSelectedOptions((prev) => {
            const prevStillSelected = prev.filter((p) => selectedValues.includes(p.value));
            const newOptions = options.filter((opt) => !prev.some((p) => p.value === opt.value));
            return [...prevStillSelected, ...newOptions];
        });
    }, [options, selectedValues, onChange, setSelectedOptions]);

    const handleRemove = useCallback(
        (value, e) => {
            e.stopPropagation();
            onChange(selectedValues.filter((v) => v !== value));
            setSelectedOptions((prev) => prev.filter((opt) => opt.value !== value));
        },
        [selectedValues, onChange, setSelectedOptions],
    );

    const handleClearAll = useCallback(
        (e) => {
            e.stopPropagation();
            onChange([]);
            setSelectedOptions([]);
        },
        [onChange, setSelectedOptions],
    );

    useEffect(() => {
        if (!searchQuery || searchQuery === "") {
            setOptions(defaultOptions);
            setSearchError(false);
            return;
        }

        let cancelled = false;
        const timer = setTimeout(async () => {
            if (searchQuery.trim() || open) {
                setIsLoading(true);
                setSearchError(false);
                try {
                    const results = await onSearch(searchQuery);
                    if (!cancelled) {
                        setOptions(results);
                    }
                } catch (error) {
                    if (!cancelled) {
                        setOptions([]);
                        setSearchError(true);
                    }
                } finally {
                    if (!cancelled) {
                        setIsLoading(false);
                    }
                }
            }
        }, 300);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [searchQuery, defaultOptions, onSearch, open]);

    useEffect(() => {
        const selected = options.filter((opt) => selectedValues.includes(opt.value));
        setSelectedOptions((prev) => {
            const prevStillSelected = prev.filter((p) => selectedValues.includes(p.value));
            const newSelected = selected.filter((s) => !prev.some((p) => p.value === s.value));
            return [...prevStillSelected, ...newSelected];
        });
    }, [selectedValues, options]);

    useEffect(() => {
        if (inView && hasNextPage) {
            fetchNextPage();
        }
    }, [inView, hasNextPage, fetchNextPage]);

    return (
        <FieldWrapper label={label} error={error}>
            <Popover
                open={open}
                onOpenChange={setOpen}
                trigger={
                    <button
                        disabled={disabled}
                        className="flex min-h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <div className="flex flex-wrap gap-1 flex-1 h-20 overflow-auto">
                            {selectedOptions.length > 0 ? (
                                selectedOptions.map((option) => (
                                    <span
                                        key={option.value}
                                        className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                                    >
                                        {option.label}
                                        <X
                                            className="h-3 w-3 cursor-pointer hover:text-destructive"
                                            onClick={(e) => handleRemove(option.value, e)}
                                        />
                                    </span>
                                ))
                            ) : (
                                <span className="text-muted-foreground">{placeholder}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                            {selectedOptions.length > 0 && (
                                <X className="h-4 w-4 cursor-pointer hover:text-destructive" onClick={handleClearAll} />
                            )}
                            <ChevronsUpDown className="h-4 w-4 opacity-50" />
                        </div>
                    </button>
                }
                className={cn(
                    "w-96 p-0 bg-popover text-popover-foreground border rounded-md shadow-md outline-none z-50",
                    className,
                )}
            >
                <div className="flex items-center border-b px-3 py-2">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <input
                        className="flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Buscar..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Check className="hover:bg-red-950 cursor-pointer" onClick={handleSelectAll} />
                </div>
                <div className="max-h-[300px] overflow-y-auto p-1">
                    {isLoading ? (
                        <div role="status" aria-live="polite" className="flex items-center justify-center py-6">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            <span className="text-sm text-muted-foreground">{loadingMessage}</span>
                        </div>
                    ) : searchError ? (
                        <div role="alert" aria-live="assertive" className="py-6 text-center text-sm text-destructive">
                            {searchErrorMessage}
                        </div>
                    ) : options.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</div>
                    ) : (
                        options.map((option) => {
                            const isSelected = selectedValues.includes(option.value);
                            return (
                                <button
                                    key={option.value}
                                    className={cn(
                                        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                        isSelected && "bg-accent",
                                    )}
                                    onClick={() => handleSelect(option)}
                                >
                                    <div className="flex items-center gap-2 flex-1">
                                        <div
                                            className={cn(
                                                "flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                isSelected ? "bg-primary text-primary-foreground" : "opacity-50",
                                            )}
                                        >
                                            {isSelected && <Check className="h-3 w-3" />}
                                        </div>
                                        <span>{option.label}</span>
                                    </div>
                                </button>
                            );
                        })
                    )}
                    <div ref={ref} className="flex items-center justify-center">
                        {isFetchingNextPage && (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                <span className="text-sm text-muted-foreground">{loadingMessage}</span>
                            </>
                        )}
                    </div>
                </div>
            </Popover>
        </FieldWrapper>
    );
};

MultiSelectField.propTypes = {
    className: PropTypes.string,
    defaultOptions: PropTypes.arrayOf(
        PropTypes.shape({
            label: PropTypes.string.isRequired,
            value: PropTypes.string.isRequired,
        }),
    ),
    selectedValues: PropTypes.arrayOf(
        PropTypes.shape({
            label: PropTypes.string.isRequired,
            value: PropTypes.string.isRequired,
        }),
    ),
    label: PropTypes.string,
    error: PropTypes.string,
    placeholder: PropTypes.string,
    loadingMessage: PropTypes.string,
    emptyMessage: PropTypes.string,
    searchErrorMessage: PropTypes.string,
    disabled: PropTypes.bool,
    hasNextPage: PropTypes.bool,
    isFetchingNextPage: PropTypes.bool,
    onChange: PropTypes.func,
    onSearch: PropTypes.func,
    fetchNextPage: PropTypes.func,
};

export default MultiSelectField;
