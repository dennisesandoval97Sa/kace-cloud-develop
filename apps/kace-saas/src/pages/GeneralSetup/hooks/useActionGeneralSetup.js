import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import useGeneralDelete from "@kace/hooks/useGeneralDelete";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const useActionsGeneralSetup = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { mutate: deleteAction } = useGeneralDelete({
        keyQuery: URL_AND_KEYS.globalConfiguration.key,
        errorMessage: `${t("app.forms.error_delete")} ${t("app.title.generalSetup")}`,
        successMessage: t("app.forms.success_delete_module", { module: t("app.title.generalSetup") }),
    });

    return {
        handleUpdateGeneralSetup: (id) => {
            navigate(`${URL_AND_KEYS.globalConfiguration.route}/update/${id}`);
        },
        handleDeleteGeneralSetup: (id) => {
            deleteAction({ id, url: URL_AND_KEYS.globalConfiguration.url });
        },
        handleSeeGeneralSetup: (id) => {
            navigate(`${URL_AND_KEYS.globalConfiguration.route}/update/${id}?action=see`);
        },
    };
};

export default useActionsGeneralSetup;
