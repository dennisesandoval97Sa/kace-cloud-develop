import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useGenericSearchQuery from "@/hooks/useGenericSearchQuery";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { processUsersData } from "../utils/processData";
import useDebounced from "@/hooks/useDebounced";
import useGenericSearchInfiniteQuery from "@/hooks/useGenericSearchInfiniteQuery";

const useMultiSelectUsers = (initialUsersData = [], setUsersData = () => {}) => {
    const [selectedUsersData, setSelectedUsersData] = useState([]);
    const [searchByNameBody, setSearchByNameBody] = useState(null);
    const [usersFilters, setUsersFilters] = useState([]);
    const isFirstFetchInitialUsersData = useRef(false);

    const {
        data: inifiniteUsersData,
        isLoading: inifiniteUsersDataIsLoading,
        isFetchingNextPage: inifiniteUsersDataIsFetchingNextPage,
        hasNextPage: inifiniteUsersDatahasNextPage,
        fetchNextPage,
    } = useGenericSearchInfiniteQuery({
        url: `${URL_AND_KEYS.users.url}/search`,
        keyQuery: ["infinite-scroll", URL_AND_KEYS.users.key],
        select: processUsersData,
    });

    const { data: searchUsersData, isLoading: searchUsersDataIsLoading } = useGenericSearchQuery({
        url: `${URL_AND_KEYS.users.url}/searchByName`,
        keyQuery: ["searchByName", URL_AND_KEYS.users.key],
        filter: usersFilters,
        body: searchByNameBody,
        enabled: Boolean(searchByNameBody),
        select: processUsersData,
    });

    const { data: searchInitialUsersData, isLoading: searchInitialUsersDataIsLoading } = useGenericSearchQuery({
        url: `${URL_AND_KEYS.users.url}/search`,
        keyQuery: ["initial-data", URL_AND_KEYS.users.key],
        filter: [
            {
                field: "id",
                operator: "in",
                value: initialUsersData?.map((user) => user).join(", "),
                type: "OR",
            },
        ],
        enabled: Boolean(initialUsersData.length) && !isFirstFetchInitialUsersData.current,
        select: processUsersData,
    });

    const usersData = useMemo(
        () => (searchByNameBody ? searchUsersData : inifiniteUsersData),
        [searchByNameBody, searchUsersData, inifiniteUsersData],
    );

    const usersDataIsLoading = useMemo(
        () => searchUsersDataIsLoading || inifiniteUsersDataIsLoading || searchInitialUsersDataIsLoading,
        [searchUsersDataIsLoading, inifiniteUsersDataIsLoading, searchInitialUsersDataIsLoading],
    );

    const canFetchNextUsersPage = inifiniteUsersDatahasNextPage && !inifiniteUsersDataIsFetchingNextPage;

    const debouncedOnFetch = useDebounced(() => {
        if (canFetchNextUsersPage) {
            fetchNextPage();
        }
    }, 600);

    // MultiSelect re-checks its scroll sentinel only when this identity changes, so renew it as each page settles.
    const fetchNextUsersPage = useCallback(() => {
        if (canFetchNextUsersPage) {
            debouncedOnFetch();
        }
    }, [debouncedOnFetch, canFetchNextUsersPage]);

    const onInputChange = useDebounced((name) => {
        if (name) {
            setSearchByNameBody({ name });
            setUsersFilters([
                {
                    field: "nombres",
                    operator: "eq",
                    type: "AND",
                    value: name,
                },
            ]);
            return;
        }
        setSearchByNameBody(null);
        setUsersFilters([
            {
                field: "deleted_at",
                operator: "null",
                type: "AND",
                value: "null",
            },
        ]);
    }, 600);

    const onSelectUser = useCallback(
        (userId) => {
            let newSelectedUserData = [];
            const isSelected = selectedUsersData.some((option) => option.id === userId);

            if (isSelected) {
                newSelectedUserData = selectedUsersData.filter((option) => option.id !== userId);
            } else {
                newSelectedUserData = [...selectedUsersData, usersData.find((option) => option.id === userId)];
            }

            setSelectedUsersData(newSelectedUserData);
            setUsersData(newSelectedUserData);
        },
        [usersData, selectedUsersData, setSelectedUsersData],
    );

    const onSelectedAllUsers = useCallback(() => {
        const selectionMap = new Map(selectedUsersData.map((user) => [user.id, user]));
        usersData.forEach((user) => selectionMap.set(user.id, user));
        const newSelectedUserData = Array.from(selectionMap.values());

        setSelectedUsersData(newSelectedUserData);
        setUsersData(newSelectedUserData);
    }, [usersData, selectedUsersData, setSelectedUsersData]);

    const onDeselectAllUsers = useCallback(() => {
        setSelectedUsersData([]);
        setUsersData([]);
    }, [setUsersData]);

    useEffect(() => {
        if (searchInitialUsersData && !isFirstFetchInitialUsersData.current) {
            setSelectedUsersData(searchInitialUsersData);
            isFirstFetchInitialUsersData.current = true;
        }
    }, [searchInitialUsersData, isFirstFetchInitialUsersData.current]);

    return {
        usersData,
        selectedUsersData,
        usersDataIsLoading,
        inifiniteUsersDataIsFetchingNextPage,
        onInputChange,
        onSelectUser,
        onSelectedAllUsers,
        onDeselectAllUsers,
        fetchNextUsersPage,
    };
};

export default useMultiSelectUsers;
