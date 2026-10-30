import useGeneralMutation from "@kace/hooks/useGeneralMutation";
import { Uuid } from "@kace/plugins";
import useGenericViewQuery from "../../../../../../../hooks/useGenericViewQuery";
import { URL_AND_KEYS } from "../../../../../../../utils/urlAndKeys";

export const useCloneCase = ({ caseId }) => {
    const { data: dataCase } = useGenericViewQuery({
        keyQuery: URL_AND_KEYS.cases.caseByClone,
        url: `${URL_AND_KEYS.cases.url}/${caseId}`,
        searchById: caseId,
        enabled: !!caseId,
        staleTime: 0,
        gctime: 0,
        options: {
            select: (data) => data,
        },
    });

    const { mutate, isPending } = useGeneralMutation({
        keyQuery: URL_AND_KEYS.cases.key,
        openModal: true,
    });

    const handleCloneCase = (values) => {
        if (!dataCase) return;

        const dataPost = {
            id: Uuid(),
            comment: {
                id: Uuid(),
                caso_id: caseId,
                descripcion: values.description,
                calificacion: 5,
            },
            transicion_id: values.stateId,
            grupo_id: dataCase.grupo_id,
            responsable_id: dataCase.responsable_id,
        };

        mutate({
            url: `${URL_AND_KEYS.cases.urlCaseClone}/${caseId}`,
            dataPost,
        });
    };

    return {
        handleCloneCase,
        isPending,
    };
};
