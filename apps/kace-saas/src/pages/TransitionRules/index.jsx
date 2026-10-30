import { useTranslation } from "react-i18next";
import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard";
import useTransitionRulesActions from "./hooks/useTransitionRulesActions";
import TransitionRulesDatatable from "./components/TransitionRulesDatatable";
import DefaultIndexActions from "@/components/core/DefaultIndexActions/DefaultIndexActions";

const TransitionRules = () => {
    const { t } = useTranslation();
    const { arrayAction, canBeCreate } = useTransitionRulesActions();

    return (
        <DashboardSectionCard title={t("navbar.transitionRules")}>
            <div className="flex flex-col gap-4">
                {canBeCreate && <DefaultIndexActions createUrl="/transition-rules/create" />}
                <TransitionRulesDatatable actions={arrayAction} />
            </div>
        </DashboardSectionCard>
    );
};

export default TransitionRules;
