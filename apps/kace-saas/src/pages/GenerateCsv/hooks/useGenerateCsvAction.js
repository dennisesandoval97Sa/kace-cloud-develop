import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import useGeneralDelete from "@/hooks/useGeneralDelete";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const useGenerateCsvAction = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { mutate: deleteAction } = useGeneralDelete({
        keyQuery: URL_AND_KEYS.generateCsv.key,
        successMessage: t("app.forms.success_delete_module", { module: t("app.title.generateCsv") }),
        errorMessage: `${t("app.forms.error_delete")} ${t("app.title.generateCsv")}`,
    });

    return {
        handleUpdateGenerateCsv: (id) => {
            navigate(`/generate-csv/update/${id}`);
        },
        handleDeleteGenerateCsv: (id) => {
            deleteAction({ id, url: URL_AND_KEYS.generateCsv.url });
        },
        handleSeeGenerateCsv: (id) => {
            navigate(`/generate-csv/update/${id}?action=see`);
        },
    };
};

export default useGenerateCsvAction;
