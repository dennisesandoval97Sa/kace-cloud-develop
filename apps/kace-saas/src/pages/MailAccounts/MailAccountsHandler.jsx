import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions"
import MailAccountsTableContainer from "./components/MailAccountsTableContainer"
import useMailAccountsAction from "./hooks/useMailAccountsAction"
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import usePermissionsUser from "../../hooks/usePermissionsUser"
import { useTranslation } from "react-i18next"

export const MailAccountsHandler = () => {
    const { handleDeleteMailAccount, handleUpdateMailAccount, handleSeeMailAccount } = useMailAccountsAction()
    const { t } = useTranslation()
    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "mail-accounts",
        actions: [
            { name: "MailAccountsUpdate", label: "Editar", handler: handleUpdateMailAccount },
            { name: "MailAccountsDelete", label: `${t("app.forms.delete")}`, handler: handleDeleteMailAccount },
            { name: "MailAccountsRead", label: `${t("app.forms.see")}`, handler: handleSeeMailAccount }
        ],
        nameCreate: "MailAccountsCreate"
    })
    return (
        <DashboardSectionCard title={"app.title.mailAccounts"}>
            <div className="flex flex-col gap-4">
                {canBeCreate && <DefaultIndexActions createUrl="/mail-account/create" nameDataTestId="mailAccounts" />}
                <MailAccountsTableContainer
                    arrayAction={arrayAction}
                />
            </div>
        </DashboardSectionCard>
    )
}
