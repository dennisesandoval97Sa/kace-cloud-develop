import useGenericViewQuery from "@kace/hooks/useGenericViewQuery";
import { useMemo } from "react";
import { URL_AND_KEYS } from "../../../../../../../utils/urlAndKeys";
import useAdminCaseCacheData from "../../../hooks/useAdminCaseCacheData";

const useAdminCaseClassificationSelectObject = () => {
    const { caseCacheData } = useAdminCaseCacheData();

    const classificationId = useMemo(
        () => caseCacheData?.clasificacion_id || null,
        [caseCacheData?.clasificacion_id],
    );

    const { data: classificationById, isLoading: isLoadingClassificationById } =
        useGenericViewQuery({
            keyQuery: URL_AND_KEYS.classification.byClassificationId,
            searchById: URL_AND_KEYS.cases.keyAdminCase,
            url: `${URL_AND_KEYS.classification.url}/${classificationId}`,
            enabled: !!classificationId,
            staleTime: 0,
            gcTime: 0,
        });

    const classificationSelectObject = useMemo(() => {
        if (!classificationId || !classificationById) return null;
        return Object.entries(classificationById)
            .filter(([key]) => key.startsWith("nivel"))
            .reduce((acc, [key, value]) => {
                acc[key] = value;
                return acc;
            }, {});
    }, [classificationId, classificationById]);

    return {
        classificationSelectObject,
        IsLoadingClassificationSelectObject: isLoadingClassificationById,
    };
};

export default useAdminCaseClassificationSelectObject;
