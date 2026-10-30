import { useTranslation } from "react-i18next";
import { FormOneScript } from "@/components/core/FormOneScript/FormOneScript";
import useAdminCaseParams from "@/pages/Cases/components/AdminCase/hooks/useAdminCaseParams";
import useConfigAgentData from "@/hooks/useConfigAgentData";
import useUserInformation from "@kace/hooks/useUserInformation";
import { useOneScriptUrl } from "@/pages/Agent/components/TabsClientContainer/hooks/useOneScriptUrl";
import { GeneralLoader } from "@/componentsV2/core/GeneralLoader";

const statePanelClass =
    "flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-md border border-input bg-background p-4";

const AdminCaseNotifications = () => {
    const { caseId } = useAdminCaseParams();
    const { cases } = useConfigAgentData();
    const { user } = useUserInformation();
    const { t } = useTranslation();

    const formId = cases?.notifications_one_script_form || "";

    const { formRef, url, isLoading, error } = useOneScriptUrl({
        formId,
        clientId: caseId,
        userId: user?.id,
    });

    if (!formId) return null;

    if (isLoading) {
        return (
            <div className={statePanelClass}>
                <GeneralLoader />
                <p>{t("genericTexts.loading")}</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-redCustom rounded-md border border-input bg-background p-4">
                <p>⚠️ {t("app.alerts.NoloadForm")}</p>
            </div>
        );
    }

    if (!url) {
        return (
            <div className={statePanelClass}>
                <GeneralLoader />
                <p>{t("app.alerts.formAux")}</p>
            </div>
        );
    }

    return (
        <div className="relative flex h-full min-h-0 w-full flex-1 flex-col">
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                <FormOneScript formRef={formRef} url={url} isCaseUpdate={Boolean(caseId)} />
            </div>
        </div>
    );
};

export default AdminCaseNotifications;
