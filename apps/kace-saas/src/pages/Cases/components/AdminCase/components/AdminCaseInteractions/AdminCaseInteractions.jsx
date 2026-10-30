import { useMemo } from "react";
import PropTypes from "prop-types";
import useAdminCaseParams from "../../hooks/useAdminCaseParams";
import useAdminInteractions from "./hooks/useAdminInteractions";
import InteractionsList from "@/pages/Agent/components/Interactions/InteractionsList";

const AdminCaseInteractions = ({ isActive = false }) => {
    const { caseId } = useAdminCaseParams();

    const interactionsFilter = useMemo(() => {
        const filters = [];
        if (caseId) {
            filters.push({
                field: "caso_id",
                operator: "eq",
                value: caseId,
                type: "AND",
            });
        }
        return filters;
    }, [caseId]);

    const { interactions, loadingInteractions } = useAdminInteractions({
        caseId,
        filter: interactionsFilter,
        isActive,
    });
    return (
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col gap-3">
            <InteractionsList interactions={interactions} isLoading={loadingInteractions} />
        </div>
    );
};

AdminCaseInteractions.propTypes = {
    isActive: PropTypes.bool,
};

export default AdminCaseInteractions;
