import { AdminCaseCardModules } from "@/pages/Cases/components/AdminCase/components/AdminCaseCardModules";
import { FormOneScript } from "@/components/core/FormOneScript/FormOneScript";
import useAdminCaseOneScriptKace from "@/pages/Cases/components/AdminCase/components/AdminCasesOneScriptKaceComponents/hooks/useAdminCaseOneScriptKace";
import { GeneralLoader } from "@/componentsV2/core/GeneralLoader";
import { Separator } from "@/components/ui-shared";
import { useTranslation } from "react-i18next";

const AdminCaseOneScriptKaceIframe = () => {
    const { t } = useTranslation();
    const { formRefOneScript, oneScriptURL, isLoading, caseId } = useAdminCaseOneScriptKace();

    return (
        <div className="relative flex h-full min-h-0 w-full flex-1 flex-col">
            <AdminCaseCardModules>
                {isLoading && <GeneralLoader />}
                {!isLoading && !oneScriptURL && (
                    <div
                        className={
                            "absolute inset-0 flex flex-col items-center justify-evenly border-2 border-dashed rounded-md text-center text-2xl font-bold text-gray-400"
                        }
                    >
                        <Separator orientation="vertical" className="h-1/4 w-2 rounded-full bg-gray-400" />
                        {t("app.text.oneScriptModule")}
                        <Separator orientation="vertical" className="h-1/4 w-2 rounded-full bg-gray-400" />
                    </div>
                )}
                {oneScriptURL && (
                    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                        <FormOneScript
                            formRef={formRefOneScript}
                            url={oneScriptURL}
                            isCaseUpdate={Boolean(caseId)}
                            enableBoardReturn
                        />
                    </div>
                )}
            </AdminCaseCardModules>
        </div>
    );
};

export default AdminCaseOneScriptKaceIframe;
