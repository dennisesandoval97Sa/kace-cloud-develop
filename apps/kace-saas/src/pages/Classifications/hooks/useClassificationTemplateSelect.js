import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import useGenericSearchQuery from "@/hooks/useGenericSearchQuery";
import { TEMPLATES_SERVICE } from "@kace/utils";
import {
    areAllMatchingSelected,
    buildTemplateSearchFilters,
    clearMatchingFromSelection,
    fetchAllMatchingTemplates,
    mergeSelectedWithMatching,
    TEMPLATES_ALPHABETICAL_ORDER,
    toTemplateOption,
    uniqueById,
} from "../helpers/fetchAllMatchingTemplates";

const DEFAULT_PAGE_SIZE = 20;

const processSearchResult = (data) => {
    const rows = Array.isArray(data?.data) ? data.data : [];
    const parsedTotal = Number(data?.total);
    const fallbackTotal = Number(
        typeof data?.metadata?.count === "object" ? data.metadata.count?.count : data?.metadata?.count,
    );

    return {
        rows,
        total: Number.isFinite(parsedTotal) ? parsedTotal : Number.isFinite(fallbackTotal) ? fallbackTotal : null,
    };
};

export const useClassificationTemplateSelect = ({ pageSize = DEFAULT_PAGE_SIZE } = {}) => {
    const { t } = useTranslation();
    const [currentPage, setCurrentPage] = useState(1);
    const [searchFilter, setSearchFilter] = useState("");
    const [browseItems, setBrowseItems] = useState([]);
    const [searchItems, setSearchItems] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isSelectingAll, setIsSelectingAll] = useState(false);

    const filters = useMemo(() => buildTemplateSearchFilters(searchFilter), [searchFilter]);

    const pagination = useMemo(
        () => ({
            limit: pageSize,
            offset: (currentPage - 1) * pageSize,
        }),
        [currentPage, pageSize],
    );

    const { data: searchResult, isFetching } = useGenericSearchQuery({
        url: `${TEMPLATES_SERVICE}/search`,
        keyQuery: "classificationTemplateSelect",
        filter: filters,
        pagination,
        order: TEMPLATES_ALPHABETICAL_ORDER,
        select: processSearchResult,
        enabled: isOpen,
        staleTime: 0,
        gcTime: 0,
    });

    useEffect(() => {
        if (!searchResult || isFetching) return;

        const mapped = (searchResult.rows ?? []).map(toTemplateOption);

        if (searchFilter.trim()) {
            if (currentPage === 1) {
                setSearchItems(mapped);
            } else {
                setSearchItems((previousItems) => uniqueById([...previousItems, ...mapped]));
            }
            return;
        }

        setSearchItems([]);
        if (currentPage === 1) {
            setBrowseItems(mapped);
        } else {
            setBrowseItems((previousItems) => uniqueById([...previousItems, ...mapped]));
        }
    }, [currentPage, isFetching, searchFilter, searchResult]);

    const setSearchQuery = useCallback((payload = {}) => {
        const nextFilter = payload.filter ?? "";

        setSearchFilter((previousFilter) => {
            if (previousFilter === nextFilter) return previousFilter;
            setCurrentPage(1);
            return nextFilter;
        });
    }, []);

    const setPage = useCallback((page) => {
        setCurrentPage((previousPage) =>
            Number.isFinite(page) && page > previousPage ? previousPage + 1 : previousPage,
        );
    }, []);

    const onOpenChange = useCallback((nextOpen) => {
        setIsOpen(nextOpen);

        if (!nextOpen) {
            setSearchFilter("");
            setCurrentPage(1);
        }
    }, []);

    const selectAllMatchingOrClear = useCallback(
        async (listValues = [], setListValues = () => null) => {
            if (isSelectingAll) {
                return;
            }

            setIsSelectingAll(true);
            try {
                const matchingTemplates = await fetchAllMatchingTemplates({ searchFilter });
                if (areAllMatchingSelected(listValues, matchingTemplates)) {
                    setListValues((previous) =>
                        clearMatchingFromSelection(Array.isArray(previous) ? previous : listValues, matchingTemplates),
                    );
                    return;
                }
                setListValues((previous) =>
                    mergeSelectedWithMatching(Array.isArray(previous) ? previous : listValues, matchingTemplates),
                );
            } catch {
                toast.error(t("app.alerts.error"));
            } finally {
                setIsSelectingAll(false);
            }
        },
        [isSelectingAll, searchFilter, t],
    );

    const data = useMemo(() => uniqueById([...browseItems, ...searchItems]), [browseItems, searchItems]);

    const currentRowsLength = searchResult?.rows?.length ?? 0;
    const totalRows = searchResult?.total;
    const hasMore =
        totalRows !== null && totalRows !== undefined
            ? currentPage * pageSize < totalRows
            : currentRowsLength === pageSize;

    return {
        data,
        isLoading: (isOpen && isFetching && currentPage === 1 && data.length === 0) || isSelectingAll,
        isLoadingMore: isFetching && currentPage > 1,
        hasMore,
        searchQuery: { input: searchFilter, filter: searchFilter },
        setSearchQuery,
        setPage,
        followInput: false,
        hideSearchButton: true,
        open: isOpen,
        onOpenChange,
        selectAllMatchingOrClear,
    };
};
