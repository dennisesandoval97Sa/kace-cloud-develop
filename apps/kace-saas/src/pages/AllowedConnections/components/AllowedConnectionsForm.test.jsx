import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useGenericViewQuery from "@/hooks/useGenericViewQuery";
import useGeneralMutation from "@/hooks/useGeneralMutation";
import AllowedConnectionsForm from "./AllowedConnectionsForm";

vi.mock("@/hooks/useGenericViewQuery", () => ({
    default: vi.fn(),
}));

vi.mock("@/hooks/useGeneralMutation", () => ({
    default: vi.fn(),
}));

vi.mock("react-redux", () => ({
    useDispatch: () => vi.fn(),
    useSelector: (selector) =>
        selector({
            modalBehavior: {
                open: true,
                idSelected: null,
                canBeEdit: true,
            },
        }),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("@/components/core/ModalForm/modal-form", () => ({
    default: ({ children }) => <div>{children}</div>,
}));

const connection = {
    id: "3c8f195c-a9dd-4a7f-b100-66afe5b3cc29",
    description: "Instagram url test",
    connection: "instagram.com",
    certificate: "12341234",
    is_active: true,
    has_ssl: false,
};

describe("AllowedConnectionsForm HTTPS fingerprint", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useGeneralMutation.mockReturnValue({ mutate: vi.fn(), isPending: false });
    });

    it("hides a persisted fingerprint and disables the field when HTTPS is inactive", async () => {
        useGenericViewQuery.mockReturnValue({ data: connection, isLoading: false });

        render(<AllowedConnectionsForm />);

        const fingerprint = screen.getByTestId("input_form_modal_certificate");
        await waitFor(() => expect(fingerprint).toHaveValue(""));
        expect(fingerprint).toBeDisabled();
    });

    it("clears and disables the fingerprint when HTTPS is turned off", async () => {
        const user = userEvent.setup();
        useGenericViewQuery.mockReturnValue({
            data: { ...connection, has_ssl: true },
            isLoading: false,
        });

        render(<AllowedConnectionsForm />);

        const fingerprint = screen.getByTestId("input_form_modal_certificate");
        await waitFor(() => expect(fingerprint).toHaveValue("12341234"));
        expect(fingerprint).toBeEnabled();

        await user.clear(fingerprint);
        await user.type(fingerprint, "updated-fingerprint");
        await user.click(screen.getByRole("switch"));

        expect(fingerprint).toHaveValue("");
        expect(fingerprint).toBeDisabled();
        expect(screen.queryByText("Required")).not.toBeInTheDocument();
    });

    it("clears the fingerprint error when HTTPS is turned off after entering a value", async () => {
        const user = userEvent.setup();
        useGenericViewQuery.mockReturnValue({ data: undefined, isLoading: false });

        render(<AllowedConnectionsForm />);

        const fingerprint = screen.getByTestId("input_form_modal_certificate");
        const httpsSwitch = screen.getByRole("switch");

        await user.click(httpsSwitch);
        await user.type(fingerprint, "12341234");
        await user.click(httpsSwitch);

        expect(fingerprint).toHaveValue("");
        expect(fingerprint).toBeDisabled();
        expect(screen.queryByText("Required")).not.toBeInTheDocument();
    });
});
