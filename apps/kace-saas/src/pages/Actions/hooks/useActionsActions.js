import usePermissionsUser from "@/hooks/usePermissionsUser";
import useActionsData from "./useActionsData";
import { useTranslation } from "react-i18next";

const useActions = () => {
    const { t } = useTranslation();
    const { handleSeeAction, handleUpdateAction, handleDeleteAction } = useActionsData();
    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "actions",
        actions: [
            {
                name: "ActionDelete",
                label: "Eliminar",
                handler: handleDeleteAction,
            },
            {
                name: "ActionRead",
                label: "Ver",
                handler: handleSeeAction,
            },
            {
                name: "ActionUpdate",
                label: "Editar",
                handler: handleUpdateAction,
            },
        ],
        nameCreate: "ActionCreate",
    });

    return {
        arrayAction,
        canBeCreate,
    };
};

export default useActions;
