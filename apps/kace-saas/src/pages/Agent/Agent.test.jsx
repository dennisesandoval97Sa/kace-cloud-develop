import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Agent from "./Agent";
import { useAgentContext } from "./context/AgentContext";

vi.mock("./context/AgentContext", () => ({
    AgentProvider: ({ children }) => children,
    useAgentContext: vi.fn(),
}));

vi.mock("./components/TabsClientContainer/TabsClientContainer", () => ({
    TabsClientContainer: () => <div data-testid="tabs-client-container" />,
}));

vi.mock("./components/CasesManagement/CasesManagement", () => ({
    CasesManagement: () => <div data-testid="cases-management" />,
}));

describe("Agent", () => {
    beforeEach(() => vi.clearAllMocks());

    it.each([false, true])("keeps TabsClientContainer when show_client_data is %s", (showClientData) => {
        useAgentContext.mockReturnValue({
            configAgent: { show_client_data: showClientData },
        });

        render(<Agent />);

        expect(screen.getByTestId("tabs-client-container")).toBeInTheDocument();
        expect(screen.getByTestId("cases-management")).toBeInTheDocument();
    });
});
