import { useTranslation } from "react-i18next";
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard";
import FormCard from "../../components/core/Cards/FormCard";
import SectionForm from "../../components/core/Cards/section-form";
import MassiveExecutionTabs from "./components/MassiveExecutionTabs";
import MassiveExecutionPreviewTableContainer from "./components/MassiveExecutionPreviewTableContainer";
import { useState } from "react";
import AuxClientsFilterPreviewDataTable from "./components/AuxClientsFilterPreviewDataTable";

const MassiveExecutionExecute = () => {
    const { t } = useTranslation();
    const [previewType, setPreviewType] = useState("clients");
    const [filters, setFilters] = useState([]);

    return (
        <DashboardSectionCard title={t("massiveExecution.title")}>
            <div className="flex w-full justify-center">
                <FormCard genericTitle={false} title={t("massiveExecution.title")}>
                    <div className="flex flex-col col-span-5 gap-8 ">
                        <SectionForm
                            title={t("massiveExecution.search.title")}
                            subTitle={t("massiveExecution.search.subtitle")}
                        >
                            <div className="flex justify-center w-full p-2 gap-4">
                                <MassiveExecutionTabs
                                    setPreviewType={(value) => setPreviewType(value)}
                                    setFilters={(value) => setFilters(value)}
                                />
                            </div>
                        </SectionForm>

                        {["filter", "file", "file_clients"].includes(previewType) && (
                            <MassiveExecutionPreviewTableContainer />
                        )}
                        {previewType === "clients" && !!filters?.length && (
                            <AuxClientsFilterPreviewDataTable tableFilters={filters} />
                        )}
                    </div>
                </FormCard>
            </div>
        </DashboardSectionCard>
    );
};

export default MassiveExecutionExecute;
