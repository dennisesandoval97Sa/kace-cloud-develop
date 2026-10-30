/* eslint-disable react/prop-types */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CasesManagement } from "./CasesManagement";

const mockUseAgentContext = vi.fn();
const mockUseUserInformation = vi.fn();
let mockLocation = { search: "" };

vi.mock("@kace/ui-shared", () => ({
    Tabs: ({ children, value }) => (
        <div data-testid="cases-management-tabs" data-value={value}>
            {children}
        </div>
    ),
    TabsContent: ({ children }) => <div>{children}</div>,
    TabsList: ({ children }) => <div>{children}</div>,
    TabsTrigger: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

vi.mock("lucide-react", () => ({
    Archive: () => <span aria-hidden="true" />,
    LayoutGrid: () => <span aria-hidden="true" />,
    UserCheck: () => <span aria-hidden="true" />,
    UserCog: () => <span aria-hidden="true" />,
}));

vi.mock("../../context/AgentContext", () => ({
    useAgentContext: () => mockUseAgentContext(),
}));

vi.mock("../../../../hooks/useUserInformation", () => ({
    default: () => mockUseUserInformation(),
}));

vi.mock("react-router-dom", () => ({
    useLocation: () => mockLocation,
}));

vi.mock("./components/AgentTableContainer", () => ({
    AgentTableContainer: () => <div>Agent cases</div>,
}));

vi.mock("./components/UserTableContainer", () => ({
    UserTableContainer: () => <div>User cases</div>,
}));

vi.mock("./components/BoardsAccordion", () => ({
    default: () => <div>Boards</div>,
}));

vi.mock("../Interactions/InteractionsHandler", () => ({
    default: () => <div>Interactions content</div>,
}));

describe("CasesManagement", () => {
    beforeEach(() => {
        mockLocation = { search: "" };
    });

    it("shows the interactions tab when the shared agent interactions flag is enabled", () => {
        mockUseAgentContext.mockReturnValue({
            clientId: "client-1",
            isNewClient: false,
            configAgent: {
                show_interactions: true,
                show_agent_interactions: false,
                enable_custom_view: false,
                clients: {},
            },
        });
        mockUseUserInformation.mockReturnValue({
            permissionsAgent: [],
            user: { id: "user-1" },
        });

        render(<CasesManagement />);

        expect(screen.getByRole("button", { name: "Interactions" })).toBeInTheDocument();
        expect(screen.getByText("Interactions content")).toBeInTheDocument();
    });

    it("selects the interactions tab when the agent route has an interaction search context", () => {
        mockLocation = { search: "?search=pagos&page=2" };
        mockUseAgentContext.mockReturnValue({
            clientId: "client-1",
            isNewClient: false,
            configAgent: {
                show_interactions: true,
                show_agent_interactions: false,
                enable_custom_view: false,
                clients: {},
            },
        });
        mockUseUserInformation.mockReturnValue({
            permissionsAgent: [],
            user: { id: "user-1" },
        });

        render(<CasesManagement />);

        expect(screen.getByRole("button", { name: "Interactions" })).toBeInTheDocument();
        expect(screen.getByTestId("cases-management-tabs")).toHaveAttribute("data-value", "interaction");
        expect(screen.getByText("Interactions content")).toBeInTheDocument();
    });

    it("selects the interactions tab when the agent route only has the current-agent reviews context", () => {
        mockLocation = { search: "?my_reviews=true" };
        mockUseAgentContext.mockReturnValue({
            clientId: "client-1",
            isNewClient: false,
            configAgent: {
                show_interactions: true,
                show_agent_interactions: false,
                enable_custom_view: false,
                clients: {},
            },
        });
        mockUseUserInformation.mockReturnValue({
            permissionsAgent: [],
            user: { id: "user-1" },
        });

        render(<CasesManagement />);

        expect(screen.getByTestId("cases-management-tabs")).toHaveAttribute("data-value", "interaction");
    });
});
