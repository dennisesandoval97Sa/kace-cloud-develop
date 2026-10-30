import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { GENERAL_SETUP_SERVICE } from "../utils/URL";
import useGenericViewQuery from "./useGenericViewQuery";

const useConfigAgentData = () => {
    const queryClient = useQueryClient();

    const userInformation = queryClient.getQueryData(["userInformation"]) || {};
    const { user = {}, groups = [] } = userInformation;

    const selectedGroupId = useMemo(() => user.selectedGroup, [user.selectedGroup]);
    const configurationId = useMemo(() => {
        const selectedGroup = groups.find((group) => group.id === selectedGroupId);
        return selectedGroup?.configuration_id;
    }, [groups, selectedGroupId]);

    const { data, isLoading, isFetching } = useGenericViewQuery({
        url: `${GENERAL_SETUP_SERVICE}/${configurationId}`,
        keyQuery: "globalConfigurations",
        searchById: [configurationId],
        staleTime: 0,
        gcTime: 0,
        enabled: !!configurationId,
    });

    const generalSetupData = useMemo(() => {
        if (!data) {
            return {
                cases: null,
                clients: null,
                show_my_assigned_cases: false,
                show_my_created_cases: false,
                enable_custom_view: false,
                show_boards: false,
                AgentNameFields: null,
                show_cases_button: false,
                show_interactions: false,
                show_agent_interactions: false,
                show_client_data: true,
                show_case: false,
                show_client: false,
                show_transitions: false,
                show_subcase: false,
                adminVisibleColumns: [],
                allowed_file_extensions: [],
                maximun_size_allowed: 0,
                quantity_files_allowed: 0,
            };
        }

        const { settings = {} } = data;
        const { layouts = {}, behaviors = {} } = settings;
        const configAgentLayouts = layouts.application?.agente || {};
        const configAgentBehaviors = behaviors.application?.agente || {};
        const AgentNameFields = layouts.application?.admin || null;
        const sessionTime = behaviors.application?.admin?.users || {};
        const groupsConfig = behaviors.application?.admin?.groups || {};

        const cases =
            configAgentLayouts?.cases || configAgentBehaviors?.casos
                ? { ...configAgentLayouts?.cases, ...configAgentBehaviors?.casos }
                : null;

        const adminMenusConfig = behaviors.application?.admin?.menus || {};

        return {
            cases,
            clients: configAgentLayouts.clients || null,
            show_my_assigned_cases: configAgentLayouts.agent?.show_my_assigned_cases || false,
            show_my_created_cases: configAgentLayouts.agent?.show_my_created_cases || false,
            enable_custom_view: configAgentLayouts.agent?.enable_custom_view || false,
            reassignFilterActiveUsers: configAgentBehaviors.casos.reassignFilterActiveUsers || false,
            reassignIncludeDefaultAssignees: configAgentBehaviors.casos.reassignIncludeDefaultAssignees || false,
            active_session_limit: behaviors?.application?.admin?.users?.active_session_limit ?? 2,
            show_boards: configAgentLayouts.agent?.show_boards || false,
            allowed_file_extensions: configAgentBehaviors?.files_extensions?.allowed_file_extensions || [],
            maximun_size_allowed: configAgentBehaviors?.files_extensions?.maximun_size_allowed || 0,
            quantity_files_allowed: configAgentBehaviors?.files_extensions?.quantity_files_allowed || 0,
            AgentNameFields,
            sessionTime,
            groupsConfig,
            adminCustomViewName: AgentNameFields?.cases?.custom_view_name || "view_case_details",
            adminVisibleColumns: AgentNameFields?.cases?.visible_columns ?? [],
            agent_filter_subcases_only: configAgentBehaviors.casos.agent_filter_subcases_only || false,
            close_tab_on_case_created: configAgentBehaviors.casos.close_tab_on_case_created || false,
            show_cases_button: configAgentLayouts.agent?.show_cases_button || false,
            enable_view_interaction: configAgentLayouts.interactions.enable_view_interaction || false,
            show_interactions: configAgentLayouts.agent?.show_interactions || false,
            show_agent_interactions: configAgentLayouts.agent?.show_agent_interactions || false,
            show_client_data: configAgentLayouts.agent?.show_client_data ?? true,
            show_case: configAgentLayouts.agent?.show_case || false,
            show_client: configAgentLayouts.agent?.show_client || false,
            show_transitions: configAgentLayouts.agent?.show_transitions || false,
            show_subcase: configAgentLayouts.agent?.show_subcase || false,
            hidden_menus: adminMenusConfig.hidden_menus || [],
            cases_agent_refresh_min: configAgentLayouts?.agent?.cases_agent_refresh_min ?? null,
        };
    }, [data]);

    return { ...generalSetupData, isLoading, isFetching };
};

export default useConfigAgentData;
