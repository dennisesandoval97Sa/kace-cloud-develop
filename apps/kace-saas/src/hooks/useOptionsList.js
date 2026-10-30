import { useCallback, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import useAuxiliariesOptions from "./useAuxiliariesOptions";
import useGenericSearchInfiniteQuery from "./useGenericSearchInfiniteQuery";
import { genericSearchService } from "@/services/genericSearchService";
import { searchEntityByFields } from "./searchEntityByFields";
import { normalizeForSearch } from "@/utils/textNormalize";

/**
 * Multi-field search capability is delegated to `searchEntityByFields` (see
 * `apps/kace-saas/src/hooks/searchEntityByFields.js`) so the multi-field +
 * round-robin + Promise.allSettled logic lives in exactly one place. When
 * `searchFields` is empty/undefined, `useOptionsList` falls back to its
 * historical single-field `ilike` search against `labelField` (backward
 * compatible with every existing call site).
 */

/**
 * Expone las opciones de un select y su buscador. Tiene dos modos según `url`:
 *
 * - Con `url`: las opciones se paginan contra el backend y `onSearch` consulta
 *   `genericSearchService` con un filtro `ilike` sobre `labelField`.
 * - Sin `url` (lista auxiliar, que llega completa y sin paginación): `onSearch`
 *   filtra `options` en memoria, ignorando acentos y mayúsculas. Una query
 *   vacía devuelve la lista completa.
 */
const useOptionsList = ({
    url,
    queryKey = [],
    valueField,
    labelField,
    formatLabel = null,
    auxiliary,
    filter = [],
    pageSize = 0,
    initialId = "",
    useDefault = true,
    order = null,
    searchFields = null,
}) => {
    const { auxiliariesRules, loading: auxiliariesLoading } = useAuxiliariesOptions(false);

    const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useGenericSearchInfiniteQuery({
        keyQuery: [...queryKey],
        url,
        enabled: Boolean(url) && !auxiliary,
        staleTime: 0,
        gcTime: 0,
        filter,
        pageSize: pageSize || 10,
        useDefault,
        order,
    });

    const stableInitialIdRef = useRef(initialId || null);
    if (initialId) stableInitialIdRef.current = initialId;
    const stableInitialId = stableInitialIdRef.current;

    const { data: initialItemData } = useQuery({
        queryKey: [...queryKey, "initial-item", stableInitialId],
        queryFn: async () => {
            const result = await genericSearchService(
                url,
                [...filter, { field: valueField, operator: "eq", value: stableInitialId, type: "AND" }],
                { limit: 1, offset: 0 },
                null,
                useDefault,
                null,
                order,
            );
            return result.data?.[0] ?? null;
        },
        enabled: Boolean(stableInitialId) && Boolean(url) && !auxiliary,
        staleTime: Infinity,
        gcTime: 5 * 60 * 1000,
    });

    const getLabel = useCallback(
        (item) => (formatLabel ? formatLabel(item) : item[labelField]),
        [formatLabel, labelField],
    );

    const options = useMemo(() => {
        let baseOptions = [];

        if (auxiliary && auxiliariesRules && Array.isArray(auxiliariesRules)) {
            const auxiliaryData = auxiliariesRules.find((item) => item.dataOrigin === auxiliary);
            baseOptions = auxiliaryData?.options ?? [];
        } else if (data?.pages) {
            baseOptions = data.pages
                .flatMap((page) => page.data || [])
                .map((item) => ({
                    value: item[valueField],
                    label: getLabel(item),
                }))
                .filter((option) => option.value !== undefined);
        }

        if (initialItemData) {
            const seedOption = {
                value: initialItemData[valueField],
                label: getLabel(initialItemData),
            };
            const alreadyPresent = baseOptions.some((opt) => String(opt.value) === String(seedOption.value));
            if (seedOption.value && !alreadyPresent) {
                return [seedOption, ...baseOptions];
            }
        }

        return baseOptions;
    }, [data, auxiliariesRules, auxiliary, valueField, getLabel, initialItemData]);

    const hasMultiField = Array.isArray(searchFields) && searchFields.length > 0;

    const optionsRef = useRef(options);
    optionsRef.current = options;

    /**
     * Busca opciones. Sin `url` filtra la lista auxiliar en memoria (una query
     * vacía devuelve todas); con `url` delega en el backend y devuelve `[]` si
     * la petición falla.
     */
    const onSearch = useCallback(
        async (searchQuery) => {
            if (!url) {
                const query = normalizeForSearch(searchQuery);
                if (!query) return optionsRef.current;
                return optionsRef.current.filter((option) => normalizeForSearch(option.label).includes(query));
            }
            if (hasMultiField) {
                const { items } = await searchEntityByFields({
                    selectConfig: {
                        url,
                        searchFields,
                        labelField,
                        baseFilter: filter,
                    },
                    query: searchQuery,
                    pageSize: pageSize || 50,
                    search: (target, requestFilter, pagination) =>
                        genericSearchService(target, requestFilter, pagination, null, useDefault, null, order),
                });
                return items.map((item) => ({ value: item[valueField], label: getLabel(item) }));
            }
            try {
                const result = await genericSearchService(
                    url,
                    [...filter, { field: labelField, operator: "ilike", value: searchQuery, type: "AND" }],
                    { limit: pageSize || 50, offset: 0 },
                    null,
                    useDefault,
                    null,
                    order,
                );
                return (result.data || []).map((item) => ({
                    value: item[valueField],
                    label: getLabel(item),
                }));
            } catch {
                return [];
            }
        },
        [url, filter, labelField, valueField, pageSize, getLabel, useDefault, order, hasMultiField, searchFields],
    );

    return {
        options,
        isLoading: isLoading || auxiliariesLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        onSearch,
    };
};

export default useOptionsList;
