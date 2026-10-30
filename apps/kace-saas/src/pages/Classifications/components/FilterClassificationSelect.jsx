import PropTypes from "prop-types";
import { useState } from "react";
import { CheckIcon, ChevronsUpDown, X } from "lucide-react";
import { useTranslation } from "react-i18next";
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
import { cn } from "@/componentsV2/lib/utils";
import useGenericSearchInfiniteQuery from "@/hooks/useGenericSearchInfiniteQuery";
import useDebounced from "@/hooks/useDebounced";
import { isViewportAtBottom } from "@/hooks/infiniteScrollViewport";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const PAGE_SIZE = 20;

const processData = (data) => {
    const allItems = data?.pages?.flatMap((page) => page?.data ?? []) ?? [];
    return allItems
        .filter((item) => item.id && item.description)
        .map((item) => ({ id: item.id, label: item.description, value: String(item.id) }));
};

const FilterClassificationSelect = ({ value = "", onChange }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const [queryTerm, setQueryTerm] = useState("");
    const [selectedLabel, setSelectedLabel] = useState("");

    const updateQueryTerm = useDebounced(setQueryTerm, 400);

    const handleSearchChange = (val) => {
        setInputValue(val);
        updateQueryTerm(val);
    };

    const {
        data: options = [],
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useGenericSearchInfiniteQuery({
        url: `${URL_AND_KEYS.classification.url}/search`,
        keyQuery: ["classificationsForFilter", queryTerm],
        filter: [
            { field: "clasificaciones.deleted_at", operator: "null", value: "null", type: "AND" },
            ...(queryTerm
                ? [{ field: "clasificaciones.description", operator: "ilike", value: queryTerm, type: "AND" }]
                : []),
        ],
        select: processData,
        pageSize: PAGE_SIZE,
        table: URL_AND_KEYS.classification.entity,
        staleTime: 1000 * 60 * 5,
    });

    const handleOpenChange = (open) => {
        setIsOpen(open);
        if (open) {
            setInputValue("");
            setQueryTerm("");
        }
    };

    const handleSelect = (opt) => {
        const isDeselect = opt.value === value;
        const newValue = isDeselect ? "" : opt.value;
        const newLabel = isDeselect ? "" : opt.label;
        onChange(newValue, newLabel);
        setSelectedLabel(newLabel);
        setIsOpen(false);
    };

    const handleClear = () => {
        onChange("", "");
        setSelectedLabel("");
    };

    const handleScroll = (e) => {
        const el = e.currentTarget;
        if (isViewportAtBottom(el, 40) && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    };

    return (
        <div className="flex w-full gap-1 items-stretch">
            <Popover open={isOpen} onOpenChange={handleOpenChange}>
                <PopoverTrigger className="relative min-w-0 flex-1">
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between text-left font-normal"
                        data-testid="filter_classification_trigger"
                    >
                        <span className="truncate text-sm">
                            {options.find((opt) => opt.value === value)?.label ||
                                selectedLabel ||
                                t("classification.filter.placeholder")}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" side="bottom" align="start">
                    <Command shouldFilter={false}>
                        <CommandInput
                            value={inputValue}
                            onValueChange={handleSearchChange}
                            placeholder={t("app.forms.search")}
                            data-testid="filter_classification_search"
                        />
                        <CommandList onScroll={handleScroll}>
                            {isLoading ? (
                                <div className="flex justify-center items-center h-36">
                                    <GeneralLoader />
                                </div>
                            ) : (
                                <>
                                    <CommandEmpty>{t("genericTexts.noFoundInformation")}</CommandEmpty>
                                    <CommandGroup>
                                        {options.map((opt) => (
                                            <CommandItem
                                                key={opt.id}
                                                value={opt.label}
                                                onSelect={() => handleSelect(opt)}
                                                data-testid={`filter_classification_option_${opt.id}`}
                                            >
                                                <CheckIcon
                                                    className={cn("mr-2 h-4 w-4 opacity-0", {
                                                        "opacity-100 text-greenCustom": opt.value === value,
                                                    })}
                                                />
                                                {opt.label}
                                            </CommandItem>
                                        ))}
                                        {isFetchingNextPage && (
                                            <div className="flex justify-center py-2">
                                                <LoaderThreeDots />
                                            </div>
                                        )}
                                    </CommandGroup>
                                </>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            {value && (
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={handleClear}
                    aria-label={t("button.clear")}
                    data-testid="filter_classification_clear"
                >
                    <X className="h-4 w-4" />
                </Button>
            )}
        </div>
    );
};

FilterClassificationSelect.propTypes = {
    value: PropTypes.string,
    onChange: PropTypes.func.isRequired,
};

export default FilterClassificationSelect;
