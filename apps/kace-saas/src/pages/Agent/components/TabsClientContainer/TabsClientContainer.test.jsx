import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TabsClientContainer } from "./TabsClientContainer";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("../../context/AgentContext", () => ({
    useAgentContext: vi.fn(),
}));

vi.mock("./components/AuxClientTab", () => ({
    AuxClientTab: () => <div data-testid="aux-client-tab" />,
}));

vi.mock("./components/ClientForm/ClientForm", () => ({
    ClientForm: () => <div data-testid="client-form" />,
}));

import { useAgentContext } from "../../context/AgentContext";

const CUSTOM_FORM_ID = "1d54e65d-f495-4f52-b95e-443b7a81a73b";

const mockClients = (overrides = {}) =>
    useAgentContext.mockReturnValue({
        configAgent: {
            clients: {
                hide_client_form: false,
                custom_form_id: "",
                show_aux_client_expanded: false,
                ...overrides,
            },
        },
    });

describe("TabsClientContainer", () => {
    beforeEach(() => vi.clearAllMocks());

    it("renders ClientForm when hide_client_form is false", () => {
        mockClients();

        render(<TabsClientContainer />);
        expect(screen.getByTestId("client-form")).toBeInTheDocument();
    });

    it("hides ClientForm when hide_client_form is true", () => {
        mockClients({ hide_client_form: true, custom_form_id: CUSTOM_FORM_ID });

        render(<TabsClientContainer />);
        expect(screen.queryByTestId("client-form")).not.toBeInTheDocument();
    });

    it("does not render AuxClientTab when custom_form_id is empty", () => {
        mockClients();

        render(<TabsClientContainer />);
        expect(screen.queryByTestId("aux-client-tab")).not.toBeInTheDocument();
    });

    it("renders AuxClientTab expanded when show_aux_client_expanded is true", () => {
        mockClients({ custom_form_id: CUSTOM_FORM_ID, show_aux_client_expanded: true });

        render(<TabsClientContainer />);
        expect(screen.getByTestId("aux-client-tab")).toBeInTheDocument();
    });

    it("renders AuxClientTab inside accordion when show_aux_client_expanded is false", () => {
        mockClients({ custom_form_id: CUSTOM_FORM_ID });

        render(<TabsClientContainer />);
        expect(screen.queryByTestId("aux-client-tab")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /agent\.title\.auxClient/i }));
        expect(screen.getByTestId("aux-client-tab")).toBeInTheDocument();
    });

    it("hides ClientForm and shows AuxClientTab expanded together", () => {
        mockClients({ hide_client_form: true, custom_form_id: CUSTOM_FORM_ID, show_aux_client_expanded: true });

        render(<TabsClientContainer />);
        expect(screen.queryByTestId("client-form")).not.toBeInTheDocument();
        expect(screen.getByTestId("aux-client-tab")).toBeInTheDocument();
    });
});
