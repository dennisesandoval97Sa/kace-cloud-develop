import { PropTypes } from "prop-types";
import {
    Select as SelectCustom,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
    Label,
    GeneralLoader,
} from "@kace/ui-shared";
import { useField } from "formik";
import { useEffect, useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { InputErrors } from "../InputErrors";
import { formatTestId } from "@/utils/src/helpers";
import { useInfiniteScrollGate } from "@/hooks/useInfiniteScrollGate";
import { isViewportAtBottom } from "@/hooks/infiniteScrollViewport";

export const Select = ({
    options = [],
    label = null,
    className = "w-full",
    placeholder = "Seleccione una opción",
    dependentFieldId = "",
    handle = () => null,
    isLoading = false,
    showInputErrors = true,
    onSearchChange,
    fetchNextPage,
    hasNextPage = false,
    isFetchingNextPage = false,
    disabled = false,
    clearable = false,
    disableUntilReady = false,
    ...props
}) => {
    const { t } = useTranslation();
    const [field, meta, helpers] = useField(props);
    const [searchInput, setSearchInput] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [isInitialReady, setIsInitialReady] = useState(!disableUntilReady);
    const lastEmittedSearchTermRef = useRef(searchInput);
    const searchInputRef = useRef(null);
    const {
        arm: armInfiniteScroll,
        reset: resetInfiniteScroll,
        consume: consumeInfiniteScroll,
    } = useInfiniteScrollGate();
    const id = props.id ? props.id : props.name;
    const hasSearch = typeof onSearchChange === "function";
    const isSelectDisabled = disabled || (disableUntilReady && !isInitialReady);
    const hasSelection = field.value !== undefined && field.value !== null && field.value !== "";
    const showClearButton = clearable && hasSelection && !isSelectDisabled;

    const handleChange = (value) => {
        helpers.setValue(value);
        handle(value);
    };

    const handleClear = (event) => {
        event.preventDefault();
        event.stopPropagation();
        helpers.setValue("");
        handle("");
        setSearchInput("");
        lastEmittedSearchTermRef.current = "";
        if (hasSearch) onSearchChange("");
    };

    const focusSearchInput = useCallback(() => {
        if (!hasSearch || isSelectDisabled) return;
        const input = searchInputRef.current;
        if (!input || document.activeElement === input) return;
        input.focus({ preventScroll: true });
    }, [hasSearch, isSelectDisabled]);

    useEffect(() => {
        handleChange(field.value);
        handle(field.value);
    }, [field.value]);

    useEffect(() => {
        if (!disableUntilReady) {
            setIsInitialReady(true);
            return;
        }
        if (!isLoading) setIsInitialReady(true);
    }, [disableUntilReady, isLoading]);

    useEffect(() => {
        if (!hasSearch) return undefined;
        if (searchInput === lastEmittedSearchTermRef.current) return undefined;

        const timeoutId = setTimeout(() => {
            lastEmittedSearchTermRef.current = searchInput;
            onSearchChange(searchInput);
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [hasSearch, onSearchChange, searchInput]);

    useEffect(() => {
        if (!isOpen || !hasSearch || isSelectDisabled) return undefined;
        const timeoutId = setTimeout(() => {
            focusSearchInput();
        }, 0);
        return () => clearTimeout(timeoutId);
    }, [isOpen, hasSearch, isSelectDisabled, searchInput, options, isLoading, isFetchingNextPage, focusSearchInput]);

    const lastFetchHeightRef = useRef(0);

    const tryFetchNextPageFromBottom = useCallback(
        (element) => {
            if (typeof fetchNextPage !== "function") return;
            if (!isViewportAtBottom(element)) return;
            if (!hasNextPage || isFetchingNextPage) return;
            if (element.scrollHeight === lastFetchHeightRef.current) return;
            if (!consumeInfiniteScroll()) return;
            lastFetchHeightRef.current = element.scrollHeight;
            fetchNextPage();
        },
        [consumeInfiniteScroll, fetchNextPage, hasNextPage, isFetchingNextPage],
    );

    const handleScroll = useCallback(
        (event) => {
            tryFetchNextPageFromBottom(event.currentTarget);
        },
        [tryFetchNextPageFromBottom],
    );

    const handleWheel = useCallback(
        (event) => {
            armInfiniteScroll();
            if (event.deltaY > 0) {
                tryFetchNextPageFromBottom(event.currentTarget);
            }
        },
        [armInfiniteScroll, tryFetchNextPageFromBottom],
    );

    const handleKeyDownArm = useCallback(
        (event) => {
            if (event.key === "ArrowDown" || event.key === "PageDown" || event.key === "End") {
                armInfiniteScroll();
            }
        },
        [armInfiniteScroll],
    );

    return (
        <div className={className}>
            <div className="flex justify-between items-center w-full py-2">
                {label && (
                    <Label
                        htmlFor={`btn_select_trigger_${id}`}
                        className={`${!meta.touched && meta.error && "text-redCustom font-semibold"}`}
                    >
                        {label}
                    </Label>
                )}
                {showInputErrors && <InputErrors meta={meta} />}
            </div>
            <div className="flex w-full items-center gap-2">
                <div className="min-w-0 flex-1">
                    <SelectCustom
                        id={`select_custom_${id}`}
                        data-dependent-field-id={dependentFieldId}
                        onValueChange={handleChange}
                        value={field.value}
                        disabled={isSelectDisabled}
                        onBlur={() => helpers.setTouched(true)}
                        onOpenChange={(open) => {
                            if (isSelectDisabled) return;
                            setIsOpen(open);
                            resetInfiniteScroll();
                            lastFetchHeightRef.current = 0;
                            if (!open) {
                                setSearchInput("");
                                lastEmittedSearchTermRef.current = "";
                                if (hasSearch) onSearchChange("");
                            }
                        }}
                        data-testid={`select_custom_${id}`}
                        {...props}
                    >
                        <SelectTrigger
                            className={`w-full ${meta.error && !meta.touched && "border-redCustom text-redCustom"}`}
                            data-testid={`btn_select_trigger_${id}`}
                            id={`btn_select_trigger_${id}`}
                            disabled={isSelectDisabled}
                        >
                            <SelectValue
                                placeholder={
                                    disableUntilReady && !isInitialReady ? t("genericTexts.loading") : placeholder
                                }
                                id={formatTestId("select_value", `${field.value}`)}
                                data-testid={formatTestId("select_value", `${field.value}`)}
                            />
                        </SelectTrigger>
                        <SelectContent
                            onScroll={typeof fetchNextPage === "function" ? handleScroll : undefined}
                            onWheel={typeof fetchNextPage === "function" ? handleWheel : undefined}
                            onTouchStart={typeof fetchNextPage === "function" ? armInfiniteScroll : undefined}
                            onPointerDown={typeof fetchNextPage === "function" ? armInfiniteScroll : undefined}
                            onPointerMove={typeof fetchNextPage === "function" ? armInfiniteScroll : undefined}
                            onKeyDown={typeof fetchNextPage === "function" ? handleKeyDownArm : undefined}
                            header={
                                hasSearch ? (
                                    <div className="p-2">
                                        <input
                                            ref={searchInputRef}
                                            type="search"
                                            value={searchInput}
                                            onChange={(event) => setSearchInput(event.target.value)}
                                            onKeyDown={(event) => event.stopPropagation()}
                                            onMouseDown={(event) => {
                                                event.stopPropagation();
                                                event.preventDefault();
                                                focusSearchInput();
                                            }}
                                            onFocus={focusSearchInput}
                                            placeholder={t("select.searchPlaceholder")}
                                            className="w-full rounded-md border px-3 py-2 text-sm"
                                            data-testid="select-search-input"
                                        />
                                    </div>
                                ) : null
                            }
                        >
                            <SelectGroup>
                                <SelectLabel>{t("select.options")}</SelectLabel>
                                {isLoading ? (
                                    <div className="flex justify-center items-center p-4 h-36 w-full">
                                        <GeneralLoader />
                                    </div>
                                ) : options.length === 0 ? (
                                    <div className="flex text-sm items-center justify-center w-full p-22">
                                        {t("select.noOptions")}
                                    </div>
                                ) : (
                                    options.map((option, index) => (
                                        <SelectItem
                                            value={option.value}
                                            key={`${option.value}-${index}`}
                                            data-testid={`select_option_${option.value}_${index}`}
                                            id={`select_option_${option.value}_${index}`}
                                        >
                                            <div
                                                className="flex items-center justify-between w-full gap-4"
                                                id={`select_option_${option.value}`}
                                                data-testid={`select_option_${option.value}`}
                                            >
                                                {option.icon && <span>{option.icon} </span>}
                                                <span
                                                    id={formatTestId("select_item_span", `${option.label}`)}
                                                    data-testid={formatTestId("select_item_span", `${option.label}`)}
                                                >
                                                    {option.label}
                                                </span>
                                            </div>
                                        </SelectItem>
                                    ))
                                )}
                                {isFetchingNextPage && (
                                    <div className="flex justify-center p-2">
                                        <GeneralLoader />
                                    </div>
                                )}
                            </SelectGroup>
                        </SelectContent>
                    </SelectCustom>
                </div>
                {showClearButton ? (
                    <button
                        type="button"
                        onClick={handleClear}
                        aria-label={t("button.clearSelection")}
                        data-testid={`btn_select_clear_${id}`}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                        <X className="h-4 w-4" />
                    </button>
                ) : null}
            </div>
        </div>
    );
};

Select.propTypes = {
    name: PropTypes.string.isRequired,
    options: PropTypes.arrayOf(
        PropTypes.shape({
            value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
            label: PropTypes.string.isRequired,
        }),
    ).isRequired,
    id: PropTypes.string,
    label: PropTypes.string,
    dependentFieldId: PropTypes.string,
    className: PropTypes.string,
    placeholder: PropTypes.string,
    handle: PropTypes.func,
    isLoading: PropTypes.bool,
    showInputErrors: PropTypes.bool,
    onSearchChange: PropTypes.func,
    fetchNextPage: PropTypes.func,
    hasNextPage: PropTypes.bool,
    isFetchingNextPage: PropTypes.bool,
    disabled: PropTypes.bool,
    clearable: PropTypes.bool,
    disableUntilReady: PropTypes.bool,
};
