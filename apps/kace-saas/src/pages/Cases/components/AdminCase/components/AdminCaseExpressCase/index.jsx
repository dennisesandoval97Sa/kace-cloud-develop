import React from "react";
import useAdminCaseExpressCase from "@/pages/Cases/components/AdminCase/components/AdminCaseExpressCase/hooks/useAdminCaseExpressCase";
import { AdminCaseCardModules } from "@/pages/Cases/components/AdminCase/components/AdminCaseCardModules";
import { GeneralLoader, Separator } from "@/components/ui-shared";
import { FormOneScript } from "@/components/core/FormOneScript/FormOneScript";
import { useTranslation } from "react-i18next";

const AdminCaseExpressCase = (props) => {
    const { t } = useTranslation();
    const { formRefOneScript, oneScriptUrl, isLoading } = useAdminCaseExpressCase();
    return (
        <div className="relative flex h-full min-h-0 w-full flex-1 flex-col">
            <AdminCaseCardModules>
                {isLoading && <GeneralLoader />}
                {!isLoading && !oneScriptUrl && (
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
                {oneScriptUrl && (
                    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                        <FormOneScript formRef={formRefOneScript} url={oneScriptUrl} enableBoardReturn />
                    </div>
                )}
            </AdminCaseCardModules>
        </div>
    );
};

export default AdminCaseExpressCase;
