import usePermissionsUser from "@/hooks/usePermissionsUser";
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard";
import InteractionsHandler from "./InteractionsHandler";
import { useTranslation } from "react-i18next";

import useInteractionActions from "./hooks/useInteractionActions";

const noopBulkAction = () => {};

const Interactions = () => {
    const { t } = useTranslation();

    const { handleUpdateInteraction, handleDeleteInteraction, handleSeeInteraction } = useInteractionActions();
    const { arrayAction } = usePermissionsUser({
        moduleId: "interactions",
        actions: [
            { name: "InteractionsUpdate", label: "Editar", handler: handleUpdateInteraction },
            { name: "InteractionsDelete", label: t("app.forms.delete"), handler: handleDeleteInteraction },
            { name: "InteractionsRead", label: t("app.forms.see"), handler: handleSeeInteraction },
            { name: "InteractionsBulkMove", label: t("interactions.bulk.move"), handler: noopBulkAction },
            { name: "InteractionsBulkClose", label: t("interactions.bulk.close"), handler: noopBulkAction },
        ],
        nameCreate: "InteractionsCreate",
    });

    const canReadInteractions = arrayAction.some((action) => action.name === t("app.forms.see"));

    return (
        <DashboardSectionCard title="app.tabs.interactions">
            {canReadInteractions && <InteractionsHandler actions={arrayAction} />}
        </DashboardSectionCard>
    );
};

export default Interactions;
