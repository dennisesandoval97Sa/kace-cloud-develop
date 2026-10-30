import useGenericSearchQuery from "@/hooks/useGenericSearchQuery";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { useMemo } from "react";

const useAdminCaseCurrentClassifications = (classificationId) => {
    const enabled = useMemo(() => Boolean(classificationId), [classificationId]);

    const { data: rawCurrentData = [], isFetching: isLoadingRawCurrentData } = useGenericSearchQuery({
        url: `${URL_AND_KEYS.classification.url}/search`,
        keyQuery: URL_AND_KEYS.classification.keySchema,
        searchById: [URL_AND_KEYS.cases.keyAdminCase, classificationId],
        select: (res) => res.data || [],
        filter: [
            {
                field: "clasificaciones.id",
                operator: "eq",
                value: classificationId,
                type: "AND",
            },
            {
                field: "clasificaciones.deleted_by",
                value: "null",
                type: "AND",
                operator: "null",
            },
        ],
        pagination: { limit: 1, offset: 0 },
        useDefault: false,
        enabled,
    });
    return { rawCurrentData, isLoadingRawCurrentData };
};

export default useAdminCaseCurrentClassifications;
