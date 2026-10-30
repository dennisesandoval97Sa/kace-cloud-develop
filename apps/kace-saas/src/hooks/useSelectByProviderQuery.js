import { useCallback, useEffect, useMemo, useState } from "react";
import useGenericSearchQuery from "./useGenericSearchQuery";
import {
    appendUniqueOptions,
    computeHasNextPage,
    filterOptionsByLabel,
    mapRawItemsToOptions,
    mergeSeedIntoOptions,
    resolveFieldName,
    seedOptionFromInitialValue,
    shouldIncludeSeedInOptions,
    sortOptionsAlphabetically,
} from "@/components/ui-shared/src/components/selectByProvider/selectByProviderOptions";

const identity = (data) => data;

const toSearchUrl = (url) => {
    if (!url) return "";
    return url.endsWith("/search") ? url : `${url}/search`;
};

const sameOptions = (left, right) =>
    left.length === right.length &&
    left.every((option, index) => option.value === right[index].value && option.label === right[index].label);

const buildListKeyQuery = (name, url, order) =>
    `select-by-provider:${name}:${url}:${order?.field ?? ""}:${order?.direction ?? ""}`;

const buildSeedKeyQuery = (name, url) => `select-by-provider:${name}:${url}:seed`;

const useSelectByProviderQuery = ({
    name,
    url,
    filters = [],
    queryLimit = 20,
    valueFrom = "id",
    labelFrom = "nombre",
    searchField,
    orderField,
    enableSearch = false,
    enableInfiniteScroll = false,
    enableAlphabeticalOrder = false,
    dataOptions = null,
    processData = identity,
    selectedValue,
    initialValue = {},
}) => {
    const [page, setPage] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");
    const [accumulated, setAccumulated] = useState([]);
    const isLocal = Array.isArray(dataOptions);
    const normalizedSearchTerm = searchTerm.trim();
    const filtersKey = JSON.stringify(filters);
    const fieldForSearch = resolveFieldName(labelFrom, searchField);
    const fieldForOrder = resolveFieldName(labelFrom, orderField);

    const remoteFilters = useMemo(() => {
        const next = [...filters];
        if (enableSearch && normalizedSearchTerm && fieldForSearch) {
            next.push({
                field: fieldForSearch,
                operator: "ilike",
                value: normalizedSearchTerm,
                type: "AND",
            });
        }
        return next;
    }, [filtersKey, enableSearch, normalizedSearchTerm, fieldForSearch]);

    const order = enableAlphabeticalOrder && fieldForOrder ? { field: fieldForOrder, direction: "asc" } : null;
    const searchUrl = toSearchUrl(url);
    const listKeyQuery = buildListKeyQuery(name, url, order);
    const seedKeyQuery = buildSeedKeyQuery(name, url);

    const listQuery = useGenericSearchQuery({
        keyQuery: listKeyQuery,
        url: searchUrl,
        filter: remoteFilters,
        pagination: { limit: queryLimit, offset: page * queryLimit },
        order,
        enabled: !isLocal && !!url,
        select: processData,
    });

    useEffect(() => {
        setPage(0);
        setAccumulated((previous) => (previous.length === 0 ? previous : []));
    }, [filtersKey]);

    useEffect(() => {
        const rows = listQuery.data?.data;
        if (!Array.isArray(rows)) return;

        const mapped = mapRawItemsToOptions(rows, { valueFrom, labelFrom });
        setAccumulated((previous) => {
            if (!enableInfiniteScroll || page === 0) {
                return sameOptions(previous, mapped) ? previous : mapped;
            }

            const next = appendUniqueOptions(previous, mapped);
            return sameOptions(previous, next) ? previous : next;
        });
    }, [listQuery.data, page, enableInfiniteScroll, valueFrom, labelFrom, normalizedSearchTerm]);

    const seedFromInitial = useMemo(() => {
        const mapped = seedOptionFromInitialValue(initialValue, { valueFrom, labelFrom });
        if (!mapped || (selectedValue != null && String(mapped.value) !== String(selectedValue))) {
            return null;
        }
        return mapped;
    }, [initialValue, valueFrom, labelFrom, selectedValue]);

    const hasSelectedValue = selectedValue !== undefined && selectedValue !== null && selectedValue !== "";
    const selectedInCurrentPage = useMemo(
        () =>
            mapRawItemsToOptions(listQuery.data?.data, { valueFrom, labelFrom }).some(
                (option) => String(option.value) === String(selectedValue),
            ),
        [listQuery.data?.data, valueFrom, labelFrom, selectedValue],
    );
    const needsSeedFetch =
        !isLocal &&
        !!url &&
        hasSelectedValue &&
        !listQuery.isLoading &&
        !seedFromInitial &&
        !selectedInCurrentPage &&
        !accumulated.some((option) => String(option.value) === String(selectedValue));

    const seedQuery = useGenericSearchQuery({
        keyQuery: seedKeyQuery,
        url: searchUrl,
        filter: [{ field: valueFrom, operator: "eq", value: selectedValue, type: "AND" }],
        pagination: { limit: 1, offset: 0 },
        enabled: needsSeedFetch,
    });

    const seedOption = useMemo(() => {
        if (seedFromInitial) return seedFromInitial;
        const row = seedQuery.data?.data?.[0];
        return row ? mapRawItemsToOptions([row], { valueFrom, labelFrom })[0] : null;
    }, [seedFromInitial, seedQuery.data, valueFrom, labelFrom]);

    const options = useMemo(() => {
        if (isLocal) {
            let localOptions = mapRawItemsToOptions(dataOptions, { valueFrom, labelFrom });
            if (enableAlphabeticalOrder) localOptions = sortOptionsAlphabetically(localOptions);
            if (enableSearch) localOptions = filterOptionsByLabel(localOptions, normalizedSearchTerm);
            const seedForList = shouldIncludeSeedInOptions(seedFromInitial, normalizedSearchTerm)
                ? seedFromInitial
                : null;
            return mergeSeedIntoOptions(localOptions, seedForList);
        }
        const seedForList = shouldIncludeSeedInOptions(seedOption, normalizedSearchTerm) ? seedOption : null;
        return mergeSeedIntoOptions(accumulated, seedForList);
    }, [
        isLocal,
        dataOptions,
        valueFrom,
        labelFrom,
        enableAlphabeticalOrder,
        enableSearch,
        normalizedSearchTerm,
        seedFromInitial,
        accumulated,
        seedOption,
    ]);

    const lastPageCount = Array.isArray(listQuery.data?.data) ? listQuery.data.data.length : 0;
    const total = typeof listQuery.data?.total === "number" ? listQuery.data.total : null;
    const hasNextPage =
        enableInfiniteScroll &&
        computeHasNextPage({
            accumulatedCount: accumulated.length,
            pageSize: queryLimit,
            total,
            lastPageCount,
        });

    const fetchNextPage = useCallback(() => {
        if (!hasNextPage || listQuery.isFetching) return;
        setPage((previous) => previous + 1);
    }, [hasNextPage, listQuery.isFetching]);

    const updateSearchTerm = useCallback(
        (nextSearchTerm) => {
            const normalizedNextSearchTerm = (nextSearchTerm ?? "").trim();
            if (normalizedNextSearchTerm === normalizedSearchTerm) return;
            setPage(0);
            setAccumulated((previous) => (previous.length === 0 ? previous : []));
            setSearchTerm(nextSearchTerm);
        },
        [normalizedSearchTerm],
    );

    return {
        options,
        isLoading: !isLocal && listQuery.isLoading && page === 0,
        isFetchingNextPage: !isLocal && listQuery.isFetching && page > 0,
        hasNextPage,
        fetchNextPage,
        setSearchTerm: updateSearchTerm,
    };
};

export default useSelectByProviderQuery;
