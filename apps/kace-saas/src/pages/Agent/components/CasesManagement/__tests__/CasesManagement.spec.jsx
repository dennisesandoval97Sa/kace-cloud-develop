import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const agentContext = { clientId: "", isNewClient: true, configAgent: {} };

vi.mock("../../../context/AgentContext", () => ({
    useAgentContext: () => agentContext,
}));

vi.mock("../../../../../hooks/useUserInformation", () => ({
    default: () => ({
        user: { id: "u1" },
        active_group_id: "g1",
        permissionsAgent: [{ name: "CasesReadOwnCases", granted: true }],
    }),
}));

vi.mock("../components/AgentTableContainer", () => ({
    AgentTableContainer: () => <div data-testid="agent-table" />,
}));

vi.mock("../components/UserTableContainer", () => ({
    UserTableContainer: () => <div data-testid="user-table" />,
}));

vi.mock("../components/BoardsAccordion", () => ({
    default: () => <div data-testid="boards-accordion" />,
}));

vi.mock("../../Interactions/InteractionsHandler", () => ({
    default: () => <div data-testid="interactions" />,
}));

vi.mock("react-router-dom", () => ({
    useLocation: () => ({ search: "" }),
}));

const { writePersisted } = await import("@kace_v2/shared/utils/persistentStorage.util");
const { CasesManagement } = await import("../CasesManagement");

const SCOPE = { userId: "u1", groupId: "g1" };
const TAB_NAMESPACE = "agent:casesManagement:tab";

const CONFIG_AGENT = {
    show_my_assigned_cases: true,
    show_my_created_cases: true,
    show_boards: true,
    enable_custom_view: false,
    clients: null,
};

/* Todos los flags en false: lo que devuelve useConfigAgentData mientras carga. */
const CONFIG_AGENT_LOADING = { enable_custom_view: false, show_boards: false, clients: null };

const setAgentContext = (overrides) => Object.assign(agentContext, overrides);

const activeTab = () => document.querySelector('[role="tab"][data-state="active"]')?.getAttribute("data-testid");

beforeEach(() => {
    setAgentContext({ clientId: "", isNewClient: true, configAgent: CONFIG_AGENT });
});

describe("CasesManagement — pestaña activa", () => {
    it("sin nada persistido cae a la primera pestaña disponible", async () => {
        render(<CasesManagement />);
        await waitFor(() => expect(activeTab()).toBe("cases_manager_tab_myassignedcases"));
    });

    it("restaura la pestaña persistida", async () => {
        writePersisted(TAB_NAMESPACE, "boards", SCOPE);

        render(<CasesManagement />);

        await waitFor(() => expect(activeTab()).toBe("cases_manager_tab_boards"));
    });

    it("conserva la pestaña cuando AgentContext siembra clientId de '' a un UUID", async () => {
        /*
         * Reproduce el bug: al volver de un caso, AgentProvider genera un UUID
         * nuevo en un efecto y eso se leia como un cambio de cliente.
         */
        writePersisted(TAB_NAMESPACE, "boards", SCOPE);

        const { rerender } = render(<CasesManagement />);
        await waitFor(() => expect(activeTab()).toBe("cases_manager_tab_boards"));

        setAgentContext({ clientId: "6f1c9f2e-0000-4000-8000-000000000001" });
        rerender(<CasesManagement />);

        await waitFor(() => expect(screen.getByTestId("boards-accordion")).toBeInTheDocument());
        expect(activeTab()).toBe("cases_manager_tab_boards");
    });

    it("reinicia a Mis casos asignados al cambiar de un cliente real a otro", async () => {
        writePersisted(TAB_NAMESPACE, "boards", SCOPE);
        setAgentContext({ clientId: "cliente-a", isNewClient: false });

        const { rerender } = render(<CasesManagement />);
        await waitFor(() => expect(activeTab()).toBe("cases_manager_tab_boards"));

        setAgentContext({ clientId: "cliente-b" });
        rerender(<CasesManagement />);

        await waitFor(() => expect(activeTab()).toBe("cases_manager_tab_myassignedcases"));
    });

    it("cae a la primera pestaña si la persistida ya no está en la configuración", async () => {
        writePersisted(TAB_NAMESPACE, "boards", SCOPE);
        setAgentContext({ configAgent: { ...CONFIG_AGENT, show_boards: false } });

        render(<CasesManagement />);

        await waitFor(() => expect(activeTab()).toBe("cases_manager_tab_myassignedcases"));
    });

    it("no pierde la pestaña restaurada mientras configAgent aún está cargando", async () => {
        writePersisted(TAB_NAMESPACE, "boards", SCOPE);
        setAgentContext({ configAgent: CONFIG_AGENT_LOADING });

        const { rerender } = render(<CasesManagement />);
        expect(document.querySelector('[role="tab"]')).toBeNull();

        setAgentContext({ configAgent: CONFIG_AGENT });
        rerender(<CasesManagement />);

        await waitFor(() => expect(activeTab()).toBe("cases_manager_tab_boards"));
    });
});
