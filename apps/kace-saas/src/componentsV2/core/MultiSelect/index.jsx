import PropTypes from "prop-types";
import {
    Button,
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    GeneralLoader,
    LoaderThreeDots,
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui-shared";
import { CheckCheck, CheckIcon, X } from "lucide-react";
import { ListPopover } from "@/components/ui-shared/src/components/multiSelect/ListPopover";
import { cn } from "@/componentsV2/lib/utils";
import { useTranslation } from "react-i18next";
import { useInView } from "react-intersection-observer";
import { useEffect, useState } from "react";
import MultiSelectDefault from "@/componentsV2/core/MultiSelect/components/MultiSelectDefault";
import MultiSelectInput from "@/componentsV2/core/MultiSelect/components/MultiSelectInput";
import MultiSelectButton from "@/componentsV2/core/MultiSelect/components/MultiSelectButton";
import MultiSelectCompact from "@/componentsV2/core/MultiSelect/components/MultiSelectCompact";

const MultiSelect = ({
    id,
    selectedData = [],
    options = [],
    isDisabled = false,
    isLoading = false,
    isFetchingNextPage = false,
    dataTestid = "",
    onSelectedAll = () => {},
    onInputChange = () => {},
    onSelectOption = () => {},
    fetchNextPage = () => {},
    type = "compact",
    hiddenSelectedAll = false,
    single = false,
    placeholder = null,
    variant = "default",
    clearable = false,
    onClearSelection,
    showDeselectAll = false,
    onDeselectAll,
}) => {
    const { t } = useTranslation();
    const { ref, inView } = useInView();
    const [isOpen, setIsOpen] = useState(false);
    const [searchValue, setSearchValue] = useState("");

    const handleSearchChange = (value) => {
        setSearchValue(value);
        onInputChange(value);
    };

    useEffect(() => {
        if (inView) {
            fetchNextPage();
        }
    }, [inView, fetchNextPage]);

    const handleSelectOption = (itemId) => {
        onSelectOption(itemId);
        if (single) {
            setIsOpen(false);
        }
    };

    const handleSelectAll = () => {
        onSelectedAll();
        if (single) {
            setIsOpen(false);
        }
    };

    const handleDeselectAll = () => {
        setSearchValue("");
        onInputChange("");
        onDeselectAll();
    };

    const showTriggerClear =
        clearable && typeof onClearSelection === "function" && selectedData.length > 0 && type === "button";
    const canDeselectAll = showDeselectAll && typeof onDeselectAll === "function" && selectedData.length > 0;

    const triggerContent = (
        <>
            {type === "default" && (
                <MultiSelectDefault selectedData={selectedData} isLoading={isLoading} dataTestid={""} />
            )}
            {type === "input" && <MultiSelectInput isDisabled={isDisabled} selectedData={selectedData} />}
            {type === "button" && (
                <MultiSelectButton
                    id={id}
                    isDisabled={isDisabled}
                    selectedData={selectedData}
                    placeholder={placeholder}
                    variant={variant}
                />
            )}
            {type === "compact" && (
                <MultiSelectCompact selectedData={selectedData} isLoading={isLoading} placeholder={placeholder} />
            )}
        </>
    );

    return (
        <div className="flex gap-2 items-center relative">
            <Popover
                open={isOpen}
                onOpenChange={setIsOpen}
                id={`popover_multiselect_${dataTestid}`}
                data-testid={`popover_multiselect_${dataTestid}`}
            >
                {showTriggerClear ? (
                    <div className="flex w-full min-w-0 gap-1 items-stretch">
                        <PopoverTrigger className="relative min-w-0 flex-1" disabled={isDisabled}>
                            {triggerContent}
                        </PopoverTrigger>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 shrink-0 bg-background shadow-sm"
                            aria-label={t("button.clear")}
                            data-testid="multiselect_btn_clear_selection"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsOpen(false);
                                setSearchValue("");
                                onInputChange("");
                                onClearSelection();
                            }}
                        >
                            <X className="h-4 w-4" aria-hidden />
                        </Button>
                    </div>
                ) : (
                    <PopoverTrigger className="relative w-full" disabled={isDisabled}>
                        {triggerContent}
                    </PopoverTrigger>
                )}
                <PopoverContent className="w-[25rem] p-0" data-testid={`contentMultiselect${dataTestid}`}>
                    <Command>
                        <div className="flex gap-2 items-center p-2">
                            <div className="relative w-full">
                                <CommandInput
                                    id="multiselect_input_search"
                                    value={searchValue}
                                    onValueChange={handleSearchChange}
                                    placeholder={t("app.forms.search")}
                                    data-testid="multiselect_input_search"
                                />
                            </div>
                            {!hiddenSelectedAll && (
                                <Button
                                    id="multiselect_btn_select_all"
                                    size="icon"
                                    type="button"
                                    variant="outline"
                                    onClick={handleSelectAll}
                                    aria-label={t("button.selectAll")}
                                    title={t("button.selectAll")}
                                    data-testid="multiselect_btn_select_all"
                                >
                                    <CheckCheck width={22} height={22} aria-hidden />
                                </Button>
                            )}
                            {canDeselectAll && (
                                <Button
                                    id="multiselect_btn_deselect_all"
                                    size="icon"
                                    type="button"
                                    variant="outline"
                                    onClick={handleDeselectAll}
                                    aria-label={t("button.deselectAll")}
                                    title={t("button.deselectAll")}
                                    data-testid="multiselect_btn_deselect_all"
                                >
                                    <X width={22} height={22} aria-hidden />
                                </Button>
                            )}
                        </div>
                        <CommandList className="max-h-80 overflow-y-auto">
                            {isLoading ? (
                                <div
                                    id="multiselect_loading"
                                    className="flex justify-center items-center p-4 h-36 w-full"
                                    data-testid="multiselect_loading"
                                >
                                    <GeneralLoader />
                                </div>
                            ) : (
                                <>
                                    <CommandEmpty id="multiselect_empty_list" data-testid="multiselect_empty_list">
                                        {t("genericTexts.noFoundInformation")}
                                    </CommandEmpty>
                                    <CommandGroup id="multiselect_list" data-testid="multiselect_list">
                                        {options.map((item) => (
                                            <CommandItem
                                                id={`multiselect_item_${dataTestid}_${item.id}`}
                                                data-testid={`multiselect_item_${dataTestid}_${item.id}`}
                                                key={item.id}
                                                value={String(item.label ?? item.value ?? "")}
                                                onSelect={() => handleSelectOption(item.id)}
                                            >
                                                <CheckIcon
                                                    id={`multiselect_checked_item_${dataTestid}_${item.id}`}
                                                    data-testid={`multiselect_checked_item_${dataTestid}_${item.id}`}
                                                    className={cn("mr-2 h-4 w-4 opacity-0", {
                                                        "opacity-100": selectedData.some(
                                                            (selectedItem) => selectedItem.id === item.id,
                                                        ),
                                                    })}
                                                />
                                                {item.label}
                                            </CommandItem>
                                        ))}
                                        <CommandItem ref={ref} className="flex justify-center">
                                            {isFetchingNextPage && <LoaderThreeDots />}
                                        </CommandItem>
                                    </CommandGroup>
                                </>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            {selectedData.length > 3 && <ListPopover listValues={selectedData} nameTesting={dataTestid} />}
        </div>
    );
};

MultiSelect.propTypes = {
    id: PropTypes.string,
    selectedData: PropTypes.array,
    options: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            label: PropTypes.string.isRequired,
            value: PropTypes.string.isRequired,
        }),
    ),
    isDisabled: PropTypes.bool,
    isLoading: PropTypes.bool,
    isFetchingNextPage: PropTypes.bool,
    dataTestid: PropTypes.string,
    onSelectedAll: PropTypes.func,
    onInputChange: PropTypes.func,
    onSelectOption: PropTypes.func,
    fetchNextPage: PropTypes.func,
    type: PropTypes.oneOf(["default", "input", "button", "compact"]),
    hiddenSelectedAll: PropTypes.bool,
    single: PropTypes.bool,
    placeholder: PropTypes.string,
    variant: PropTypes.string,
    clearable: PropTypes.bool,
    onClearSelection: PropTypes.func,
    showDeselectAll: PropTypes.bool,
    onDeselectAll: PropTypes.func,
};

export default MultiSelect;
