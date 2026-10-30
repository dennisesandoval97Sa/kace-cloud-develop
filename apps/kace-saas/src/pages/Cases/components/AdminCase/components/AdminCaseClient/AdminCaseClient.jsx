import { GeneralLoader } from "@kace/ui-shared";
import { useAdminCaseClientUrl } from "./hooks/useAdminCaseClientUrl";
import { CaseCustomerCard } from "../../../../../../components/core/Cards/CaseCustomerCard";
import { FormOneScript } from "../../../../../../components/core/FormOneScript/FormOneScript";
import useAdminCaseClient from "./hooks/useAdminCaseClient";

export const AdminCaseClient = () => {
    const { url: urlClient, isLoading: isLoadingClientForm, formRef } = useAdminCaseClientUrl();
    const { data: clientData, isLoading: isLoadingClient } = useAdminCaseClient();

    return (
        <div className="flex min-h-0 min-w-0 h-full w-full flex-1 flex-col">
            {isLoadingClientForm || isLoadingClient ? (
                <GeneralLoader className="fixed top-1/2 left-1/2" />
            ) : (
                <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-2 rounded-md bg-background p-2 drop-shadow-md max-sm:p-1 lg:grid-cols-5">
                    <div className="shrink-0 grow-0 lg:col-span-2">
                        {clientData && <CaseCustomerCard data={clientData} />}
                    </div>

                    <div className="flex min-h-0 min-w-0 flex-1 flex-col p-2 lg:col-span-3">
                        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col p-2">
                            {urlClient && <FormOneScript formRef={formRef} url={`${urlClient}&onlySee=true`} />}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
