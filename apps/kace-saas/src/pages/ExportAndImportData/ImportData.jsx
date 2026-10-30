import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import { Tabs, TabsList, TabsTrigger } from "@kace/ui-shared"
import { TabControlPanelComponent } from "./components/TabControlPanelComponent"
import { TabUploadFileComponent } from "./components/TabUploadFileComponent"
import { useTranslation } from "react-i18next"

export const ImportData = () => {
    const { t } = useTranslation()

    return (
        <DashboardSectionCard title={t("importExport.form.importTitle")}>
            <div className="flex justify-center">
                <div className="flex flex-col gap-8 p-4 w-full 2xl:w-4/5 h-full bg-background shadow-md rounded-md relative">
                    <article className="flex flex-col gap-4 justify-center items-center ">
                        <Tabs
                            defaultValue="controlPanel"
                            className="flex flex-col gap-4 justify-center items-center"
                            id="imp_data_control_panel"
                            data-testid="imp_data_control_panel"
                        >
                            <TabsList>
                                <TabsTrigger
                                    value="controlPanel"
                                    id="btn_imp_data_control_panel"
                                    data-testid="btn_imp_data_control_panel"
                                >
                                    {t("importExport.form.controlPanel")}
                                </TabsTrigger>
                                <TabsTrigger
                                    value="uploadFile"
                                    id="btn_imp_data_upload_file"
                                    data-testid="btn_imp_data_upload_file"
                                >
                                    {t("importExport.form.uploadFile")}
                                </TabsTrigger>
                            </TabsList>
                            <TabControlPanelComponent />
                            <TabUploadFileComponent />
                        </Tabs>
                    </article>
                </div>
            </div>
        </DashboardSectionCard>
    );
}
