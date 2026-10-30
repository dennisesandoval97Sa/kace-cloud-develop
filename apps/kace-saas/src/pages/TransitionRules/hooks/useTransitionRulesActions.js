import usePermissionsUser from "@/hooks/usePermissionsUser";
import { useNavigate } from "react-router-dom";
import useGeneralDelete from "../../../hooks/useGeneralDelete";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";

const useTransitionRulesActions = () => {
    const navigate = useNavigate();
    const { mutate: deleteRule } = useGeneralDelete({
        keyQuery: URL_AND_KEYS.transitionRules.key,
    });

    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "transition-rules",
        actions: [
            {
                name: "TransitionRulesDelete",
                label: "Eliminar",
                handler: (id) => deleteRule({ id, url: URL_AND_KEYS.transitionRules.url }),
            },
            {
                name: "TransitionRulesRead",
                label: "Ver",
                handler: (id) => navigate(`/transition-rules/update/${id}?action=see`),
            },
            {
                name: "TransitionRulesUpdate",
                label: "Editar",
                handler: (id) => navigate(`/transition-rules/update/${id}`),
            },
        ],
        nameCreate: "TransitionRulesCreate",
    });

    return {
        arrayAction,
        canBeCreate,
    };
};

export default useTransitionRulesActions;
