import { useTranslation } from "react-i18next"
import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions"
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import usePermissionsUser from "../../hooks/usePermissionsUser"
import { RestFunctionsTableContainer } from "./components/RestFunctionsTableContainer"
import useRestFunctionActions from "./hooks/useRestFunctionActions"

const RestFuncions = () => {
    const { t } = useTranslation();

    const {
        handleDeleteRestFunction,
        handleUpdateRestFunction,
        handleSeeRestFunction
    } = useRestFunctionActions();

    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "ws-rest-functions",
        actions: [
            { name: "WsRestFunctionUpdate", label: `${t("app.forms.edit")}`, handler: handleUpdateRestFunction },
            { name: "WsRestFunctionDelete", label: `${t("app.forms.delete")}`, handler: handleDeleteRestFunction },
            { name: "WsRestFunctionRead", label: `${t("app.forms.see")}`, handler: handleSeeRestFunction }
        ],
        nameCreate: "WsRestFunctionCreate"
    })

    return (
        <DashboardSectionCard title={t("app.title.restFunctions")}>
            <div className="flex flex-col gap-4">
                {canBeCreate && (
                    <DefaultIndexActions createUrl="/rest-functions/create" nameDataTestId="rest_functions" />
                )}
                <RestFunctionsTableContainer arrayAction={arrayAction} />
            </div>
        </DashboardSectionCard>
    );
}

export default RestFuncions;