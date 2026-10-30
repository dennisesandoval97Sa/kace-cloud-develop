import useGenericSearchQuery from "@/hooks/useGenericSearchQuery";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { useMemo } from "react";
import { INTERACTION_TYPE_FILTERS } from "../interactionTypeFilters";
import { createSystemInboxInteractionExclusionFilter } from "@/utils/systemInboxWorkspace";

export const DEFAULT_INTERACTIONS_PAGE_SIZE = 25;

const getTotalRecords = (data, fallback) => {
    const totalCandidate = data?.total ?? data?.metadata?.count ?? data?.count;
    return Number.isFinite(Number(totalCandidate)) ? Number(totalCandidate) : fallback;
};

export const useInteractions = ({
    selectedWorkspace,
    allWorkspaces,
    selectedType,
    myReviewsOnly,
    currentUserId,
    activeGroupId,
    scopeReady = true,
    searchTerm,
    page = 1,
    pageSize = DEFAULT_INTERACTIONS_PAGE_SIZE,
}) => {
    const filters = useMemo(() => {
        const result = [];

        if (selectedWorkspace && !allWorkspaces) {
            result.push({
                field: "workspace_id",
                operator: "eq",
                value: selectedWorkspace.toString(),
                type: "AND",
            });
        }

        if (myReviewsOnly) {
            result.push({
                field: "in_review",
                operator: "eq",
                value: "true",
                type: "AND",
            });

            result.push({
                field: "is_closed",
                operator: "eq",
                value: "false",
                type: "AND",
            });

            if (currentUserId) {
                result.push({
                    field: "start_review_by",
                    operator: "eq",
                    value: currentUserId.toString(),
                    type: "AND",
                });
            }
        } else if (selectedType && selectedType !== INTERACTION_TYPE_FILTERS.ALL) {
            if (selectedType === INTERACTION_TYPE_FILTERS.CLOSED) {
                result.push({
                    field: "is_closed",
                    operator: "eq",
                    value: "true",
                    type: "AND",
                });
            }

            if (selectedType === INTERACTION_TYPE_FILTERS.OPEN) {
                result.push({
                    field: "in_review",
                    operator: "eq",
                    value: "false",
                    type: "AND",
                });

                result.push({
                    field: "is_closed",
                    operator: "eq",
                    value: "false",
                    type: "AND",
                });
            }
        }

        if (searchTerm?.trim()) {
            result.push({
                groupType: "AND",
                filters: [
                    {
                        field: "description",
                        operator: "ilike",
                        value: searchTerm.trim(),
                        type: "OR",
                    },
                    {
                        field: "client_identifier",
                        operator: "ilike",
                        value: searchTerm.trim(),
                        type: "OR",
                    },
                ],
            });
        }

        result.push(createSystemInboxInteractionExclusionFilter());

        return result;
    }, [selectedWorkspace, allWorkspaces, selectedType, myReviewsOnly, currentUserId, searchTerm]);

    const pagination = useMemo(
        () => ({
            limit: pageSize,
            offset: Math.max(page - 1, 0) * pageSize,
        }),
        [page, pageSize],
    );

    return useGenericSearchQuery({
        url: URL_AND_KEYS.interactions.agent.search,
        keyQuery: [
            "agent-interactions",
            activeGroupId,
            selectedWorkspace,
            allWorkspaces,
            selectedType,
            myReviewsOnly,
            currentUserId,
            searchTerm,
            page,
            pageSize,
        ],
        select: (data) => {
            const interactions = Array.isArray(data?.data) ? data.data : [];
            return {
                interactions,
                totalRecords: getTotalRecords(data, interactions.length),
            };
        },
        filter: filters,
        pagination,
        enabled:
            Boolean(currentUserId && activeGroupId && scopeReady) &&
            (!!selectedWorkspace || allWorkspaces) &&
            (!myReviewsOnly || Boolean(currentUserId)),
    });
};
