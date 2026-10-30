import { MultiSelect } from "@kace/ui-shared";
import { useState, useCallback, useMemo, useEffect } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import useGenericSearchQuery from "../../../../../../../../../hooks/useGenericSearchQuery";
import { URL_AND_KEYS } from "../../../../../../../../../utils/urlAndKeys";
import useDebounced from "@/hooks/useDebounced";
import { filterByIsActive, filterByIsPrimary } from "@/utils/genericFilters";

const ITEM_TYPES = {
    ACTION: "action",
    REST_FLOW: "restFlow",
};

// Solo flujos primarios: los subflujos (is_primary = false, creados por WSRestFlowCreator) se ejecutan
// inline dentro del flujo padre (WorkflowStepExecutorService#executeConditional), por lo que sus
// event_logs quedan registrados bajo el aggregate_id del flujo primario y no son seleccionables aparte.
const REST_FLOW_EXTRA_FILTERS = [filterByIsPrimary];

const PAGINATION_CONFIG = {
    LIMIT: 10,
    DEBOUNCE_MS: 500,
    STALE_TIME_MS: 1000 * 60 * 5,
};

const getItemType = (typeTag) => (typeTag === "Action" ? ITEM_TYPES.ACTION : ITEM_TYPES.REST_FLOW);

const parseMetadataCount = (metadata) => {
    if (!metadata?.count) return 0;

    if (typeof metadata.count === "object") {
        return parseInt(metadata.count.count || 0, 10);
    }
    return parseInt(metadata.count, 10);
};

const MultiSelectAsync = ({
    label,
    placeholder,
    url,
    queryKey,
    searchParam,
    typeTag,
    listValues,
    setListValues,
    isItemOfType,
    hideSelectAll = false,
    listMode = false,
    extraFilters = [],
}) => {
    const [dataItems, setDataItems] = useState([]);
    const [queryParams, setQueryParams] = useState({ filters: [], page: 1 });
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [currentSearchQuery, setCurrentSearchQuery] = useState("");
    const [hasMore, setHasMore] = useState(true);

    const { filters: searchFilters, page: currentPage } = queryParams;
    const itemType = useMemo(() => getItemType(typeTag), [typeTag]);

    const {
        data: searchData,
        isFetching,
        isError,
    } = useGenericSearchQuery({
        url,
        keyQuery: queryKey,
        filter: [...(searchFilters || []), filterByIsActive, ...extraFilters],
        pagination: {
            limit: PAGINATION_CONFIG.LIMIT,
            offset: (currentPage - 1) * PAGINATION_CONFIG.LIMIT,
        },
        enabled: isPopoverOpen,
        staleTime: PAGINATION_CONFIG.STALE_TIME_MS,
    });

    const executeSearch = useCallback(
        (query) => {
            const trimmedQuery = query?.trim();

            setHasMore(true);
            setQueryParams({
                filters: trimmedQuery
                    ? [
                          {
                              field: searchParam,
                              operator: "ilike",
                              value: trimmedQuery,
                              type: "AND",
                          },
                      ]
                    : [],
                page: 1,
            });
        },
        [searchParam],
    );

    const debouncedSearch = useDebounced(executeSearch, PAGINATION_CONFIG.DEBOUNCE_MS);

    const transformDataItems = useCallback(
        (data) => {
            return data.map((item) => ({
                id: item.id,
                label: item[searchParam] || item.name || item.description,
                value: item[searchParam] || item.name || item.description,
                type: itemType,
            }));
        },
        [searchParam, itemType],
    );

    const updateDataItems = useCallback(
        (newItems, totalCount) => {
            setDataItems((prevItems) => {
                const finalItems =
                    currentPage === 1
                        ? newItems
                        : (() => {
                              const existingIds = new Set(prevItems.map((i) => i.id));
                              const uniqueNewItems = newItems.filter((i) => !existingIds.has(i.id));
                              return [...prevItems, ...uniqueNewItems];
                          })();

                setHasMore(
                    totalCount > 0 ? finalItems.length < totalCount : newItems.length >= PAGINATION_CONFIG.LIMIT,
                );

                return finalItems;
            });
        },
        [currentPage],
    );

    useEffect(() => {
        if (!isPopoverOpen) return;

        if (isError || !searchData || isFetching) {
            return;
        }

        const rawItems = searchData.data || [];
        const items = Array.isArray(rawItems) ? rawItems : rawItems.items || [];
        const totalCount = parseMetadataCount(searchData.metadata);

        const transformedItems = transformDataItems(items);
        updateDataItems(transformedItems, totalCount);
    }, [searchData, isFetching, isError, transformDataItems, updateDataItems, isPopoverOpen]);

    const handleSearch = useCallback(
        (searchPayload) => {
            const query = searchPayload?.filter || "";
            if (query !== currentSearchQuery) {
                setCurrentSearchQuery(query);
                debouncedSearch(query);
            }
        },
        [currentSearchQuery, debouncedSearch],
    );

    const resetState = useCallback(() => {
        setCurrentSearchQuery("");
        setQueryParams({ filters: [], page: 1 });
        setDataItems([]);
        setHasMore(true);
    }, []);

    const handlePopoverChange = useCallback(
        (open) => {
            setIsPopoverOpen(open);
            if (!open) {
                resetState();
            }
        },
        [resetState],
    );

    const handlePageChange = useCallback((newPage) => {
        setQueryParams((prev) => ({ ...prev, page: newPage }));
    }, []);

    const handleSetValues = useCallback(
        (newValuesOrFunc) => {
            if (typeof newValuesOrFunc === "function") {
                setListValues((prevList) => {
                    const currentThisType = prevList.filter(isItemOfType);
                    const otherTypes = prevList.filter((item) => !isItemOfType(item));
                    const newThisType = newValuesOrFunc(currentThisType);
                    return [...otherTypes, ...newThisType.map((item) => ({ ...item, type: itemType }))];
                });
            } else {
                const otherTypes = listValues.filter((item) => !isItemOfType(item));
                const newValues = newValuesOrFunc.map((item) => ({ ...item, type: itemType }));
                setListValues([...otherTypes, ...newValues]);
            }
        },
        [listValues, setListValues, isItemOfType, itemType],
    );

    const displayData = useMemo(() => {
        const currentDataIds = new Set(dataItems.map((item) => item.id));
        const currentSelections = listValues.filter(isItemOfType);
        const missingSelected = currentSelections.filter((item) => !currentDataIds.has(item.id));

        return [...missingSelected, ...dataItems];
    }, [dataItems, listValues, isItemOfType]);

    const isLoading = !isError && (isFetching || (!searchData && isPopoverOpen)) && currentPage === 1;
    const isLoadingMore = !isError && isFetching && currentPage > 1;

    return (
        <div className="w-1/2">
            <label className="text-xs text-gray-500 mb-1 block">{label}</label>
            <MultiSelect
                data={displayData}
                textSearch={placeholder}
                listValues={listValues.filter(isItemOfType)}
                setListValues={handleSetValues}
                isLoading={isLoading}
                isLoadingMore={isLoadingMore}
                hasMore={hasMore}
                searchQuery={{ input: currentSearchQuery, filter: currentSearchQuery }}
                setSearchQuery={handleSearch}
                setPage={handlePageChange}
                followInput={true}
                open={isPopoverOpen}
                onOpenChange={handlePopoverChange}
                className="w-full"
                hideSelectAll={hideSelectAll}
                hideSearchButton
                listMode={listMode}
            />
        </div>
    );
};

MultiSelectAsync.propTypes = {
    label: PropTypes.string,
    placeholder: PropTypes.string,
    url: PropTypes.string.isRequired,
    queryKey: PropTypes.string.isRequired,
    searchParam: PropTypes.string.isRequired,
    typeTag: PropTypes.string.isRequired,
    listValues: PropTypes.array.isRequired,
    setListValues: PropTypes.func.isRequired,
    isItemOfType: PropTypes.func.isRequired,
    hideSelectAll: PropTypes.bool,
    listMode: PropTypes.bool,
    extraFilters: PropTypes.array,
};

export const AggregateIdSelector = ({ listValues, setListValues }) => {
    const { t } = useTranslation();

    const isAction = useCallback((item) => item.type === ITEM_TYPES.ACTION, []);
    const isRestFlow = useCallback((item) => item.type === ITEM_TYPES.REST_FLOW, []);

    return (
        <div className="flex flex-row gap-2 w-full">
            <MultiSelectAsync
                label={t("event_logs.actionName")}
                placeholder={t("app.forms.search")}
                url={`${URL_AND_KEYS.actions.url}/search`}
                queryKey={URL_AND_KEYS.actions.key}
                searchParam="description"
                typeTag="Action"
                listValues={listValues}
                setListValues={setListValues}
                isItemOfType={isAction}
                hideSelectAll={true}
                listMode={true}
            />

            <MultiSelectAsync
                label={t("event_logs.restflowName")}
                placeholder={t("app.forms.search")}
                url={`${URL_AND_KEYS.restFlows.url}/search`}
                queryKey={URL_AND_KEYS.restFlows.key}
                searchParam="description"
                typeTag="RestFlow"
                listValues={listValues}
                setListValues={setListValues}
                isItemOfType={isRestFlow}
                hideSelectAll={true}
                listMode={true}
                extraFilters={REST_FLOW_EXTRA_FILTERS}
            />
        </div>
    );
};

AggregateIdSelector.propTypes = {
    listValues: PropTypes.array.isRequired,
    setListValues: PropTypes.func.isRequired,
};
