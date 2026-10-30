import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard";
import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions";
import { RestFlowsTableContainer } from "./components/RestFlowTableContainer";
import useRestFlowsActions from "./hooks/useRestFlowsActions";
import { useTranslation } from "react-i18next";
import usePermissionsUser from "../../hooks/usePermissionsUser";

const RestFlow = () => {
    const {
        handleUpdateRestFlow,
        handleDeleteRestFlow,
        handleSeeRestFlow,
    } = useRestFlowsActions();

    const { t } = useTranslation()
    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "ws-rest-flows",
        actions: [
            { name: "WsRestFlowsUpdate", label: "Editar", handler: handleUpdateRestFlow },
            { name: "WsRestFlowsDelete", label: `${t("app.forms.delete")}`, handler: handleDeleteRestFlow },
            { name: "WsRestFlowsRead", label: `${t("app.forms.see")}`, handler: handleSeeRestFlow },
        ],
        nameCreate: "WsRestFlowsCreate",
    });

    return (
        <DashboardSectionCard title={t("app.title.restFlows")}>
            <div className="flex flex-col gap-4">
                {canBeCreate && <DefaultIndexActions createUrl="/rest-flows/create" nameDataTestId="rest_flows" />}
                <RestFlowsTableContainer
                    arrayAction={arrayAction}
                />
            </div>
        </DashboardSectionCard>
    );
};

export default RestFlow;
