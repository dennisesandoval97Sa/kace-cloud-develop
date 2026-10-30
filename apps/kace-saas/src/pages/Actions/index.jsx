import { useTranslation } from "react-i18next";
import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard";
import useActions from "./hooks/useActionsActions";
import { MenuOptionsToActions } from "./components/MenuOptionsToActions";
import ActionsDataTable from "./components/ActionsDatatable";

const Actions = () => {
    const { t } = useTranslation();
    const { arrayAction, canBeCreate } = useActions();

    return (
        <DashboardSectionCard title={t("navbar.actions")}>
            <div className="flex flex-col gap-4">
                {canBeCreate && <MenuOptionsToActions />}
                <ActionsDataTable actions={arrayAction} />
            </div>
        </DashboardSectionCard>
    );
};

export default Actions;
