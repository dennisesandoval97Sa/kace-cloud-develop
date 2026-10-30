import React, { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
    Root,
    Trigger,
    Value,
    Icon,
    Portal,
    Content,
    ScrollUpButton,
    Viewport,
    Group,
    Label,
    ScrollDownButton,
    Item,
    ItemText,
    ItemIndicator,
} from "@radix-ui/react-select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, Loader2, Search, X } from "lucide-react";
import { useInView } from "react-intersection-observer";
import { cn } from "@kace_v2/shared/utils/cn.util";
import { formatTestId } from "@kace_v2/shared/utils/format-test-id.util";
import { dedupeSelectOptionsKeepingLast } from "@kace_v2/shared/utils/mergeEnsuredSelectOptions.util";

const Select = ({
    className,
    placeholder,
    position,
    label,
    options = [],
    isLoading,
    fetchNextPage,
    hasNextPage = false,
    isFetchingNextPage = false,
    loadingMessage = "Buscando...",
    noResultsMessage,
    noSearchResultsMessage,
    searchPlaceholder = "Buscar...",
    onSearch,
    open: openProp,
    onOpenChange: onOpenChangeProp,
    clearable,
    onClear,
    ...props
}) => {
    const [open, setOpen] = useState(false);
    const [filter, setFilter] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isSearchingApi, setIsSearchingApi] = useState(false);
    const [cachedSelection, setCachedSelection] = useState(null);
    const searchInputRef = useRef(null);
    const latestSearchRef = useRef(0);
    const optionsRef = useRef(options);
    optionsRef.current = options;
    const [viewportEl, setViewportEl] = useState(null);
    const { ref, inView } = useInView({
        root: viewportEl,
        rootMargin: "0px 0px 120px 0px",
        threshold: 0,
    });

    const isControlled = openProp !== undefined;
    const isOpen = isControlled ? openProp : open;

    const handleOpenChange = (nextOpen) => {
        if (!nextOpen) {
            setFilter("");
            setSearchResults([]);
        }
        if (!isControlled) setOpen(nextOpen);
        onOpenChangeProp?.(nextOpen);
    };

    useEffect(() => {
        if (isSearchingApi) {
            const timer = setTimeout(() => searchInputRef.current?.focus(), 0);
            return () => clearTimeout(timer);
        }
    }, [isSearchingApi]);

    useEffect(() => {
        if (!filter.trim()) {
            latestSearchRef.current++;
            setSearchResults([]);
            setIsSearchingApi(false);
            return;
        }

        setIsSearchingApi(true);

        const timer = setTimeout(async () => {
            if (onSearch) {
                const requestId = ++latestSearchRef.current;
                try {
                    const results = await onSearch(filter.trim());
                    if (requestId !== latestSearchRef.current) return;
                    setSearchResults(results || []);
                } catch {
                    if (requestId === latestSearchRef.current) setSearchResults([]);
                } finally {
                    if (requestId === latestSearchRef.current) setIsSearchingApi(false);
                }
                return;
            }

            const query = filter.trim().toLowerCase();
            const localFiltered = (optionsRef.current || []).filter((opt) =>
                String(opt?.label ?? "")
                    .toLowerCase()
                    .includes(query),
            );
            setSearchResults(localFiltered);
            setIsSearchingApi(false);
        }, 300);

        return () => clearTimeout(timer);
    }, [filter, onSearch]);

    const displayOptions = useMemo(() => {
        const base = filter.trim() === "" ? options : searchResults;
        return dedupeSelectOptionsKeepingLast(base);
    }, [filter, options, searchResults]);

    useEffect(() => {
        if (inView && hasNextPage && !isFetchingNextPage && fetchNextPage && filter.trim() === "") {
            fetchNextPage();
        }
    }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage, filter, displayOptions.length]);

    const handleInfiniteScroll = (event) => {
        if (!fetchNextPage || !hasNextPage || isFetchingNextPage || filter.trim() !== "") return;
        const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
        if (scrollTop + clientHeight >= scrollHeight - 50) {
            fetchNextPage();
        }
    };

    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                searchInputRef.current?.focus();
            }, 0);

            return () => clearTimeout(timer);
        }
    }, [filter, isOpen]);

    const { onValueChange: externalOnValueChange, value: selectedValue, ...rootProps } = props;

    const handleValueChange = (newValue) => {
        if (!newValue) return;
        const opt = displayOptions.find((o) => String(o.value) === String(newValue));
        if (opt) setCachedSelection(opt);
        externalOnValueChange?.(newValue);
    };

    const hasSelection = selectedValue !== undefined && selectedValue !== null && selectedValue !== "";

    useEffect(() => {
        if (!selectedValue) return;
        const match = options.find((o) => String(o.value) === String(selectedValue));
        if (match) setCachedSelection(match);
    }, [options, selectedValue]);

    const selectedLabel = useMemo(() => {
        if (!selectedValue) return undefined;
        return (
            options.find((o) => String(o.value) === String(selectedValue))?.label ??
            (cachedSelection && String(cachedSelection.value) === String(selectedValue)
                ? cachedSelection.label
                : undefined)
        );
    }, [options, selectedValue, cachedSelection]);

    return (
        <Root
            {...rootProps}
            value={selectedValue}
            open={isOpen}
            onOpenChange={handleOpenChange}
            onValueChange={handleValueChange}
        >
            <Trigger
                className={cn(
                    "flex h-10 w-full items-center justify-between gap-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
                    className,
                )}
                data-testid={formatTestId("select-trigger", label)}
            >
                <span className="min-w-0 flex-1 overflow-hidden text-left line-clamp-1">
                    <Value placeholder={placeholder}>{selectedLabel ?? ""}</Value>
                </span>
                <div className="flex shrink-0 items-center gap-1">
                    {clearable && hasSelection && typeof onClear === "function" && (
                        <button
                            type="button"
                            className="rounded-sm p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            onPointerDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setCachedSelection(null);
                                onClear();
                            }}
                            aria-label="Clear"
                            data-testid={formatTestId("select-clear", label)}
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                    <Icon>
                        <ChevronDownIcon className="h-4 w-4 opacity-50" />
                    </Icon>
                </div>
            </Trigger>
            <Portal>
                <Content
                    className={cn(
                        "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
                        {
                            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1":
                                position === "popper",
                        },
                    )}
                    position={position}
                    data-testid={formatTestId("select-portal", label)}
                >
                    <ScrollUpButton className="flex cursor-default items-center justify-center py-1">
                        <ChevronUpIcon className="h-4 w-4" />
                    </ScrollUpButton>
                    <div className="flex items-center border-b px-3 py-2">
                        {isSearchingApi ? (
                            <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
                        ) : (
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        )}
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder={searchPlaceholder}
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        />
                    </div>
                    <Viewport
                        ref={setViewportEl}
                        className={cn("p-1", {
                            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]":
                                position === "popper",
                        })}
                        onMouseEnter={() => searchInputRef.current?.focus()}
                        onScroll={handleInfiniteScroll}
                        data-testid={formatTestId("select-viewport", label)}
                    >
                        <Group>
                            {label && (
                                <Label
                                    className="py-1.5 pl-8 pr-2 text-sm font-semibold"
                                    data-testid={formatTestId("select-label", label)}
                                >
                                    {label}
                                </Label>
                            )}
                            {isLoading ? (
                                <div className="flex items-center justify-center py-6">
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    <span className="text-sm text-muted-foreground">{loadingMessage}</span>
                                </div>
                            ) : (
                                <>
                                    {!isSearchingApi &&
                                    displayOptions.length === 0 &&
                                    (noResultsMessage || noSearchResultsMessage) ? (
                                        <div className="py-6 text-center text-sm text-muted-foreground">
                                            {filter.trim() ? noSearchResultsMessage : noResultsMessage}
                                        </div>
                                    ) : (
                                        displayOptions.map(({ label, value }) => (
                                            <SelectItem
                                                key={`${label}-${value}`}
                                                value={value}
                                                data-testid={formatTestId("select-option", `${label}-${value}`)}
                                            >
                                                {label}
                                            </SelectItem>
                                        ))
                                    )}
                                    <div ref={ref} className="flex items-center justify-center py-2">
                                        {isFetchingNextPage && (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                <span className="text-sm text-muted-foreground">{loadingMessage}</span>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </Group>
                    </Viewport>
                    <ScrollDownButton className="flex cursor-default items-center justify-center py-1">
                        <ChevronDownIcon className="h-4 w-4" />
                    </ScrollDownButton>
                </Content>
            </Portal>
        </Root>
    );
};

Select.propTypes = {
    className: PropTypes.string,
    placeholder: PropTypes.string,
    position: PropTypes.oneOf(["item-aligned", "popper"]),
    label: PropTypes.string,
    options: PropTypes.arrayOf(
        PropTypes.shape({
            label: PropTypes.string,
            value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        }),
    ),
    isLoading: PropTypes.bool,
    fetchNextPage: PropTypes.func,
    hasNextPage: PropTypes.bool,
    isFetchingNextPage: PropTypes.bool,
    loadingMessage: PropTypes.string,
    noResultsMessage: PropTypes.string,
    noSearchResultsMessage: PropTypes.string,
    searchPlaceholder: PropTypes.string,
    onSearch: PropTypes.func,
    clearable: PropTypes.bool,
    onClear: PropTypes.func,
};

const SelectItem = ({ children, className, ...props }) => {
    return (
        <Item
            className={cn(
                "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                className,
            )}
            {...props}
        >
            <ItemText>{children}</ItemText>
            <ItemIndicator>
                <CheckIcon className="h-4 w-4" />
            </ItemIndicator>
        </Item>
    );
};

SelectItem.propTypes = {
    children: PropTypes.node.isRequired,
    className: PropTypes.string,
};

export default Select;
