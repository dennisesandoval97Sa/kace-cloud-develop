import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions"
import { RestEndPointsTableContainer } from "./components/RestEndPointsTableContainer"
import useRestEndpointsActions from "./hooks/useRestEndPointsActions"
import { useTranslation } from "react-i18next"
import usePermissionsUser from "../../hooks/usePermissionsUser"

const RestEndPoints = () => {
    const {
        handleUpdateRestEndpoints,
        handleDeleteRestEndpoints,
        handleSeeRestEndpoints,
    } = useRestEndpointsActions()
    const { t } = useTranslation()
    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "ws-rest-endpoints",
        actions: [
            { name: "WsRestEndpointsUpdate", label: "Editar", handler: handleUpdateRestEndpoints },
            { name: "WsRestEndpointsDelete", label: `${t("app.forms.delete")}`, handler: handleDeleteRestEndpoints },
            { name: "WsRestEndpointsRead", label: `${t("app.forms.see")}`, handler: handleSeeRestEndpoints }
        ],
        nameCreate: "WsRestEndpointsCreate",
    });

    return (
        <DashboardSectionCard title={t("app.title.restEndPoints")}>
            <div className="flex flex-col gap-4">
                {canBeCreate && (
                    <DefaultIndexActions createUrl="/rest-endpoints/create" nameDataTestId="rest_endpoint" />
                )}
                <RestEndPointsTableContainer arrayAction={arrayAction} />
            </div>
        </DashboardSectionCard>
    );
};

export default RestEndPoints;
