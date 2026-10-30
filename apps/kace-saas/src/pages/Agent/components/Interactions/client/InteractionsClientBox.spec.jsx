import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InteractionsClientBox from "./InteractionsClientBox";

const mocks = vi.hoisted(() => ({
    dispatch: vi.fn(),
    navigate: vi.fn(),
    client: {
        id: "client-1",
        nombres: "Cliente Demo",
    },
    isLoading: false,
    isPending: false,
    agentContext: {
        clientId: "",
        dataUserSelected: {},
        isNewClient: true,
    },
}));

vi.mock("react-redux", () => ({
    useDispatch: () => mocks.dispatch,
}));

vi.mock("react-router-dom", () => ({
    useNavigate: () => mocks.navigate,
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) =>
            ({
                "button.newCase": "Create Case",
                "interactions.client.customerData": "Customer Data",
                "interactions.client.document": "Document",
                "interactions.client.name": "Name",
                "interactions.client.noSelectedClient": "No selected Client",
                "interactions.client.selectedClient": "Selected Client",
                "interactions.client.searchingSuggestedClient": "Searching for a matching Client",
                "interactions.client.searchingSuggestedClientDescription":
                    "Checking the Interaction sender email before you select or create a Client.",
                "interactions.cases.associateCase": "Associate Case",
                "interactions.cases.associateCases": "Associate with Cases",
                "genericTexts.loading": "Loading",
            })[key] ?? key,
    }),
}));

vi.mock("./hooks/useInteractionClient", () => ({
    useInteractionClient: () => ({
        assignClient: vi.fn(),
        isPending: mocks.isPending,
    }),
}));

vi.mock("../../../context/AgentContext", () => ({
    useAgentContext: () => mocks.agentContext,
}));

vi.mock("../../TabsClientContainer/components/ClientForm/ClientForm", () => ({
    ClientForm: ({ client }) => <div data-testid="client-form">{client?.id}</div>,
}));

vi.mock("../cases/LinkedInteractionCasesList", () => ({
    default: ({ cases }) => <div data-testid="linked-cases-list">{cases.length}</div>,
}));

vi.mock("../utils/CreateClientButton", () => ({
    default: ({ label, onClick, disabled }) => (
        <button type="button" onClick={onClick} disabled={disabled}>
            {label}
        </button>
    ),
}));

vi.mock("../utils/openCaseAction", () => ({
    openCaseAction: vi.fn(),
}));

vi.mock("@/components/ui-shared", () => ({
    Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

describe("InteractionsClientBox", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.client = {
            id: "client-1",
            nombres: "Cliente Demo",
        };
        mocks.isLoading = false;
        mocks.isPending = false;
        mocks.agentContext = {
            clientId: "",
            dataUserSelected: {},
            isNewClient: true,
        };
    });

    it("does not use a client found by sender email to create a case without a selected agent client", () => {
        render(
            <InteractionsClientBox
                interactionEmail="cliente@demo.com"
                interaction={{ id: "interaction-1", is_closed: false }}
            />,
        );

        expect(screen.queryByRole("button", { name: /create case/i })).not.toBeInTheDocument();
        expect(screen.queryByTestId("client-form")).not.toBeInTheDocument();
    });

    it("keeps selected client visible without duplicate client form or case actions", () => {
        mocks.client = null;
        mocks.agentContext = {
            clientId: "selected-client-1",
            dataUserSelected: {
                id: "selected-client-1",
                nombres: "Juan Zapata",
            },
            isNewClient: false,
        };

        render(
            <InteractionsClientBox
                interactionEmail="no-reply@example.com"
                interaction={{ id: "interaction-1", is_closed: false }}
                linkedCases={[{ id: "case-1" }]}
                linkedCaseIds={["case-1"]}
                canAssociateCase
                canCreateCase
                onAssociateSuccess={vi.fn()}
            />,
        );

        expect(screen.getByText("Selected Client")).toBeInTheDocument();
        expect(screen.getByText("Juan Zapata")).toBeInTheDocument();
        expect(screen.queryByTestId("client-form")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /create case/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /associate case/i })).not.toBeInTheDocument();
    });

    it("shows the empty selected-client state instead of waiting for sender-email client lookup", () => {
        mocks.isLoading = true;
        mocks.client = {
            id: "client-from-email",
            nombres: "Cliente por correo",
        };

        render(
            <InteractionsClientBox
                interactionEmail="cliente@demo.com"
                interaction={{ id: "interaction-1", is_closed: false }}
            />,
        );

        expect(screen.queryByText("Loading")).not.toBeInTheDocument();
        expect(screen.getByText("No selected Client")).toBeInTheDocument();
        expect(screen.getByText("cliente@demo.com")).toBeInTheDocument();
        expect(screen.queryByTestId("client-form")).not.toBeInTheDocument();
    });

    it("shows a sender-email Client search status while lookup is running", () => {
        render(
            <InteractionsClientBox
                interactionEmail="cliente@demo.com"
                interaction={{ id: "interaction-1", is_closed: false }}
                isSearchingSuggestedClient
            />,
        );

        expect(screen.getByRole("status")).toHaveTextContent("Searching for a matching Client");
        expect(
            screen.getByText("Checking the Interaction sender email before you select or create a Client."),
        ).toBeInTheDocument();
    });

    it("does not open the shared associate case modal from the client panel", async () => {
        mocks.agentContext = {
            clientId: "selected-client-1",
            dataUserSelected: { id: "selected-client-1", nombres: "Juan Zapata" },
            isNewClient: false,
        };

        render(
            <InteractionsClientBox
                interactionEmail="cliente@demo.com"
                interaction={{ id: "interaction-1", is_closed: false }}
                linkedCases={[]}
                linkedCaseIds={[]}
                canAssociateCase
                canCreateCase
                onAssociateSuccess={vi.fn()}
            />,
        );

        expect(screen.queryByRole("button", { name: /associate case/i })).not.toBeInTheDocument();
        expect(screen.queryByTestId("associate-case-modal")).not.toBeInTheDocument();
    });
});
