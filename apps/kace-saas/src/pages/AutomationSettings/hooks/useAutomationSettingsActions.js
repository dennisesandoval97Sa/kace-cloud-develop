import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import useGeneralDelete from "@/hooks/useGeneralDelete";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const useAutomationSettingsActions = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { mutate: deleteAction } = useGeneralDelete({
        keyQuery: URL_AND_KEYS.automationSettings.key,
        successMessage: t("app.forms.success_delete_module", { module: t("app.title.automationSettings") }),
        errorMessage: `${t("app.forms.error_delete")} ${t("app.title.automationSettings")}`,
    });

    return {
        handleDeleteAutomationSettings: (id) => {
            deleteAction({ id, url: URL_AND_KEYS.automationSettings.url });
        },
        handleUpdateAutomationSettings: (id) => {
            navigate(`/automation-settings/update/${id}`);
        },
        handleSeeAutomationSettings: (id) => {
            navigate(`/automation-settings/update/${id}?action=see`);
        },
    };
};

export default useAutomationSettingsActions;
