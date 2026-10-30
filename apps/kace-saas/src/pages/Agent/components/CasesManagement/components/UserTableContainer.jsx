import PropTypes from "prop-types";
import { useCallback, useEffect, useMemo } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { CasesTableComponent } from "../../../../../components/core/CasesTableComponent/CasesTableComponent";
import { useAgentContext } from "../../../context/AgentContext";
import { setFilterCases } from "../../../../../redux/state/filterCases";
import { openCaseAction } from "../../Interactions/utils/openCaseAction";

const EMPTY_FILTERS = [];

export const UserTableContainer = ({ searchCasesParamsProps = EMPTY_FILTERS, isCustomViewEnabled = false }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { configAgent } = useAgentContext();

    const baseFilters = useMemo(() => searchCasesParamsProps, [searchCasesParamsProps]);

    const actions = useMemo(
        () => [
            {
                name: "Ver caso",
                action: (id, reference) => {
                    openCaseAction({ dispatch, navigate, id, reference });
                },
                customizable: true,
            },
        ],
        [dispatch, navigate],
    );

    useEffect(() => {
        dispatch(setFilterCases(baseFilters));
    }, [dispatch, baseFilters]);

    const handleClearFilters = useCallback(() => {
        dispatch(setFilterCases(baseFilters));
    }, [dispatch, baseFilters]);

    return (
        <CasesTableComponent
            actionProps={actions}
            searchCasesParamsProps={searchCasesParamsProps}
            isCustomViewEnabled={isCustomViewEnabled}
            customViewName={configAgent?.adminCustomViewName}
            showSubcasesColumn={!!configAgent?.cases?.case_enable_subcases}
            baseFilters={baseFilters}
            onClearFilters={handleClearFilters}
        />
    );
};

UserTableContainer.propTypes = {
    searchCasesParamsProps: PropTypes.array,
    isCustomViewEnabled: PropTypes.bool,
};
