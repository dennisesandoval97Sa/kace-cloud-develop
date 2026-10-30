import { useTranslation } from "react-i18next";
import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard";
import useFolioConfigurationsActions from "./hooks/useFolioConfigurationsActions";
import FolioConfigurationsDatatable from "./components/FolioConfigurationsDatatable";
import DefaultIndexActions from "@/components/core/DefaultIndexActions/DefaultIndexActions";

const FolioConfigurations = () => {
    const { t } = useTranslation();
    const { arrayAction, canBeCreate } = useFolioConfigurationsActions();

    return (
        <DashboardSectionCard title={t("navbar.folioConfigurations")}>
            <div className="flex flex-col gap-4">
                {canBeCreate && <DefaultIndexActions createUrl="/folio-configurations/create" />}
                <FolioConfigurationsDatatable actions={arrayAction} />
            </div>
        </DashboardSectionCard>
    );
};

export default FolioConfigurations;
