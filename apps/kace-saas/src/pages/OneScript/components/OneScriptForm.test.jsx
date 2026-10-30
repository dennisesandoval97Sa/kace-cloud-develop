import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "i18next";
import useGenericViewQuery from "@/hooks/useGenericViewQuery";
import useGeneralMutation from "@/hooks/useGeneralMutation";
import { OneScriptForm } from "./OneScriptForm";

vi.mock("@/hooks/useGenericViewQuery", () => ({
    default: vi.fn(),
}));

vi.mock("@/hooks/useGeneralMutation", () => ({
    default: vi.fn(),
}));

const modalBehavior = vi.hoisted(() => ({ open: true, idSelected: null }));

vi.mock("react-redux", () => ({
    useSelector: (selector) => selector({ modalBehavior }),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("@/components/core/ModalForm/modal-form", async () => {
    const { Form } = await import("formik");
    return {
        default: ({ children }) => (
            <Form>
                {children}
                <button type="submit">submit</button>
            </Form>
        ),
    };
});

vi.mock("@/componentsV2/lib/SelectFromQuery", () => ({
    default: () => <div data-testid="select_from_query_stub" />,
}));

vi.mock("@kace_v2/shared/hooks/useOneScriptIframeHandshake", () => ({
    useOneScriptIframeHandshake: vi.fn(),
}));

vi.mock("@kace_v2/shared/hooks/useOneScriptHandshakeConfig", () => ({
    useOneScriptHandshakeConfig: () => ({ baseParams: {}, handshakeTokens: {} }),
}));

// The label prop is rendered verbatim because react-i18next is mocked as an identity `t`.
const nameField = () => screen.getByRole("textbox", { name: "oneScript.form.name *" });
const urlField = () => screen.getByRole("textbox", { name: "oneScript.form.url *" });
const formIdField = () => screen.getByRole("textbox", { name: "oneScript.form.form_id *" });

const editLegacyRecord = () => {
    modalBehavior.idSelected = "6b1f0c1e-2d3a-4b5c-8d9e-0f1a2b3c4d5e";
    useGenericViewQuery.mockReturnValue({
        data: {
            id: modalBehavior.idSelected,
            name: "Legacy integration",
            url: "https://example.com/onescript",
            url_api: "https://example.com/api",
            schema_id: null,
            onescript_reference_id: null,
        },
        isLoading: false,
    });
};

afterEach(() => {
    modalBehavior.idSelected = null;
});

describe("OneScriptForm nameContainsScript validation", () => {
    beforeAll(async () => {
        await i18n.changeLanguage("es");
    });

    afterAll(async () => {
        await i18n.changeLanguage("es");
    });

    beforeEach(() => {
        vi.clearAllMocks();
        useGeneralMutation.mockReturnValue({ mutate: vi.fn(), isPending: false });
        useGenericViewQuery.mockReturnValue({ data: undefined, isLoading: false });
    });

    it("shows the translated Spanish error when the name contains 'script'", async () => {
        await i18n.changeLanguage("es");
        const user = userEvent.setup();
        render(<OneScriptForm />);

        await user.type(nameField(), "My script runner");
        await user.tab();

        await waitFor(() => {
            expect(screen.getByText("El nombre no puede contener la palabra 'script'")).toBeInTheDocument();
        });
    });

    it("shows the translated English error when the locale is 'en'", async () => {
        await i18n.changeLanguage("en");
        const user = userEvent.setup();
        render(<OneScriptForm />);

        await user.type(nameField(), "My script runner");
        await user.tab();

        await waitFor(() => {
            expect(screen.getByText("The name cannot contain the word 'script'")).toBeInTheDocument();
        });
    });

    it("does not show the error for a valid name", async () => {
        await i18n.changeLanguage("es");
        const user = userEvent.setup();
        render(<OneScriptForm />);

        await user.type(nameField(), "Valid integration name");
        await user.click(urlField());
        await user.tab();

        /*
         * Confirms the validation cycle actually ran (the still-empty "url" field surfaces its
         * own required error) before asserting the name field has none.
         */
        await waitFor(() => {
            expect(screen.getAllByText("Requerido").length).toBeGreaterThan(0);
        });
        expect(screen.queryByText("El nombre no puede contener la palabra 'script'")).not.toBeInTheDocument();
    });
});

describe("OneScriptForm onescript_reference_id validation", () => {
    const formIdRequired = "Ingrese el ID del formulario OneScript";

    beforeAll(async () => {
        await i18n.changeLanguage("es");
    });

    beforeEach(() => {
        vi.clearAllMocks();
        modalBehavior.idSelected = null;
        useGeneralMutation.mockReturnValue({ mutate: vi.fn(), isPending: false });
        useGenericViewQuery.mockReturnValue({ data: undefined, isLoading: false });
    });

    it("shows the required error when the OneScript form ID is left empty", async () => {
        const user = userEvent.setup();
        render(<OneScriptForm />);

        await user.click(formIdField());
        await user.tab();

        await waitFor(() => {
            expect(screen.getByText(formIdRequired)).toBeInTheDocument();
        });
    });

    it("shows a translated error instead of the raw Joi GUID message for a non-UUID form ID", async () => {
        const user = userEvent.setup();
        render(<OneScriptForm />);

        await user.type(formIdField(), "form-123");
        await user.tab();

        await waitFor(() => {
            expect(screen.getByText("Debe ser un identificador válido (UUID)")).toBeInTheDocument();
        });
        expect(screen.queryByText(/must be a valid GUID/)).not.toBeInTheDocument();
    });

    it("requires the form ID when editing a legacy record saved without it, then saves it", async () => {
        const mutate = vi.fn();
        useGeneralMutation.mockReturnValue({ mutate, isPending: false });
        editLegacyRecord();
        const user = userEvent.setup();
        render(<OneScriptForm />);

        await waitFor(() => {
            expect(nameField()).toHaveValue("Legacy integration");
        });
        expect(formIdField()).toHaveValue("");

        await user.click(screen.getByRole("button", { name: "submit" }));
        await waitFor(() => {
            expect(screen.getByText(formIdRequired)).toBeInTheDocument();
        });
        expect(mutate).not.toHaveBeenCalled();

        await user.type(formIdField(), "3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f");
        await user.click(screen.getByRole("button", { name: "submit" }));

        await waitFor(() => {
            expect(mutate).toHaveBeenCalledTimes(1);
        });
        expect(screen.queryByText(formIdRequired)).not.toBeInTheDocument();
        expect(mutate.mock.calls[0][0].dataPost).toMatchObject({
            name: "Legacy integration",
            onescript_reference_id: "3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
        });
    });
});
