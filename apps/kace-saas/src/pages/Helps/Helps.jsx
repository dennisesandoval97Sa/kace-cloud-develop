import { useTranslation } from "react-i18next";
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard";
import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions";
import usePermissionsUser from "../../hooks/usePermissionsUser";
import HelpsTableContainer from "./components/HelpsTableContainer";
import useHelpsActions from "./hooks/useHelpsActions";

const Helps = () => {
    const { t } = useTranslation();

    const { handleDeleteHelps, handleUpdateHelps, handleSeeHelps } = useHelpsActions();
    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "help",
        actions: [
            { name: "HelpsUpdate", label: "Editar", handler: handleUpdateHelps },
            { name: "HelpsDelete", label: `${t("app.forms.delete")}`, handler: handleDeleteHelps },
            { name: "HelpsRead", label: `${t("app.forms.see")}`, handler: handleSeeHelps },
        ],
        nameCreate: "HelpsCreate",
    });
    return (
        <DashboardSectionCard title="app.title.helps">
            <div className="flex flex-col gap-4">
                {canBeCreate && <DefaultIndexActions createUrl="/helps/create" />}
                <HelpsTableContainer arrayAction={arrayAction} />
            </div>
        </DashboardSectionCard>
    );
};

export default Helps;
