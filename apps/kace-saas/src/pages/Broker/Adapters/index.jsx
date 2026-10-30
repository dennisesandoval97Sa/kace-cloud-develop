import { useTranslation } from "react-i18next";
import DefaultIndexActions from "@/components/core/DefaultIndexActions/DefaultIndexActions";
import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard";
import usePermissionsUser from "@/hooks/usePermissionsUser";
import { AdaptersTableContainer } from "./components/AdaptersTableContainer";
import useAdaptersAction from "./hooks/useAdaptersAction";
import { ROUTES } from "@/config/routesDictionary";

const AdaptersIndex = () => {
    const { handleDelete, handleSee, handleUpdate } = useAdaptersAction();
    const { t } = useTranslation();
    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "broker_adapters",
        actions: [
            { name: "BrokerAdaptersUpdate", label: t("app.forms.edit"), handler: handleUpdate },
            { name: "BrokerAdaptersDelete", label: t("app.forms.delete"), handler: handleDelete },
            { name: "BrokerAdaptersRead", label: t("app.forms.see"), handler: handleSee },
        ],
        nameCreate: "BrokerAdaptersCreate",
    });
    return (
        <DashboardSectionCard title="Adapters">
            <div className="flex flex-col gap-4">
                {canBeCreate && <DefaultIndexActions createUrl={ROUTES.BROKER_ADAPTERS_CREATE.path} />}
                <AdaptersTableContainer arrayAction={arrayAction} />
            </div>
        </DashboardSectionCard>
    );
};

export default AdaptersIndex;
