import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard";
import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions";
import useCasesActions from "./hooks/useCasesActions";
import { ConfigurableModal } from "./components/ModalActions/ConfigurableModal";
import { useSelector } from "react-redux";
import CaseDataTable from "./components/CaseDataTable";
import useConfigAgentData from "@/hooks/useConfigAgentData";
import { useMemo } from "react";
import { GeneralLoader } from "@/componentsV2/core/GeneralLoader";

export const CasesHandler = () => {
    const title = useSelector((state) => state.filterCases.title);
    const { arrayActions, type, description, handleBulkCombinedAction, canReassign, canChangeState, canClose } =
        useCasesActions();

    const { AgentNameFields, cases, adminCustomViewName, adminVisibleColumns, isLoading } = useConfigAgentData();
    const isCustomViewEnabled = useMemo(
        () => AgentNameFields?.cases?.enable_custom_view,
        [AgentNameFields?.cases?.enable_custom_view],
    );
    const isSubCasesEnabled = useMemo(() => cases?.case_enable_subcases ?? false, [cases?.case_enable_subcases]);
    const refetchInterval = useMemo(() => {
        const minutes = parseFloat(AgentNameFields?.cases?.cases_admin_refresh_min);
        if (minutes === 0) return false;
        return minutes > 0 ? minutes * 60 * 1000 : 60_000;
    }, [AgentNameFields?.cases?.cases_admin_refresh_min]);

    return (
        <DashboardSectionCard title={title}>
            <div className="flex flex-col gap-4">
                <DefaultIndexActions createUrl="" nameDataTestId="cases">
                    <ConfigurableModal
                        type={type}
                        description={description}
                        canReassign={canReassign}
                        canChangeState={canChangeState}
                        canClose={canClose}
                    />
                </DefaultIndexActions>
                {isLoading ? (
                    <GeneralLoader />
                ) : (
                    <CaseDataTable
                        actions={arrayActions}
                        isCustomViewEnabled={isCustomViewEnabled}
                        customViewName={adminCustomViewName}
                        visibleColumns={adminVisibleColumns}
                        isSubCasesEnabled={isSubCasesEnabled}
                        onBulkCombinedAction={handleBulkCombinedAction}
                        refetchInterval={refetchInterval}
                    />
                )}
            </div>
        </DashboardSectionCard>
    );
};
