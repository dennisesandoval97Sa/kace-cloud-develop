import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import useGeneralDelete from "@/hooks/useGeneralDelete";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const useMailAccountsAction = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { mutate: deleteAction } = useGeneralDelete({
        keyQuery: URL_AND_KEYS.mail_accounts.key,
        successMessage: t("app.forms.success_delete_module", { module: t("app.title.mailAccounts") }),
        errorMessage: `${t("app.forms.error_delete")} ${t("app.title.mailAccounts")}`,
    });

    return {
        handleUpdateMailAccount: (id) => {
            navigate(`/mail-account/update/${id}`);
        },
        handleSeeMailAccount: (id) => {
            navigate(`/mail-account/update/${id}?action=see`);
        },
        handleDeleteMailAccount: (id) => {
            deleteAction({ id, url: URL_AND_KEYS.mail_accounts.url });
        },
    };
};

export default useMailAccountsAction;
