import { TabsContent } from "@kace/ui-shared";
import { ImportsDashboardTable } from "@/components/core/ImportsDashboardTable";
import { useTranslation } from "react-i18next";

export const TabControlPanelComponent = () => {
    const { t } = useTranslation();
    return (
        <TabsContent value="controlPanel">
            <h3 className="text-center font-semibold text-lg mb-4">{t("importExport.form.fileControlTable")}</h3>
            <ImportsDashboardTable />
        </TabsContent>
    );
};
