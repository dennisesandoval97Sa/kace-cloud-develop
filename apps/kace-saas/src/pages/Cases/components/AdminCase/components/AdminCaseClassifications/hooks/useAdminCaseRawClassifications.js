import useGenericSearchQuery from "@/hooks/useGenericSearchQuery";
import useGenericViewQuery from "@/hooks/useGenericViewQuery";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { useMemo } from "react";

const useAdminCaseRawClassifications = ({ groupId, classification_parent_id = null }) => {
    const filter = useMemo(() => {
        const defaultFilter = [
            {
                field: "classification_group_relationships.group_id",
                operator: "eq",
                value: groupId,
                type: "AND",
            },
            {
                field: "clasificaciones.can_start_sub_cases_flow",
                operator: "eq",
                value: "true",
                type: "AND",
            },
            {
                field: "clasificaciones.is_active",
                operator: "eq",
                value: 1,
                type: "AND",
            },
            {
                field: "clasificaciones.deleted_by",
                value: "null",
                type: "AND",
                operator: "null",
            },
        ];

        return defaultFilter;
    }, [classification_parent_id]);

    const relationship = useMemo(() => {
        const defaultRelationship = [
            {
                table: "classification_group_relationships",
                condition: {
                    column: "clasificaciones.id",
                    refColumn: "classification_group_relationships.classification_id",
                },
                type: "join",
            },
        ];

        return defaultRelationship;
    }, [classification_parent_id]);

    const enabled = useMemo(
        () => !classification_parent_id && Boolean(groupId) && Boolean(filter.length) && Boolean(relationship.length),
        [groupId, filter, relationship],
    );

    const { data: rawData = [], isFetching: isLoadingRawData } = useGenericSearchQuery({
        url: `${URL_AND_KEYS.classification.url}/search`,
        keyQuery: URL_AND_KEYS.classification.keySchema,
        searchById: [URL_AND_KEYS.cases.keyAdminCase, groupId],
        select: (res) => res.data || [],
        filter,
        relationship,
        pagination: { limit: 0, offset: 0 },
        useDefault: false,
        enabled,
        gcTime: 5 * 60 * 1000,
        staleTime: 0,
    });

    const { data: subClassificationsData = [], isLoading: isLoadingSubClassificationsData } = useGenericViewQuery({
        url: `${URL_AND_KEYS.classification.url}/${classification_parent_id}`,
        keyQuery: [URL_AND_KEYS.classification.keySchema, classification_parent_id],
        enabled: Boolean(classification_parent_id)
    });

    const classificationsData = useMemo(() => {
        return (classification_parent_id ? subClassificationsData.relations : rawData) || [];
    }, [classification_parent_id, rawData, subClassificationsData]);

    return { rawData: classificationsData, isLoadingRawData: isLoadingRawData || isLoadingSubClassificationsData };
};

export default useAdminCaseRawClassifications;
