import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import usePermissionsUser from "@kace/hooks/usePermissionsUser";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import useGeneralDelete from "@kace/hooks/useGeneralDelete";
import {
    setIdSelectedAndDisableEdit,
    setIdSelectedAndEnableEdit,
    setOpenModal,
} from "../../../redux/state/modalBehavior";

const useActionsAgenda = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();

    const { mutate: deleteAction } = useGeneralDelete({
        keyQuery: URL_AND_KEYS.agendas.key,
    });

    const handleUpdateAgenda = (id) => {
        dispatch(setIdSelectedAndEnableEdit(id));
        dispatch(setOpenModal(true));
    };

    const handleSeeAgenda = (id) => {
        dispatch(setIdSelectedAndDisableEdit(id));
        dispatch(setOpenModal(true));
    };

    const handleDeleteAgenda = (id) => {
        deleteAction({ id, url: URL_AND_KEYS.agendas.url });
    };

    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "agendas",
        actions: [
            {
                name: "AgendasUpdate",
                label: `${t("app.forms.edit")}`,
                handler: handleUpdateAgenda,
            },
            {
                name: "AgendasDelete",
                label: `${t("app.forms.delete")}`,
                handler: handleDeleteAgenda,
            },
            {
                name: "AgendasRead",
                label: `${t("app.forms.see")}`,
                handler: handleSeeAgenda,
            },
        ],
        nameCreate: "AgendasCreate",
    });

    return {
        arrayAction,
        canBeCreate,
    };
};

export default useActionsAgenda;
