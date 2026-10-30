import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kace/ui-shared";
import { Archive, UserCheck, UserCog, LayoutGrid } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import useUserInformation from "../../../../hooks/useUserInformation";
import { useAgentContext } from "../../context/AgentContext";
import { AgentTableContainer } from "./components/AgentTableContainer";
import { UserTableContainer } from "./components/UserTableContainer";
import { getClosedCasesParams, getOpenCasesParams } from "./utils/casesParams";
import { getAgentOpenCasesFilter, getOpenCasesCreatedByUserFilter } from "./utils/caseFilters";
import { formatTestId } from "@/utils/src/helpers";
import BoardsAccordion from "./components/BoardsAccordion";
import InteractionsHandler from "../Interactions/InteractionsHandler";
import usePersistentState from "@kace_v2/shared/hooks/usePersistentState.hook";

const CURRENT_TAB_NAMESPACE = "agent:casesManagement:tab";

const INTERACTION_SEARCH_CONTEXT_KEYS = [
    "interaction_id",
    "workspace_id",
    "all_workspaces",
    "type",
    "my_reviews",
    "search",
    "page",
    "suggested_client_dismissed",
    "client_panel",
];

export const CasesManagement = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const { clientId, isNewClient, configAgent } = useAgentContext();

    const { permissionsAgent, user } = useUserInformation();
    const hasInteractionSearchContext = useMemo(() => {
        const params = new URLSearchParams(location.search);

        return INTERACTION_SEARCH_CONTEXT_KEYS.some((key) => params.has(key));
    }, [location.search]);
    const [currentTab, setCurrentTab] = usePersistentState(CURRENT_TAB_NAMESPACE, "cases-agent", {
        sanitize: (value) => (typeof value === "string" && value ? value : undefined),
    });

    const canSeeOwnCases = useMemo(
        () => permissionsAgent.some((item) => item.name === "CasesReadOwnCases" && item.granted),
        [permissionsAgent],
    );

    const refetchInterval = useMemo(() => {
        const minutes = parseFloat(configAgent?.cases_agent_refresh_min);
        if (minutes === 0) return false;
        return minutes > 0 ? minutes * 60 * 1000 : 60_000;
    }, [configAgent?.cases_agent_refresh_min]);

    const casesParams = useMemo(
        () => ({
            open: getOpenCasesParams(clientId, configAgent.enable_custom_view),
            closed: getClosedCasesParams(clientId, configAgent.enable_custom_view),
            assigned: getAgentOpenCasesFilter(user?.id),
            created: getOpenCasesCreatedByUserFilter(user?.id, configAgent.enable_custom_view),
        }),
        [clientId, user?.id, configAgent.enable_custom_view],
    );

    const getTabsConfig = useMemo(() => {
        const baseTabs = [
            {
                value: "my-assigned-cases",
                label: t("agent.tabs.myAssignedCases"),
                icon: <UserCheck size={16} className="mr-2 sm:hidden" />,
                content: (
                    <AgentTableContainer
                        searchCasesParamsProps={casesParams.assigned}
                        isCustomViewEnabled={configAgent.enable_custom_view}
                        refetchInterval={refetchInterval}
                    />
                ),
                show: configAgent?.show_my_assigned_cases && canSeeOwnCases,
            },
            {
                value: "my-created-cases",
                label: t("agent.tabs.myCreatedCases"),
                icon: <UserCog size={16} className="mr-2 sm:hidden" />,
                content: (
                    <AgentTableContainer
                        searchCasesParamsProps={casesParams.created}
                        isCustomViewEnabled={configAgent.enable_custom_view}
                    />
                ),
                show: configAgent?.show_my_created_cases && canSeeOwnCases,
            },
            {
                value: "interaction",
                label: t("agent.tabs.interactions"),
                icon: <UserCog size={16} className="mr-2 sm:hidden" />,
                content: <InteractionsHandler isCustomViewEnabled={configAgent.enable_custom_view} />,
                show: configAgent?.show_agent_interactions || configAgent?.show_interactions || false,
            },
        ];

        const clientTabs = [
            {
                value: "cases-client",
                label: t("agent.tabs.clientOpenCases"),
                icon: <Archive size={16} className="mr-2 sm:hidden" />,
                content: (
                    <UserTableContainer
                        searchCasesParamsProps={casesParams.open}
                        isCustomViewEnabled={configAgent.enable_custom_view}
                    />
                ),
                show: configAgent?.clients?.open_cases && clientId && !isNewClient,
            },
            {
                value: "cases-closed-client",
                label: t("agent.tabs.clientClosedCases"),
                icon: <Archive size={16} className="mr-2 sm:hidden" />,
                content: (
                    <UserTableContainer
                        searchCasesParamsProps={casesParams.closed}
                        isCustomViewEnabled={configAgent.enable_custom_view}
                    />
                ),
                show: configAgent?.clients?.close_cases && clientId && !isNewClient,
            },
        ];

        const boardsTab = [
            {
                value: "boards",
                label: t("agent.tabs.boards"),
                icon: <LayoutGrid size={16} className="mr-2 sm:hidden" />,
                content: <BoardsAccordion />,
                show: configAgent?.show_boards || false,
            },
        ];

        return [...baseTabs, ...clientTabs, ...boardsTab].filter((tab) => tab.show);
    }, [configAgent, canSeeOwnCases, clientId, isNewClient, casesParams, t]);

    const handleTabChange = useCallback(
        (value) => {
            setCurrentTab(value);
        },
        [setCurrentTab],
    );

    /*
     * Cambiar de cliente si debe reiniciar la vista. Pero AgentContext siembra
     * `clientId` dentro de un efecto (de "" a un UUID nuevo en cada montaje
     * cuando la ruta no trae cliente), asi que la primera transicion no es un
     * cambio de cliente: reiniciar ahi borraba la pestana restaurada al volver
     * de un caso. Solo se reinicia al pasar de un cliente real a otro.
     */
    const previousClientIdRef = useRef(clientId);
    useEffect(() => {
        if (hasInteractionSearchContext) {
            setCurrentTab("interaction");
        }
        const previousClientId = previousClientIdRef.current;
        previousClientIdRef.current = clientId;
        if (hasInteractionSearchContext) return;
        if (!previousClientId || previousClientId === clientId) return;
        setCurrentTab("my-assigned-cases");
    }, [clientId, hasInteractionSearchContext, setCurrentTab]);

    useEffect(() => {
        if (getTabsConfig.length > 0 && !getTabsConfig.some((tab) => tab.value === currentTab)) {
            setCurrentTab(getTabsConfig[0].value);
        }
    }, [getTabsConfig, currentTab, setCurrentTab]);

    if (!configAgent || getTabsConfig.length === 0) return null;

    return (
        <Tabs
            value={currentTab}
            onValueChange={handleTabChange}
            className="flex flex-col border border-input p-2 rounded-md"
        >
            <TabsList>
                {getTabsConfig.map((tab) => (
                    <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className={clientId ? "w-full" : "w-1/3"}
                        id={formatTestId("cases_manager_tab", `${tab.value}`, { clean: true })}
                        data-testid={formatTestId("cases_manager_tab", `${tab.value}`, { clean: true })}
                    >
                        {tab.icon}
                        <span
                            className={`max-sm:${currentTab !== tab.value ? "hidden" : "block"}`}
                            id={formatTestId("cases_manager_tab_label", `${tab.value}`)}
                            data-testid={formatTestId("cases_manager_tab_label", `${tab.value}`)}
                        >
                            {tab.label}
                        </span>
                    </TabsTrigger>
                ))}
            </TabsList>

            {getTabsConfig.map((tab) => (
                <TabsContent key={`content-${tab.value}`} value={tab.value}>
                    {tab.content}
                </TabsContent>
            ))}
        </Tabs>
    );
};
