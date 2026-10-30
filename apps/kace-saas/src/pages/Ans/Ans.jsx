import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions"
import useAnsActions from "./hooks/useAnsActions"
import AnsForm from "./components/AnsForm"
import { AnsTableContainer } from "./components/ans-table-container"
import { useTranslation } from "react-i18next"
import usePermissionsUser from "../../hooks/usePermissionsUser"

const Ans = () => {
    const { t } = useTranslation()
    const {
        handleDeleteAns,
        handleUpdateAns,
        handleSeeAns
    } = useAnsActions()
    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "ans",
        actions: [
            { name: "AnsUpdate", label: "Editar", handler: handleUpdateAns },
            { name: "AnsDelete", label: `${t("app.forms.delete")}`, handler: handleDeleteAns },
            { name: "AnsRead", label: `${t("app.forms.see")}`, handler: handleSeeAns }
        ],
        nameCreate: "AnsCreate"
    })
    return (
        <DashboardSectionCard title={t("app.title.ans")}>
            <div className="flex flex-col gap-4">
                {canBeCreate && <DefaultIndexActions buttonModal={<AnsForm />} nameDataTestId="ans_create" />}
                <AnsTableContainer arrayAction={arrayAction} />
            </div>
        </DashboardSectionCard>
    )
}

export default Ans
