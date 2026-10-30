import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useDebounced from "@/hooks/useDebounced";
import useGenericSearchQuery from "@/hooks/useGenericSearchQuery";

const PAGE_SIZE = 10;
const EMPTY_VALUES = [];

const getValueId = (value) => (typeof value === "string" ? value : value?.id);

const processSearchResult = (data) => {
    const rows = Array.isArray(data?.data) ? data.data : [];
    const rawTotal = typeof data?.metadata?.count === "object" ? data.metadata.count?.count : data?.metadata?.count;
    const parsedTotal = Number(rawTotal);

    return {
        rows,
        total: Number.isFinite(parsedTotal) ? parsedTotal : null,
    };
};

export const useSearchableMultiSelect = ({
    url,
    keyQuery,
    searchField,
    toOption,
    listValues = EMPTY_VALUES,
    setListValues = () => null,
    values = EMPTY_VALUES,
    enableSearch = false,
    enforceSingle = false,
}) => {
    const [dataItems, setDataItems] = useState([]);
    const [searchFilters, setSearchFilters] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [currentSearchQuery, setCurrentSearchQuery] = useState("");
    const [hasSearched, setHasSearched] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [initialData, setInitialData] = useState([]);
    const hasInitializedRef = useRef(false);

    const selectedValueIds = useMemo(() => values.map(getValueId).filter(Boolean).join(", "), [values]);

    const pagination = useMemo(
        () => ({
            limit: PAGE_SIZE,
            offset: (currentPage - 1) * PAGE_SIZE,
        }),
        [currentPage],
    );

    const {
        data: searchResult,
        isFetching,
        refetch,
    } = useGenericSearchQuery({
        url,
        keyQuery,
        select: processSearchResult,
        filter: searchFilters,
        pagination,
        enabled: false,
    });

    const normalizeListValues = useCallback(
        (nextValues) => {
            const normalizedValues = Array.isArray(nextValues) ? nextValues : [];
            return enforceSingle ? normalizedValues.slice(-1) : normalizedValues;
        },
        [enforceSingle],
    );

    const setSafeListValues = useCallback(
        (updater) => {
            const nextValues = typeof updater === "function" ? updater(listValues) : updater;
            setListValues(normalizeListValues(nextValues));
        },
        [listValues, normalizeListValues, setListValues],
    );

    const executeSearch = useCallback(
        (query) => {
            const trimmedQuery = query?.trim();

            if (trimmedQuery) {
                setHasSearched(true);
                setSearchFilters([
                    {
                        field: searchField,
                        operator: "ilike",
                        value: trimmedQuery,
                        type: "AND",
                    },
                ]);
            } else {
                setSearchFilters([]);
                setHasSearched(false);
                setIsSearching(false);
                setDataItems(initialData);
            }
            setCurrentPage(1);
        },
        [initialData, searchField],
    );

    const debouncedSearch = useDebounced(executeSearch, 500);

    useEffect(() => {
        if (isPopoverOpen) {
            refetch();
            hasInitializedRef.current = true;
        }
    }, [currentPage, isPopoverOpen, refetch, searchFilters]);

    useEffect(() => {
        if (!hasInitializedRef.current && selectedValueIds && searchFilters.length > 0) {
            refetch();
            hasInitializedRef.current = true;
        }
    }, [refetch, searchFilters.length, selectedValueIds]);

    const handleDataItems = useCallback(
        (data = [], isNewSearch = false, isInitialLoad = false) => {
            const newItems = data.map(toOption);

            setDataItems((prevItems) => {
                if (isNewSearch) {
                    return newItems;
                } else if (currentPage === 1 && !isInitialLoad) {
                    return newItems;
                }

                const existingIds = new Set(prevItems.map((item) => item.id));
                const newUniqueItems = newItems.filter((item) => !existingIds.has(item.id));
                return [...prevItems, ...newUniqueItems];
            });

            if (isInitialLoad || (!hasSearched && currentPage === 1)) {
                setInitialData((prevInitial) => {
                    if (currentPage === 1 && !isNewSearch) {
                        return newItems;
                    }

                    const existingIds = new Set(prevInitial.map((item) => item.id));
                    const newUniqueItems = newItems.filter((item) => !existingIds.has(item.id));
                    return [...prevInitial, ...newUniqueItems];
                });
            }
        },
        [currentPage, hasSearched, toOption],
    );

    useEffect(() => {
        if (!selectedValueIds || listValues.length > 0) {
            return;
        }

        const rows = searchResult?.rows ?? [];
        const selectedIds = selectedValueIds.split(", ");
        const initialSelected = selectedIds
            .map((selectedId) => {
                const selectedData = rows.find((item) => item.id === selectedId);
                return selectedData?.id ? toOption(selectedData) : null;
            })
            .filter(Boolean);

        if (initialSelected.length > 0) {
            setSafeListValues(initialSelected);
        }
    }, [listValues.length, searchResult, selectedValueIds, setSafeListValues, toOption]);

    useEffect(() => {
        if (searchResult && !isFetching) {
            const isNewSearch = currentPage === 1 && hasSearched;
            const isInitialLoad = !hasInitializedRef.current;
            handleDataItems(searchResult.rows ?? [], isNewSearch, isInitialLoad);
            setIsSearching(false);
        }
    }, [currentPage, handleDataItems, hasSearched, isFetching, searchResult]);

    useEffect(() => {
        if (selectedValueIds && listValues.length === 0) {
            setSearchFilters([
                {
                    field: "id",
                    operator: "in",
                    value: selectedValueIds,
                    type: "OR",
                },
            ]);
        }
    }, [listValues.length, selectedValueIds]);

    const handleSearch = useCallback(
        (searchPayload) => {
            const query = searchPayload?.filter || "";

            if (query !== currentSearchQuery) {
                setCurrentSearchQuery(query);

                if (enableSearch) {
                    if (query.trim() && !isSearching) {
                        setIsSearching(true);
                    }
                    debouncedSearch(query);
                }
            }
        },
        [currentSearchQuery, debouncedSearch, enableSearch, isSearching],
    );

    const handlePopoverChange = useCallback(
        (open) => {
            setIsPopoverOpen(open);

            if (!open) {
                setCurrentSearchQuery("");
                setSearchFilters([]);
                setCurrentPage(1);
                setHasSearched(false);
                setIsSearching(false);
                setDataItems(initialData);
            }
        },
        [initialData],
    );

    const handlePageChange = useCallback((newPage) => {
        setCurrentPage(newPage);
    }, []);

    const data = useMemo(() => {
        const selectedIds = new Set(listValues.map((item) => item.id));
        const currentDataIds = new Set(dataItems.map((item) => item.id));

        const missingSelected = listValues.filter((item) => !currentDataIds.has(item.id));
        const selectedInData = dataItems.filter((item) => selectedIds.has(item.id));
        const unselectedInData = dataItems.filter((item) => !selectedIds.has(item.id));

        if (hasSearched && isFetching && dataItems.length === 0) {
            return missingSelected;
        }

        return [...missingSelected, ...selectedInData, ...unselectedInData];
    }, [dataItems, hasSearched, isFetching, listValues]);

    const searchQuery = useMemo(
        () => ({ input: currentSearchQuery, filter: currentSearchQuery }),
        [currentSearchQuery],
    );

    const currentRowsLength = searchResult?.rows?.length ?? 0;
    const totalRows = searchResult?.total;
    const hasMore =
        totalRows !== null && totalRows !== undefined
            ? currentPage * PAGE_SIZE < totalRows
            : currentRowsLength === PAGE_SIZE;

    return {
        data,
        listValues,
        setListValues: setSafeListValues,
        isLoading: (isFetching && currentPage === 1) || isSearching,
        isLoadingMore: isFetching && currentPage > 1,
        hasMore,
        searchQuery,
        setSearchQuery: handleSearch,
        setPage: handlePageChange,
        followInput: true,
        hideSearchButton: true,
        open: isPopoverOpen,
        onOpenChange: handlePopoverChange,
    };
};
