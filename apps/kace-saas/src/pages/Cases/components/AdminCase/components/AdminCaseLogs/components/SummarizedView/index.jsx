import React, { useCallback, useEffect, useMemo, useState } from "react";
import FilterBuilder from "./Components/FilterBuilder";
import ActivityJournal from "./Components/ActivityJournal";
import { useInfiniteQuery } from "@tanstack/react-query";
import PropTypes from "prop-types";
import { GeneralLoader } from "@/components/ui-shared";
import { genericSearchService } from "@/services/genericSearchService";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { getCaseCode } from "@/utils/caseCode";
import { useTranslation } from "react-i18next";
import { resolveConfiguredEventTypes, typeOptions } from "./constants";

const normalizeCaseIds = (value) => {
    if (value === undefined || value === null || value === "") {
        return [];
    }

    return String(value)
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
};

const SummarizedView = ({ caseId, casesData, allowedEventTypes }) => {
    const { t } = useTranslation();

    const configuredEvents = useMemo(() => resolveConfiguredEventTypes(allowedEventTypes), [allowedEventTypes]);

    const allowedEventsOptions = useMemo(() => {
        if (configuredEvents.length > 0) {
            return typeOptions.filter((opt) => configuredEvents.includes(opt.id));
        }
        return typeOptions;
    }, [configuredEvents]);

    const [activeFilters, setActiveFilters] = useState(() => {
        const initial = [
            {
                field: "case_id",
                value: caseId,
                type: "AND",
                operator: "in",
            },
        ];
        if (configuredEvents.length > 0) {
            initial.push({
                field: "event_name",
                value: configuredEvents.join(","),
                type: "AND",
                operator: "in",
            });
        }
        return initial;
    });

    const {
        data: subcasesData,
        isLoading: isLoadingSubcases,
        isFetchingNextPage: isLoadingMoreSubcases,
        hasNextPage: hasMoreSubcases,
        fetchNextPage: fetchNextSubcasesPage,
    } = useInfiniteQuery({
        queryKey: ["subcases-for-logs", caseId],
        queryFn: ({ pageParam = 0 }) =>
            genericSearchService(
                `${URL_AND_KEYS.cases.url}/${caseId}/sub-cases/search`,
                [],
                { limit: 200, offset: pageParam },
                null,
                false,
                null,
                { field: "created_at", direction: "DESC" },
                null,
            ),
        enabled: Boolean(caseId),
        gcTime: 10 * 60 * 1000,
        staleTime: 5 * 60 * 1000,
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) => {
            if (!lastPage.data || lastPage.data.length === 0) {
                return undefined;
            }
            const currentItems = allPages.flatMap((page) => page.data).length;
            const totalItems = lastPage.total;

            if (currentItems < totalItems) {
                return allPages.length * 200;
            }

            return undefined;
        },
        refetchOnWindowFocus: false,
    });

    const subcases = subcasesData?.pages?.flatMap((page) => page.data) || [];

    const mainCaseReference = casesData?.reference;
    const mainCaseCode = getCaseCode(casesData);
    const mainCaseLabel =
        mainCaseReference && mainCaseCode
            ? `${mainCaseReference} - ${mainCaseCode}`
            : mainCaseReference || mainCaseCode || caseId || t("event_logs.mainCase");

    const caseEntityOptions = useMemo(
        () => [
            { id: caseId, label: mainCaseLabel },
            ...subcases.map((subcase) => {
                const reference = subcase?.reference || subcase?.case_reference;
                const code = getCaseCode(subcase);
                const label =
                    reference && code
                        ? `${reference} - ${code}`
                        : reference || code || subcase?.id || t("event_logs.subcase");
                return { id: subcase.id, label };
            }),
        ],
        [caseId, subcases, t, mainCaseLabel],
    );

    const defaultEntityValues = useMemo(() => [{ id: caseId, label: mainCaseLabel }], [caseId, mainCaseLabel]);

    const logsUrl = URL_AND_KEYS.eventLogs.searchUrl;
    const selectedCaseFilter = activeFilters.find((filter) => filter.field === "case_id");
    const selectedCaseIds = normalizeCaseIds(selectedCaseFilter?.value);
    const showCaseBadge = selectedCaseIds.length > 1;
    const caseLabelById = caseEntityOptions.reduce((acc, item) => {
        acc[item.id] = item.label;
        return acc;
    }, {});
    const caseBadgeLabelById = {
        ...caseLabelById,
        [caseId]: t("event_logs.mainCase"),
    };

    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
        queryKey: ["logs", caseId, logsUrl, activeFilters],
        queryFn: ({ pageParam = 0 }) =>
            genericSearchService(
                logsUrl,
                activeFilters,
                { limit: 50, offset: pageParam },
                "logs",
                false,
                null,
                { field: "occurred_at", direction: "DESC" },
                null,
            ),
        getNextPageParam: (lastPage, allPages) => {
            if (!lastPage.data || lastPage.data.length === 0) {
                return undefined;
            }
            const currentItems = allPages.flatMap((page) => page.data).length;
            const totalItems = lastPage.total;
            if (currentItems < totalItems) {
                return allPages.length * 50;
            }
            return undefined;
        },
        gcTime: 0,
        staleTime: 0,
        initialPageParam: 0,
        enabled: Boolean(caseId),
        refetchOnWindowFocus: false,
    });

    useEffect(() => {
        const newFilters = [
            {
                field: "case_id",
                value: caseId,
                type: "AND",
                operator: "in",
            },
        ];
        if (configuredEvents.length > 0) {
            newFilters.push({
                field: "event_name",
                value: configuredEvents.join(","),
                type: "AND",
                operator: "in",
            });
        }
        setActiveFilters(newFilters);
    }, [caseId, configuredEvents]);

    const handleSearch = useCallback(
        (newFilters) => {
            const hasEventNameFilter = newFilters.some((f) => f.field === "event_name");
            if (!hasEventNameFilter && configuredEvents.length > 0) {
                setActiveFilters([
                    ...newFilters,
                    {
                        field: "event_name",
                        value: configuredEvents.join(","),
                        type: "AND",
                        operator: "in",
                    },
                ]);
            } else {
                setActiveFilters(newFilters);
            }
        },
        [configuredEvents],
    );

    const events = data?.pages?.flatMap((page) => page.data) || [];

    return (
        <>
            <FilterBuilder
                onSearch={handleSearch}
                entitiesOptions={caseEntityOptions}
                defaultEntityValues={defaultEntityValues}
                isLoadingEntities={isLoadingSubcases}
                isLoadingMoreEntities={isLoadingMoreSubcases}
                hasMoreEntities={hasMoreSubcases}
                onLoadMoreEntities={fetchNextSubcasesPage}
                allowedEvents={allowedEventsOptions}
            />
            <hr className="my-4" />
            {isLoading ? (
                <GeneralLoader />
            ) : (
                <ActivityJournal
                    events={events}
                    showCaseBadge={showCaseBadge}
                    caseLabelById={caseBadgeLabelById}
                    mainCaseId={caseId}
                    onLoadMore={fetchNextPage}
                    hasMore={hasNextPage}
                    isFetching={isFetchingNextPage}
                />
            )}
        </>
    );
};

SummarizedView.propTypes = {
    caseId: PropTypes.string,
    casesData: PropTypes.object,
    allowedEventTypes: PropTypes.array,
};

export default SummarizedView;
