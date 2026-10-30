import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GeneralLoader } from "./general-loader";
import PropTypes from "prop-types";
import { normalizeForSearch } from "@/utils/textNormalize";

export function ComboBox({
    placeholder = "Search ...",
    data = [],
    className = "",
    classNamePopover = "",
    handleOnChange,
    dataTestId = "combo-box",
    loading = false,
    defaultValue = "",
    defaultId = "",
    disabled = false,
    showClearButton = true,
    truncateLabel = false,
}) {
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState(defaultValue);
    const [idValue, setIdValue] = useState(defaultId);

    const labelMap = useMemo(() => {
        const map = new Map();
        data.forEach((item) => map.set(String(item.value), item.label ?? ""));
        return map;
    }, [data]);

    const customFilter = useCallback(
        (val, search) => {
            const label = labelMap.get(val) ?? val;
            return normalizeForSearch(label).includes(normalizeForSearch(search)) ? 1 : 0;
        },
        [labelMap],
    );

    useEffect(() => {
        setValue(defaultValue);
        if (defaultId) {
            setIdValue(defaultId);
        }
    }, [defaultValue, defaultId]);

    return (
        <div className={cn("flex items-center gap-2 w-full", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    aria-expanded={open}
                                    className="justify-between w-full"
                                    data-testid={`btn_select_combo_box_${value}`}
                                    disabled={disabled}
                                    id={`btn_select_combo_box_${value}`}
                                >
                                    <span className="w-full text-start truncate">
                                        {value ? data.find((item) => item.value === value)?.label : `${placeholder}`}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                        </TooltipTrigger>
                        <TooltipContent
                            data-testid={`tooltip_combo_box_${dataTestId}`}
                            id={`tooltip_combo_box_${dataTestId}`}
                        >
                            <p>{value}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <PopoverContent
                    className={cn("p-0", classNamePopover)}
                    data-testid={`popover_combo_box_${dataTestId}`}
                    id={`popover_combo_box_${dataTestId}`}
                    onWheel={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                >
                    <Command
                        data-testid={`command_combo_box_${dataTestId}`}
                        id={`command_combo_box_${dataTestId}`}
                        filter={customFilter}
                    >
                        <CommandInput placeholder={placeholder} />
                        <CommandList onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
                            {loading ? (
                                <div className="flex justify-center items-center p-4 h-36 w-full">
                                    <GeneralLoader />
                                </div>
                            ) : (
                                <>
                                    <CommandEmpty>Sin datos disponibles</CommandEmpty>
                                    <CommandGroup>
                                        {data.map((item, index) => (
                                            <CommandItem
                                                key={index}
                                                value={item.value}
                                                onSelect={(currentValue) => {
                                                    setValue(currentValue === value ? "" : currentValue);
                                                    setIdValue(currentValue === value ? "" : item.id);
                                                    handleOnChange(currentValue);
                                                    setOpen(false);
                                                }}
                                                data-testid={`check_combo_box_${item.value}`}
                                                id={`check_combo_box_${item.value}`}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4 shrink-0",
                                                        value === item.id ? "opacity-100" : "opacity-0",
                                                    )}
                                                    data-testid={`check_combo_box_${item.value}`}
                                                    id={`check_combo_box_${item.value}`}
                                                />
                                                {truncateLabel ? (
                                                    <span className="min-w-0 truncate">{item.label}</span>
                                                ) : (
                                                    item.label
                                                )}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            {value && showClearButton && (
                <X
                    className="h-4 w-4 opacity-60 hover:opacity-100 cursor-pointer"
                    onClick={() => {
                        setValue("");
                        setIdValue("");
                        handleOnChange("");
                        setOpen(false);
                    }}
                    data-testid={`btn_clear_combo_box_${value}`}
                    id={`btn_clear_combo_box_${value}`}
                />
            )}
        </div>
    );
}

ComboBox.propTypes = {
    placeholder: PropTypes.string,
    data: PropTypes.array,
    className: PropTypes.string,
    classNamePopover: PropTypes.string,
    handleOnChange: PropTypes.func,
    dataTestId: PropTypes.string,
    loading: PropTypes.bool,
    defaultValue: PropTypes.string,
    defaultId: PropTypes.string,
    disabled: PropTypes.bool,
    showClearButton: PropTypes.bool,
    /** Ellipsis on long labels instead of wrapping. Opt-in so existing selectors keep their layout. */
    truncateLabel: PropTypes.bool,
};
