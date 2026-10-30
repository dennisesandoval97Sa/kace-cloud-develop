import { useTranslation } from "react-i18next";
import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard";
import DefaultIndexActions from "@/components/core/DefaultIndexActions/DefaultIndexActions";
import usePermissionsUser from "@/hooks/usePermissionsUser";
import { CustomListTableContainer } from "./components/CustomListTableContainer";
import { CUSTOM_LISTS_PATH } from "./data/constants";
import useCustomListActions from "./hooks/useCustomListActions";

/**
 * Componente principal para la gestión de listas personalizadas.
 * Renderiza la tabla con las listas personalizadas y las acciones disponibles.
 *
 * @component
 * @returns {JSX.Element} Página de listas personalizadas con tabla y acciones
 */
const CustomList = () => {
    // Handlers para las acciones CRUD de listas personalizadas
    const { handleDeleteCustomList, handleUpdateCustomList, handleSeeCustomList } = useCustomListActions();

    // Hook de traducción i18n
    const { t } = useTranslation();

    // Obtiene permisos del usuario para las acciones disponibles en el módulo
    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "templates",
        actions: [
            { name: "TemplatesUpdate", label: t("app.forms.edit"), handler: handleUpdateCustomList },
            { name: "TemplatesDelete", label: `${t("app.forms.delete")}`, handler: handleDeleteCustomList },
            { name: "TemplatesRead", label: `${t("app.forms.see")}`, handler: handleSeeCustomList },
        ],
        nameCreate: "TemplatesCreate",
    });

    return (
        <DashboardSectionCard title="app.title.listasPersonalizadas">
            <div className="flex flex-col gap-4">
                {/* Botón de crear solo visible si el usuario tiene permisos */}
                {canBeCreate && (
                    <DefaultIndexActions createUrl={`${CUSTOM_LISTS_PATH}/create`} nameDataTestId="custom-lists" />
                )}
                {/* Tabla con las listas personalizadas */}
                <CustomListTableContainer arrayAction={arrayAction} />
            </div>
        </DashboardSectionCard>
    );
};

export default CustomList;
