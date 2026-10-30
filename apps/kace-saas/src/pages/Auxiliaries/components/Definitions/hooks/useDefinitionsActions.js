import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import usePermissionsUser from "@/hooks/usePermissionsUser";
import {
    setIdSelectedAndDisableEdit,
    setIdSelectedAndEnableEdit,
    setOpenModal,
} from "@/redux/state/modalBehavior";

const useDefinitionsActions = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();

    const handleUpdateDefinition = (id) => {
        dispatch(setIdSelectedAndEnableEdit(id));
        dispatch(setOpenModal(true));
    };
    const handleSeeDefinition = (id) => {
        dispatch(setIdSelectedAndDisableEdit(id));
        dispatch(setOpenModal(true));
    };

    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "aux-definitions",
        actions: [
            {
                name: "AuxDefinitionsRead",
                label: `${t("app.forms.see")}`,
                handler: handleSeeDefinition,
            },
            {
                name: "AuxDefinitionsUpdate",
                label: t("button.edit"),
                handler: handleUpdateDefinition,
            },
        ],

        nameCreate: "AuxDefinitionsCreate",
    });

    return {
        arrayAction,
        canBeCreate,
    };
};
export default useDefinitionsActions;
