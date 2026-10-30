import PropTypes from "prop-types";
import { useCallback, useEffect, useMemo } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { CasesTableComponent } from "../../../../../components/core/CasesTableComponent/CasesTableComponent";
import useUserInformation from "../../../../../hooks/useUserInformation";
import { setFilterCases } from "../../../../../redux/state/filterCases";
import { setLoadingCaseInformation } from "../../../../../redux/state/loadingCaseInformation";
import { setCaseId, setInputSearchFilter, setReference } from "../../../../../redux/state/states";
import { URL_AND_KEYS } from "../../../../../utils/urlAndKeys";
import { useAgentContext } from "../../../context/AgentContext";
import { getAgentOpenCasesFilter } from "../utils/caseFilters";

const EMPTY_FILTERS = [];

export const AgentTableContainer = ({
    searchCasesParamsProps = EMPTY_FILTERS,
    isCustomViewEnabled = false,
    refetchInterval = false,
}) => {
    const { user } = useUserInformation();
    const { configAgent } = useAgentContext();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const extraIgnoreFields = ["nombres", "apellido1", "apellido2"];

    const actions = useMemo(
        () => [
            {
                name: "Ver caso",
                action: (id, reference) => {
                    dispatch(setLoadingCaseInformation(true));
                    dispatch(setReference(reference));
                    dispatch(setCaseId(id));
                    dispatch(setInputSearchFilter());
                    navigate(`/agent/update/${id}?action=edit`);
                },
                customizable: true,
            },
            configAgent?.cases?.show_sheduler && {
                name: "Calendario",
                action: (id) => {
                    navigate(`/agent/calendar/${id}`);
                },
                customizable: false,
            },
        ],
        [dispatch, navigate, configAgent],
    );

    const baseFilters = useMemo(
        () => (searchCasesParamsProps.length > 0 ? searchCasesParamsProps : getAgentOpenCasesFilter(user.id)),
        [searchCasesParamsProps, user.id],
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
            keyQuery={URL_AND_KEYS.cases.byAgentFilter}
            searchCasesParamsProps={searchCasesParamsProps}
            customSchemaFilterConfig={{ extraIgnoreFields }}
            isCustomViewEnabled={isCustomViewEnabled}
            customViewName={configAgent?.adminCustomViewName}
            showSubcasesColumn={!!configAgent?.cases?.case_enable_subcases}
            baseFilters={baseFilters}
            onClearFilters={handleClearFilters}
            refetchInterval={refetchInterval}
            enableRowSelection={false}
        />
    );
};

AgentTableContainer.propTypes = {
    searchCasesParamsProps: PropTypes.array,
    isCustomViewEnabled: PropTypes.bool,
    refetchInterval: PropTypes.oneOfType([PropTypes.number, PropTypes.bool]),
};
