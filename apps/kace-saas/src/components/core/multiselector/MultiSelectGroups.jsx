import { MultiSelect } from "@kace/ui-shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { PropTypes } from "prop-types";
import { useTranslation } from "react-i18next";
import useGenericSearchInfiniteQuery from "../../../hooks/useGenericSearchInfiniteQuery";
import useGenericSearchQuery from "../../../hooks/useGenericSearchQuery";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";

const GROUPS_PAGE_SIZE = 50;
const GROUPS_SEARCH_CACHE_TIME = 5 * 60 * 1000;
const EMPTY_VALUES = [];

const toGroupOption = (group, { nameOnly = false } = {}) => {
    const label = group.nombre ?? group.label;
    return {
        id: group.id,
        label,
        value: nameOnly ? label : (group.value ?? [label, group.descripcion].filter(Boolean).join(" ")),
        isActive: group.isActive ?? (group.status == null ? undefined : Number(group.status) === 1),
    };
};

export const MultiSelectGroups = ({
    enableInfiniteScroll = false,
    listValues,
    setListValues,
    values = EMPTY_VALUES,
}) => {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState({ input: "", filter: "" });
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    const [sessionLeadingGroups, setSessionLeadingGroups] = useState([]);
    const initializedValuesKeyRef = useRef(null);
    const assignedValuesKey = useMemo(
        () => JSON.stringify(values.map((value) => [value?.id, value?.label, value?.value])),
        [values],
    );
    const assignedGroupIds = useMemo(() => values.map((value) => value?.id).filter(Boolean), [values]);
    const assignedGroupIdsFilter = assignedGroupIds.join(", ");
    const needsAssignedGroupsLookup =
        assignedGroupIds.length > 0 &&
        values.some((value) => !value?.label || (value?.isActive == null && value?.status == null));
    const activeGroupsFilter = useMemo(() => {
        const filters = [{ field: "status", operator: "eq", value: 1, type: "AND" }];
        const searchTerm = searchQuery.filter?.trim();
        if (searchTerm) {
            filters.push({
                field: "nombre",
                operator: "ilike",
                value: searchTerm,
                type: "AND",
            });
        }
        return filters;
    }, [searchQuery.filter]);

    const {
        data: groupsPages,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading: isLoadingTable,
    } = useGenericSearchInfiniteQuery({
        url: `${URL_AND_KEYS.groups.url}/search`,
        keyQuery: URL_AND_KEYS.groups.key,
        filter: activeGroupsFilter,
        pageSize: GROUPS_PAGE_SIZE,
        gcTime: GROUPS_SEARCH_CACHE_TIME,
        enabled: enableInfiniteScroll,
    });

    const { data: legacyGroupsData, isLoading: isLoadingLegacyGroups } = useGenericSearchQuery({
        url: `${URL_AND_KEYS.groups.url}/search`,
        keyQuery: URL_AND_KEYS.groups.key,
        filter: [{ field: "status", operator: "eq", value: 1, type: "AND" }],
        pagination: {
            offset: 0,
            limit: 1000,
        },
        enabled: !enableInfiniteScroll,
    });

    const { data: assignedGroupsData, isLoading: isLoadingAssignedGroups } = useGenericSearchQuery({
        url: `${URL_AND_KEYS.groups.url}/search`,
        keyQuery: [URL_AND_KEYS.groups.key, "assigned"],
        searchById: assignedGroupIdsFilter,
        filter: [
            {
                field: "id",
                operator: "in",
                value: assignedGroupIdsFilter,
                type: "AND",
            },
        ],
        pagination: {
            offset: 0,
            limit: assignedGroupIds.length,
        },
        enabled: enableInfiniteScroll && needsAssignedGroupsLookup,
    });

    const groupRows = useMemo(
        () =>
            enableInfiniteScroll
                ? (groupsPages?.pages?.flatMap((page) => page?.data ?? []) ?? [])
                : (legacyGroupsData?.data ?? []),
        [enableInfiniteScroll, groupsPages, legacyGroupsData],
    );
    const dataGroups = useMemo(
        () => groupRows.map((group) => toGroupOption(group, { nameOnly: enableInfiniteScroll })),
        [enableInfiniteScroll, groupRows],
    );
    const selectableGroups = useMemo(() => {
        if (!enableInfiniteScroll) {
            return dataGroups;
        }
        const selectedGroupIds = new Set(listValues.map((group) => group.id));
        const leadingGroups = isSelectorOpen
            ? sessionLeadingGroups
            : listValues.map((group) => toGroupOption(group, { nameOnly: true }));
        const retainedLeadingGroups = leadingGroups.filter(
            (group) => selectedGroupIds.has(group.id) || group.isActive === true,
        );
        const leadingGroupIds = new Set(retainedLeadingGroups.map((group) => group.id));
        return [...retainedLeadingGroups, ...dataGroups.filter((group) => !leadingGroupIds.has(group.id))];
    }, [dataGroups, enableInfiniteScroll, isSelectorOpen, listValues, sessionLeadingGroups]);

    const handleSelectorOpenChange = (open) => {
        if (open) {
            setSessionLeadingGroups(listValues.map((group) => toGroupOption(group, { nameOnly: true })));
        }
        setIsSelectorOpen(open);
    };

    useEffect(() => {
        if (initializedValuesKeyRef.current === assignedValuesKey) {
            return;
        }
        if (assignedGroupIds.length === 0) {
            setListValues([]);
            initializedValuesKeyRef.current = assignedValuesKey;
            return;
        }
        if (enableInfiniteScroll && needsAssignedGroupsLookup && isLoadingAssignedGroups) {
            return;
        }
        if (!enableInfiniteScroll && isLoadingLegacyGroups) {
            return;
        }

        const fetchedAssignedGroups = enableInfiniteScroll ? (assignedGroupsData?.data ?? []) : [];
        const fetchedGroupsById = new Map([...groupRows, ...fetchedAssignedGroups].map((group) => [group.id, group]));
        const assignedGroups = values
            .map((value) => fetchedGroupsById.get(value.id) ?? value)
            .filter((group) => group?.id && (group?.nombre || group?.label))
            .map((group) => toGroupOption(group, { nameOnly: enableInfiniteScroll }));

        setListValues(assignedGroups);
        initializedValuesKeyRef.current = assignedValuesKey;
    }, [
        assignedGroupIds,
        assignedGroupsData,
        assignedValuesKey,
        enableInfiniteScroll,
        groupRows,
        isLoadingAssignedGroups,
        isLoadingLegacyGroups,
        needsAssignedGroupsLookup,
        setListValues,
        values,
    ]);

    const infiniteScrollProps = {};
    if (enableInfiniteScroll) {
        Object.assign(infiniteScrollProps, {
            isLoadingMore: isFetchingNextPage,
            hasMore: Boolean(hasNextPage),
            setPage: () => fetchNextPage(),
            searchQuery,
            setSearchQuery,
            hideSelectAll: true,
            hideSearchButton: true,
            open: isSelectorOpen,
            onOpenChange: handleSelectorOpenChange,
        });
    }

    return (
        <MultiSelect
            data={selectableGroups}
            textSearch={t("classification.form.textSearchGroups")}
            listValues={listValues}
            setListValues={setListValues}
            isLoading={
                enableInfiniteScroll
                    ? isLoadingTable || (needsAssignedGroupsLookup && isLoadingAssignedGroups)
                    : isLoadingLegacyGroups
            }
            nameTesting="groups"
            id="multi_select_groups"
            data-testid="multi_select_groups"
            {...infiniteScrollProps}
        />
    );
};

MultiSelectGroups.propTypes = {
    enableInfiniteScroll: PropTypes.bool,
    listValues: PropTypes.array,
    setListValues: PropTypes.func,
    values: PropTypes.array,
};
