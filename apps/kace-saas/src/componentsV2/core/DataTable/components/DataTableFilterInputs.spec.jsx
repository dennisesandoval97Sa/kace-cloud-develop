import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SPECIAL_FIELDS } from "@/services/createSchemaFilter";
import DataTableFilterInputs from "./DataTableFilterInputs";

vi.mock("@kace/utils", () => ({
    CLASSIFICATION_LEVELS_SERVICE: "/classifications-levels",
    apiService: {
        get: vi.fn().mockResolvedValue({ data: { data: { items: ["MEXICO", "COLOMBIA"] } } }),
    },
}));

Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    releasePointerCapture: { configurable: true, value: () => {} },
    scrollIntoView: { configurable: true, value: () => {} },
    setPointerCapture: { configurable: true, value: () => {} },
});

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) =>
            ({
                "app.forms.all": "Todos",
                "app.forms.active": "Activo",
                "app.forms.inactive": "Inactivo",
                "app.text.selectLevel": "Seleccionar nivel",
                "globalConfigLabels.clasificaciones.nivel1": "Nivel 1",
            })[key] ?? key,
    }),
}));

const render = (ui, options) => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return rtlRender(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>, options);
};

const filterData = {
    field: "mail_accounts.is_active",
    operator: "eq",
    type: "AND",
    value: "",
};

describe("DataTableFilterInputs state compatibility", () => {
    it.each([
        [1, "Activo"],
        ["1", "Activo"],
        [0, "Inactivo"],
        ["0", "Inactivo"],
    ])("hydrates legacy boolean state value %s as %s", async (legacyValue, expectedLabel) => {
        render(
            <DataTableFilterInputs
                type={SPECIAL_FIELDS.switch_state}
                label="Estado"
                name="is_active"
                value={{ ...filterData, value: legacyValue }}
                filterData={filterData}
                handle={vi.fn()}
                fieldType="Boolean"
                schemaColumnType="Boolean"
            />,
        );

        await waitFor(() => expect(screen.getByTestId("btn_select_list_content")).toHaveTextContent(expectedLabel));
    });

    it("updates the displayed state when a saved preset is selected", async () => {
        const props = {
            type: SPECIAL_FIELDS.switch_state,
            label: "Estado",
            name: "is_active",
            filterData,
            handle: vi.fn(),
            fieldType: "Boolean",
            schemaColumnType: "Boolean",
        };
        const { rerender } = render(<DataTableFilterInputs {...props} value={null} />);

        expect(screen.getByTestId("btn_select_list_content")).toHaveTextContent("Todos");

        rerender(<DataTableFilterInputs {...props} value={{ ...filterData, value: 0 }} />);

        await waitFor(() => expect(screen.getByTestId("btn_select_list_content")).toHaveTextContent("Inactivo"));
    });

    it.each([
        ["eq", 1, "Activo"],
        ["neq", 1, "Inactivo"],
    ])("hydrates numeric state operator %s with value %s as %s", async (operator, stateValue, expectedLabel) => {
        render(
            <DataTableFilterInputs
                type={SPECIAL_FIELDS.switch_state}
                label="Estado"
                name="is_active"
                value={{ ...filterData, operator, value: stateValue }}
                filterData={filterData}
                handle={vi.fn()}
                fieldType="Integer"
                schemaColumnType="Integer"
            />,
        );

        await waitFor(() => expect(screen.getByTestId("btn_select_list_content")).toHaveTextContent(expectedLabel));
    });

    it("emits numeric Inactive as not equal to the active status", async () => {
        const handle = vi.fn();
        const user = userEvent.setup();
        render(
            <DataTableFilterInputs
                type={SPECIAL_FIELDS.switch_state}
                label="Estado"
                name="is_active"
                value={null}
                filterData={filterData}
                handle={handle}
                fieldType="Integer"
                schemaColumnType="Integer"
            />,
        );

        await user.click(screen.getByTestId("btn_select_list_content"));
        await user.click(await screen.findByText("Inactivo"));

        expect(handle).toHaveBeenCalledWith("is_active", {
            ...filterData,
            operator: "neq",
            value: 1,
            label: "Inactivo",
        });
    });

    it.each([
        ["Activo", "true"],
        ["Inactivo", "false"],
    ])("emits the boolean filter represented by %s", async (optionLabel, expectedValue) => {
        const handle = vi.fn();
        const user = userEvent.setup();
        render(
            <DataTableFilterInputs
                type={SPECIAL_FIELDS.switch_state}
                label="Estado"
                name="is_active"
                value={null}
                filterData={filterData}
                handle={handle}
                fieldType="Boolean"
                schemaColumnType="Boolean"
            />,
        );

        await user.click(screen.getByTestId("btn_select_list_content"));
        await user.click(await screen.findByText(optionLabel));

        expect(handle).toHaveBeenCalledWith("is_active", {
            ...filterData,
            operator: "eq",
            value: expectedValue,
            label: optionLabel,
        });
    });

    it("removes the state filter when All is selected", async () => {
        const handle = vi.fn();
        const user = userEvent.setup();
        render(
            <DataTableFilterInputs
                type={SPECIAL_FIELDS.switch_state}
                label="Estado"
                name="is_active"
                value={{ ...filterData, value: "true" }}
                filterData={filterData}
                handle={handle}
                fieldType="Boolean"
                schemaColumnType="Boolean"
            />,
        );

        await user.click(screen.getByTestId("btn_select_list_content"));
        await user.click(await screen.findByText("Todos"));

        expect(handle).toHaveBeenCalledWith("is_active", {
            ...filterData,
            operator: "eq",
            value: "",
            label: "Todos",
        });
    });
});

describe("DataTableFilterInputs saved list compatibility", () => {
    it("updates the selected list option when a saved preset is selected", async () => {
        const listFilterData = {
            field: "mail_accounts.protocol",
            operator: "eq",
            type: "AND",
            value: "",
        };
        const props = {
            type: SPECIAL_FIELDS.list,
            label: "Protocol",
            name: "protocol",
            options: [
                { value: "smtp", name: "SMTP" },
                { value: "imap", name: "IMAP" },
            ],
            filterData: listFilterData,
            handle: vi.fn(),
        };
        const { rerender } = render(<DataTableFilterInputs {...props} value={{ ...listFilterData, value: "smtp" }} />);

        await waitFor(() => expect(screen.getByTestId("btn_select_list_content")).toHaveTextContent("SMTP"));

        rerender(<DataTableFilterInputs {...props} value={{ ...listFilterData, value: "imap" }} />);

        await waitFor(() => expect(screen.getByTestId("btn_select_list_content")).toHaveTextContent("IMAP"));
    });
});

describe("DataTableFilterInputs number compatibility", () => {
    const numberFilterData = {
        field: "ans.intermedio",
        operator: "eq",
        type: "AND",
        value: "",
    };

    it("keeps a cleared numeric filter empty", async () => {
        const handle = vi.fn();
        const user = userEvent.setup();

        render(
            <DataTableFilterInputs
                type={SPECIAL_FIELDS.number}
                label="Intermediate"
                name="intermedio"
                value={{ ...numberFilterData, value: 5 }}
                filterData={numberFilterData}
                handle={handle}
            />,
        );

        await user.clear(screen.getByRole("spinbutton"));

        expect(handle).toHaveBeenLastCalledWith("intermedio", {
            ...numberFilterData,
            value: "",
        });
    });

    it("keeps an entered numeric zero as the number zero", async () => {
        const handle = vi.fn();
        const user = userEvent.setup();

        render(
            <DataTableFilterInputs
                type={SPECIAL_FIELDS.number}
                label="Intermediate"
                name="intermedio"
                value={null}
                filterData={numberFilterData}
                handle={handle}
            />,
        );

        await user.type(screen.getByRole("spinbutton"), "0");

        expect(handle).toHaveBeenLastCalledWith("intermedio", {
            ...numberFilterData,
            value: 0,
        });
    });
});

describe("DataTableFilterInputs classification_levels compatibility", () => {
    const classificationFilterData = {
        field: "clasificaciones.nivel1",
        operator: "ilike",
        type: "AND",
        value: "",
    };

    it("handles classification level selection and emits correctly formatted filter", () => {
        const handle = vi.fn();
        render(
            <DataTableFilterInputs
                type={SPECIAL_FIELDS.classification_levels}
                label="ByLevel"
                name="nivel1"
                value={null}
                filterData={classificationFilterData}
                handle={handle}
            />,
        );

        expect(screen.getByTestId("btn_select_levels")).toBeInTheDocument();
    });

    it("hydrates correctly with saved classification preset descriptor", () => {
        const handle = vi.fn();
        render(
            <DataTableFilterInputs
                type={SPECIAL_FIELDS.classification_levels}
                label="ByLevel"
                name="nivel1"
                value={{
                    field: "clasificaciones.nivel1",
                    operator: "ilike",
                    type: "AND",
                    value: "MEXICO",
                }}
                filterData={classificationFilterData}
                handle={handle}
            />,
        );

        expect(screen.getByTestId("select_list_categories")).toHaveTextContent("Nivel 1");
    });
});
