import { MultiSelect } from "@kace/ui-shared";
import { useState, useEffect, useCallback, useRef } from "react";
import { PropTypes } from "prop-types";
import { useTranslation } from "react-i18next";
import useGenericSearchQuery from "../../../hooks/useGenericSearchQuery";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import useDebounced from "@/hooks/useDebounced";

const processData = (data) => {
    return data.data;
};

export const MultiSelectMailAccounts = ({ listValues, setListValues, values = [], enableSearch = false }) => {
    const { t } = useTranslation();
    const [dataMailAccounts, setDataMailAccounts] = useState([]);
    const [searchFilters, setSearchFilters] = useState([]);
    const [body, setBody] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [currentSearchQuery, setCurrentSearchQuery] = useState("");
    const [hasSearched, setHasSearched] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [initialData, setInitialData] = useState([]);
    const hasInitializedRef = useRef(false);

    const {
        data: dataMailAccountsList,
        isFetching,
        refetch,
        fetched,
    } = useGenericSearchQuery({
        url: `${URL_AND_KEYS.mail_accounts.url}/search`,
        keyQuery: URL_AND_KEYS.mail_accounts.key,
        select: processData,
        filter: searchFilters || [],
        body,
        enabled: false,
        page: currentPage,
        limit: 10,
    });

    const executeSearch = useCallback(
        (query) => {
            const trimmedQuery = query?.trim();

            if (trimmedQuery) {
                setHasSearched(true);
                setSearchFilters([
                    {
                        field: "description",
                        operator: "ilike",
                        value: trimmedQuery,
                        type: "AND",
                    },
                ]);
            } else {
                setBody({});
                setSearchFilters([]);
                setHasSearched(false);
                setIsSearching(false);
                setDataMailAccounts(initialData);
            }
            setCurrentPage(1);
        },
        [initialData],
    );

    const debouncedSearch = useDebounced(executeSearch, 500);

    useEffect(() => {
        if (isPopoverOpen || (!hasInitializedRef.current && !!values?.length && !!Object.keys(body ?? {}).length)) {
            refetch();
            hasInitializedRef.current = true;
        }
    }, [body, isPopoverOpen, refetch, values.length]);

    useEffect(() => {
        if (currentPage > 1) {
            refetch();
        }
    }, [currentPage, refetch]);

    const handleDataMailAccounts = useCallback(
        (data = [], isNewSearch = false, isInitialLoad = false) => {
            const newArray = data.map((item) => ({
                id: item.id,
                label: item.description,
                value: item.description,
            }));

            setDataMailAccounts((prevAccounts) => {
                if (isNewSearch) {
                    return newArray;
                } else if (currentPage === 1 && !isInitialLoad) {
                    return newArray;
                } else {
                    const existingIds = new Set(prevAccounts.map((account) => account.id));
                    const newAccounts = newArray.filter((account) => !existingIds.has(account.id));
                    return [...prevAccounts, ...newAccounts];
                }
            });

            if (isInitialLoad || (!hasSearched && currentPage === 1)) {
                setInitialData((prevInitial) => {
                    if (currentPage === 1 && !isNewSearch) {
                        return newArray;
                    } else {
                        const existingIds = new Set(prevInitial.map((account) => account.id));
                        const newAccounts = newArray.filter((account) => !existingIds.has(account.id));
                        return [...prevInitial, ...newAccounts];
                    }
                });
            }
        },
        [currentPage, hasSearched],
    );

    useEffect(() => {
        if (!!values?.length && listValues.length === 0) {
            const initialSelected = values
                .map((value) => {
                    const accountData = dataMailAccountsList?.find((account) => account.id === value.id);
                    return accountData?.id && accountData?.description
                        ? {
                              id: accountData.id,
                              label: accountData.description,
                              value: accountData.description,
                          }
                        : null;
                })
                .filter((account) => !!account);
            setListValues(initialSelected);
        }

        if (dataMailAccountsList && !isFetching) {
            const isNewSearch = currentPage === 1 && hasSearched;
            const isInitialLoad = !hasInitializedRef.current;
            handleDataMailAccounts(dataMailAccountsList, isNewSearch, isInitialLoad);
            setIsSearching(false);
        }
    }, [dataMailAccountsList, isFetching, handleDataMailAccounts, currentPage, hasSearched, fetched]);

    useEffect(() => {
        if (!!values?.length && listValues.length === 0) {
            setSearchFilters([
                {
                    field: "id",
                    operator: "in",
                    value: values?.map((account) => account?.id).join(", "),
                    type: "OR",
                },
            ]);
        }
    }, [values, listValues.length, setListValues]);

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
        [enableSearch, debouncedSearch, currentSearchQuery],
    );

    const handlePopoverChange = useCallback(
        (open) => {
            setIsPopoverOpen(open);
            if (!open) {
                setCurrentSearchQuery("");
                setBody({});
                setSearchFilters([]);
                setCurrentPage(1);
                setHasSearched(false);
                setIsSearching(false);
                setDataMailAccounts(initialData);
            }
        },
        [initialData],
    );

    const handlePageChange = useCallback((newPage) => {
        setCurrentPage(newPage);
    }, []);

    const displayMailAccounts = useCallback(() => {
        const currentDataIds = new Set(dataMailAccounts.map((item) => item.id));

        const missingSelected = listValues.filter((item) => !currentDataIds.has(item.id));

        if (hasSearched && isFetching && dataMailAccounts.length === 0) {
            return missingSelected;
        }

        return [...missingSelected, ...dataMailAccounts];
    }, [dataMailAccounts, listValues, hasSearched, isFetching]);

    return (
        <MultiSelect
            data={displayMailAccounts()}
            textSearch={t("mailAccounts.form.textSearchMailAccounts")}
            listValues={listValues}
            setListValues={setListValues}
            isLoading={isFetching || isSearching}
            nameTesting="mailAccounts"
            searchQuery={{ input: currentSearchQuery, filter: currentSearchQuery }}
            setSearchQuery={handleSearch}
            setPage={handlePageChange}
            followInput={true}
            open={isPopoverOpen}
            onOpenChange={handlePopoverChange}
        />
    );
};

MultiSelectMailAccounts.propTypes = {
    listValues: PropTypes.array,
    setListValues: PropTypes.func,
    values: PropTypes.array,
    enableSearch: PropTypes.bool,
};
