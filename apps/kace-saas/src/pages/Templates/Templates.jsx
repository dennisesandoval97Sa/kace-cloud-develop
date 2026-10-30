import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard";
import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions";
import { TemplatesTableContainer } from "./components/TemplatesTableContainer";
import useTemplatesActions from "./hooks/useTemplatesActions";
import usePermissionsUser from "../../hooks/usePermissionsUser";
import { useTranslation } from "react-i18next";

const Templates = () => {
    const { handleDeleteTemplate, handleUpdateTemplate, handleSeeTemplate } = useTemplatesActions();
    const { t } = useTranslation();

    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "templates",
        actions: [
            { name: "TemplatesUpdate", label: "Editar", handler: handleUpdateTemplate },
            { name: "TemplatesDelete", label: `${t("app.forms.delete")}`, handler: handleDeleteTemplate },
            { name: "TemplatesRead", label: `${t("app.forms.see")}`, handler: handleSeeTemplate }
        ],
        nameCreate: "TemplatesCreate",
    })
    return (
        <DashboardSectionCard title="app.title.templates">
            <div className="flex flex-col gap-4">
                {canBeCreate &&
                    <DefaultIndexActions
                        createUrl="/templates/create"
                        nameDataTestId="templates"
                    />
                }
                <TemplatesTableContainer
                    arrayAction={arrayAction}
                />
            </div>
        </DashboardSectionCard>
    )
}
export default Templates
