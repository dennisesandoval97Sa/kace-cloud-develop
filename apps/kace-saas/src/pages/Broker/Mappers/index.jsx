import { useTranslation } from "react-i18next";
import DefaultIndexActions from "@/components/core/DefaultIndexActions/DefaultIndexActions";
import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard";
import usePermissionsUser from "@/hooks/usePermissionsUser";
import { MappersTableContainer } from "./components/MappersTableContainer";
import useMappersAction from "./hooks/useMappersAction";
import { ROUTES } from "@/config/routesDictionary";

const MappersIndex = () => {
    const { handleDelete, handleSee, handleUpdate } = useMappersAction();
    const { t } = useTranslation();
    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "broker_mappers",
        actions: [
            { name: "BrokerMappersUpdate", label: t("app.forms.edit"), handler: handleUpdate },
            { name: "BrokerMappersDelete", label: t("app.forms.delete"), handler: handleDelete },
            { name: "BrokerMappersRead", label: t("app.forms.see"), handler: handleSee },
        ],
        nameCreate: "BrokerMappersCreate",
    });
    return (
        <DashboardSectionCard title="Mappers">
            <div className="flex flex-col gap-4">
                {canBeCreate && <DefaultIndexActions createUrl={ROUTES.BROKER_MAPPERS_CREATE.path} />}
                <MappersTableContainer arrayAction={arrayAction} />
            </div>
        </DashboardSectionCard>
    );
};

export default MappersIndex;
