import { cn } from "../../lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "../ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { useState, useRef, useEffect } from "react";
import { CheckIcon } from "../../icons";
import { X } from "lucide-react";
import { ListPopover } from "./ListPopover";
import { ButtonsAction } from "./ButtonsAction";
import { useTranslation } from "react-i18next";
import { GeneralLoader } from "@kace/ui-shared";
import PropTypes from "prop-types";
import { useInfiniteScrollGate } from "@/hooks/useInfiniteScrollGate";
import { isViewportAtBottom } from "@/hooks/infiniteScrollViewport";

export const MultiSelect = ({
    data = [],
    textSearch = "Search...",
    listValues = [],
    setListValues = () => null,
    isLoading = false,
    nameTesting = "",
    searchQuery = "",
    triggerAriaLabel,
    triggerAriaDescribedBy,
    triggerAriaInvalid,
    setSearchQuery,
    setPage = () => null,
    followInput = false,
    isLoadingMore = false,
    hasMore = false,
    open,
    onOpenChange,
    hideSelectAll = false,
    hideSearchButton = false,
    listMode = false,
    onSelectAll,
}) => {
    const [internalOpen, setInternalOpen] = useState(false);
    const { t } = useTranslation();
    const debounceTimeoutRef = useRef(null);
    const setSearchQueryRef = useRef(setSearchQuery);
    const [localInputValue, setLocalInputValue] = useState("");
    const containerRef = useRef(null);
    const currentPageRef = useRef(1);
    const {
        arm: armInfiniteScroll,
        reset: resetInfiniteScroll,
        consume: consumeInfiniteScroll,
    } = useInfiniteScrollGate();

    useEffect(() => {
        setSearchQueryRef.current = setSearchQuery;
    }, [setSearchQuery]);

    const loadingStateRef = useRef({ isLoading, isLoadingMore, hasMore });

    useEffect(() => {
        loadingStateRef.current = { isLoading, isLoadingMore, hasMore };
    }, [isLoading, isLoadingMore, hasMore]);

    const isOpen = open !== undefined ? open : internalOpen;
    const handleOpenChange = onOpenChange || setInternalOpen;

    const showSearchButton = !hideSearchButton && typeof setSearchQuery === "function";

    const handleSelectAll = () => {
        if (typeof onSelectAll === "function") {
            onSelectAll();
            return;
        }

        if (listValues.length === data.length) {
            setListValues([]);
        } else {
            setListValues(
                data.map((item) => {
                    return { id: item.id, label: item.label, value: item.value };
                }),
            );
        }
    };

    const handleSearchChange = (query) => {
        setLocalInputValue(query);

        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
            debounceTimeoutRef.current = null;
        }

        if (!query.trim()) {
            setSearchQueryRef.current?.({ input: query, filter: "" });
            return;
        }

        setSearchQueryRef.current?.({ input: query, filter: searchQuery?.filter || "" });

        if (followInput) {
            setSearchQueryRef.current?.({ input: query, filter: query });
            return;
        }

        debounceTimeoutRef.current = setTimeout(() => {
            setSearchQueryRef.current?.({ input: query, filter: query });
        }, 300);
    };

    const lastFetchHeightRef = useRef(0);

    const tryLoadMoreFromBottom = (element) => {
        if (!isViewportAtBottom(element, 50)) return;
        const { isLoading, isLoadingMore, hasMore } = loadingStateRef.current;
        if (isLoading || isLoadingMore || !hasMore) return;
        if (element.scrollHeight === lastFetchHeightRef.current) return;
        if (!consumeInfiniteScroll()) return;
        lastFetchHeightRef.current = element.scrollHeight;
        currentPageRef.current += 1;
        setPage(currentPageRef.current);
    };

    const handleScroll = (e) => {
        tryLoadMoreFromBottom(e.currentTarget);
    };

    const handleWheel = (e) => {
        e.stopPropagation();
        armInfiniteScroll();
        if (e.deltaY > 0) {
            tryLoadMoreFromBottom(e.currentTarget);
        }
    };

    useEffect(() => {
        if (isLoading && containerRef.current) {
            containerRef.current.scrollTop = 0;
            currentPageRef.current = 1;
        }
    }, [isLoading]);

    useEffect(() => {
        resetInfiniteScroll();
        lastFetchHeightRef.current = 0;
        if (!isOpen) {
            currentPageRef.current = 1;
            setLocalInputValue("");
            setSearchQueryRef.current?.({ input: "", filter: "" });
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
                debounceTimeoutRef.current = null;
            }
        }
        return () => {
            clearTimeout(debounceTimeoutRef.current);
        };
    }, [isOpen, resetInfiniteScroll]);

    return (
        <div className="flex gap-2 items-center relative">
            <Popover
                open={isOpen}
                onOpenChange={handleOpenChange}
                data-testid={`popover_multiselect_${nameTesting}`}
                id={`popover_multiselect_${nameTesting}`}
            >
                <PopoverTrigger
                    className="relative w-full"
                    disabled={isLoading}
                    data-testid={`trigger_multiselect_${nameTesting}`}
                    id={`trigger_multiselect_${nameTesting}`}
                    aria-label={triggerAriaLabel}
                    aria-describedby={triggerAriaDescribedBy}
                    aria-invalid={triggerAriaInvalid || undefined}
                >
                    <div
                        className={cn(
                            "flex min-h-24 w-auto border-input border-2 rounded-md text-left p-2",
                            isLoading ? "cursor-no-drop" : "cursor-pointer",
                            listMode && listValues.length > 0
                                ? "flex-col gap-1 justify-start overflow-y-auto max-h-48"
                                : "gap-2 justify-center items-center flex-wrap overflow-hidden",
                        )}
                        id={`popover_multiselect_trigger_${nameTesting}`}
                        data-testid={`popover_multiselect_trigger_${nameTesting}`}
                    >
                        {isLoading && !isOpen ? (
                            <p>{t("genericTexts.loading")}</p>
                        ) : listValues?.length === 0 ? (
                            <span>{t("genericTexts.notingSelected")}</span>
                        ) : listMode ? (
                            <div className="flex flex-col gap-1 w-full">
                                {listValues.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-between gap-2 rounded bg-blueCustom px-2.5 py-1.5 text-sm text-white"
                                        data-testid={`chip_multiselect_${nameTesting}_${item.id}`}
                                    >
                                        <span className="break-words min-w-0 flex-1 text-left">{item.label}</span>
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setListValues((prev) => prev.filter((i) => i.id !== item.id));
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                    e.stopPropagation();
                                                    setListValues((prev) => prev.filter((i) => i.id !== item.id));
                                                }
                                            }}
                                            className="shrink-0 text-white/60 hover:text-white transition-colors rounded-full p-0.5 cursor-pointer"
                                            aria-label={`${t("button.delete")} ${item.label}`}
                                        >
                                            <X size={12} />
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <>
                                {listValues.slice(0, 5).map((item, index) => (
                                    <div
                                        key={index}
                                        className="bg-blueCustom rounded-full px-3 py-1 text-white max-w-[150px] truncate"
                                        data-testid={`chip_multiselect_${nameTesting}_${item.id}`}
                                        id={`chip_multiselect_${nameTesting}_${item.id}`}
                                        title={item.label}
                                    >
                                        {item.label}
                                    </div>
                                ))}
                                {listValues.length > 5 && (
                                    <div>
                                        <span
                                            className="bg-blueCustom rounded-full px-3 py-1 text-white"
                                            data-testid={`chip_multiselect_${nameTesting}_counter`}
                                            id={`chip_multiselect_${nameTesting}_counter`}
                                        >
                                            +{listValues.length - 5}...
                                        </span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </PopoverTrigger>
                <PopoverContent
                    className={cn(
                        "w-[25rem] p-0",
                        "flex max-h-[min(24rem,calc(100dvh-5rem))] flex-col overflow-hidden",
                    )}
                    data-testid={`content_multiselect_${nameTesting}`}
                    id={`content_multiselect_${nameTesting}`}
                    onWheel={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                >
                    <Command className="min-h-0 max-h-full flex-1 flex-col overflow-hidden">
                        <div className="shrink-0">
                            <ButtonsAction
                                handleSelectAll={handleSelectAll}
                                textSearch={textSearch}
                                searchQuery={{ ...searchQuery, input: localInputValue }}
                                handleSearchChange={handleSearchChange}
                                followInput={followInput}
                                hideSelectAll={hideSelectAll}
                                hideSearchButton={!showSearchButton}
                            />
                        </div>
                        <CommandList
                            ref={containerRef}
                            className="min-h-0 flex-1 overflow-y-auto overscroll-contain max-h-[min(280px,calc(100dvh-11rem))]"
                            onWheel={handleWheel}
                            onTouchStart={armInfiniteScroll}
                            onPointerDown={armInfiniteScroll}
                            onTouchMove={(e) => e.stopPropagation()}
                            onScroll={handleScroll}
                        >
                            {isLoading ? (
                                <div
                                    className="flex justify-center items-center p-4 h-36 w-full"
                                    data-testid={`loader_multiselect_${nameTesting}`}
                                    id={`loader_multiselect_${nameTesting}`}
                                >
                                    <GeneralLoader />
                                </div>
                            ) : (
                                <>
                                    <CommandEmpty>{t("genericTexts.noFoundInformation")}</CommandEmpty>
                                    <CommandGroup>
                                        {data.map((item) => (
                                            <CommandItem
                                                data-testid={`item_multiselect_${nameTesting}_${item.id}`}
                                                id={`item_multiselect_${nameTesting}_${item.id}`}
                                                key={item.id}
                                                value={item.value}
                                                onSelect={() => {
                                                    setListValues((prev) =>
                                                        prev.some((selectedItem) => selectedItem.id === item.id)
                                                            ? prev.filter((selectedItem) => selectedItem.id !== item.id)
                                                            : [
                                                                  ...prev,
                                                                  {
                                                                      ...item,
                                                                      id: item.id,
                                                                      label: item.label,
                                                                  },
                                                              ],
                                                    );
                                                }}
                                            >
                                                <CheckIcon
                                                    className={cn(
                                                        "mr-2 h-4 w-4 flex-shrink-0",
                                                        listValues.some((selectedItem) => selectedItem.id === item.id)
                                                            ? "opacity-100"
                                                            : "opacity-0",
                                                    )}
                                                />
                                                {item.label}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                    {isLoadingMore && (
                                        <div className="flex justify-center items-center p-2 w-full">
                                            <GeneralLoader />
                                        </div>
                                    )}
                                </>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            {!listMode && listValues?.length > 5 && (
                <ListPopover listValues={listValues} setListValues={setListValues} nameTesting={nameTesting} />
            )}
        </div>
    );
};

MultiSelect.propTypes = {
    data: PropTypes.array,
    textSearch: PropTypes.string,
    listValues: PropTypes.array,
    setListValues: PropTypes.func,
    isLoading: PropTypes.bool,
    isLoadingMore: PropTypes.bool,
    hasMore: PropTypes.bool,
    nameTesting: PropTypes.string,
    searchQuery: PropTypes.object,
    setSearchQuery: PropTypes.func,
    setPage: PropTypes.func,
    followInput: PropTypes.bool,
    open: PropTypes.bool,
    onOpenChange: PropTypes.func,
    hideSelectAll: PropTypes.bool,
    hideSearchButton: PropTypes.bool,
    listMode: PropTypes.bool,
    onSelectAll: PropTypes.func,
    triggerAriaLabel: PropTypes.string,
    triggerAriaDescribedBy: PropTypes.string,
    triggerAriaInvalid: PropTypes.bool,
};
