import { useTranslation } from "react-i18next";

import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard";
import DefaultIndexActions from "@/components/core/DefaultIndexActions/DefaultIndexActions";
import usePermissionsUser from "@/hooks/usePermissionsUser";

import { ReportsTableContainer } from "./components/ReportsTableContainer";
import { REPORTS_PATH } from "./data/constants";
import useReportsActions from "./hooks/useReportsActions";

const Reports = () => {
    const { handleDeleteReport } = useReportsActions();

    const { t } = useTranslation();

    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "templates",
        actions: [{ name: "TemplatesDelete", label: t("app.forms.delete"), handler: handleDeleteReport }],
        nameCreate: "TemplatesCreate",
    });

    return (
        <DashboardSectionCard title="app.title.reports">
            <div className="flex flex-col gap-4">
                {canBeCreate && <DefaultIndexActions createUrl={`${REPORTS_PATH}/create`} nameDataTestId="templates" />}
                <ReportsTableContainer arrayAction={arrayAction} />
            </div>
        </DashboardSectionCard>
    );
};

export default Reports;
