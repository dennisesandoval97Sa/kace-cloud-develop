import { useMemo } from "react";
import useGenericViewQuery from "@kace/hooks/useGenericViewQuery";
import { URL_AND_KEYS } from "../../../../../utils/urlAndKeys";

const useAdminCaseCase = (caseId) => {
    const { data, isLoading } = useGenericViewQuery({
        keyQuery: URL_AND_KEYS.cases.byCaseId,
        searchById: caseId,
        url: `${URL_AND_KEYS.cases.url}/${caseId}`,
        enabled: !!caseId,
    });

    const descriptionId = useMemo(
        () => data?.descripcion_caso_id,
        [data?.descripcion_caso_id],
    );

    const { data: descriptionCase } = useGenericViewQuery({
        keyQuery: URL_AND_KEYS.cases.searchDescriptionCaseById,
        searchById: URL_AND_KEYS.cases.keyAdminCase,
        url: `${URL_AND_KEYS.cases.urlDescription}/${descriptionId}`,
        enabled: !!descriptionId,
    });

    return {
        casesData: data,
        caseDataLoading: isLoading,
        descriptionCase: descriptionCase?.descripcion || "",
    };
};

export default useAdminCaseCase;
