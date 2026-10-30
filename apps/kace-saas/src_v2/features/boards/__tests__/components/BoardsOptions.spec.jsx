import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BoardsOptions from "@kace_v2/features/boards/components/BoardsOptions";

const ACTION_1 = "11111111-1111-4111-8111-111111111111";
const ACTION_2 = "22222222-2222-4222-8222-222222222222";

const actionOptions = [
    { label: "Accion 1", value: ACTION_1 },
    { label: "Accion 2", value: ACTION_2 },
];

vi.mock("@kace_v2/features/boards/hooks/useBoardsOptions.hook", () => ({
    default: () => ({
        options: {
            ACTION: actionOptions,
            RESTFLOW: [],
            ONESCRIPT: [],
        },
        selectors: {
            ACTION: { options: actionOptions, onSearch: vi.fn(), fetchNextPage: vi.fn() },
            RESTFLOW: { options: [], onSearch: vi.fn(), fetchNextPage: vi.fn() },
            ONESCRIPT: { options: [], onSearch: vi.fn(), fetchNextPage: vi.fn() },
        },
    }),
}));

vi.mock("@kace_v2/shared/ui/molecules/CreateModalButton", () => ({
    default: ({ children, open, onOpenChange }) => (
        <div>
            <button type="button" onClick={() => onOpenChange?.(true)}>
                Nueva opcion
            </button>
            {open ? <div data-testid="boards-options-modal">{children}</div> : null}
        </div>
    ),
}));

vi.mock("@kace_v2/shared/ui/molecules/DropdownMenu", () => ({
    default: ({ options, onSelect }) => (
        <div>
            {options?.map((option) => (
                <button key={option.label} type="button" onClick={() => onSelect(option)}>
                    {option.label}
                </button>
            ))}
        </div>
    ),
}));

vi.mock("@kace_v2/shared/ui/molecules/SelectField", () => ({
    default: ({ label, name, value, onValueChange, options = [] }) => (
        <label>
            {label}
            <select
                aria-label={label}
                name={name}
                value={value || ""}
                onChange={(event) => onValueChange(event.target.value)}
            >
                <option value="">Seleccione...</option>
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    ),
}));

const existingOption = {
    id: "row-1",
    type: "ACTION",
    ref_id: ACTION_1,
    label: "Etiqueta vieja",
    requires_confirmation: false,
};

describe("BoardsOptions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("al editar reemplaza la fila actual aunque cambie la opcion del menu", async () => {
        const onSubmit = vi.fn();
        const user = userEvent.setup();

        render(<BoardsOptions initialData={[existingOption]} primaryEntity="cases" onSubmit={onSubmit} />);

        await user.click(screen.getByRole("button", { name: "Editar" }));
        await user.selectOptions(screen.getByLabelText("Action"), ACTION_2);
        await user.click(screen.getByRole("button", { name: "Agregar" }));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());

        const nextRows = onSubmit.mock.calls.at(-1)[0];
        expect(nextRows).toHaveLength(1);
        expect(nextRows[0]).toMatchObject({
            id: "row-1",
            type: "ACTION",
            ref_id: ACTION_2,
            label: "Etiqueta vieja",
        });
    });

    it("al editar una opcion cargada sin id reemplaza esa fila y no agrega otra", async () => {
        const onSubmit = vi.fn();
        const user = userEvent.setup();
        const fromApi = {
            type: "ACTION",
            ref_id: ACTION_1,
            label: "Etiqueta vieja",
            requires_confirmation: false,
        };

        render(<BoardsOptions initialData={[fromApi]} primaryEntity="cases" onSubmit={onSubmit} />);

        await user.click(screen.getByRole("button", { name: "Editar" }));
        await user.selectOptions(screen.getByLabelText("Action"), ACTION_2);
        await user.click(screen.getByRole("button", { name: "Agregar" }));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());

        const nextRows = onSubmit.mock.calls.at(-1)[0];
        expect(nextRows).toHaveLength(1);
        expect(nextRows[0]).toMatchObject({
            type: "ACTION",
            ref_id: ACTION_2,
            label: "Etiqueta vieja",
        });
        expect(nextRows[0].id).toBeTruthy();
    });

    it("al agregar una opcion nueva la anade sin reemplazar las existentes", async () => {
        const onSubmit = vi.fn();
        const user = userEvent.setup();

        render(<BoardsOptions initialData={[existingOption]} primaryEntity="cases" onSubmit={onSubmit} />);

        await user.click(screen.getByRole("button", { name: "Nueva opcion" }));
        await user.selectOptions(screen.getByLabelText("Tipo"), "ACTION");
        await user.selectOptions(screen.getByLabelText("Action"), ACTION_2);
        await user.type(screen.getByPlaceholderText("etiqueta"), "Etiqueta nueva");
        await user.click(screen.getByRole("button", { name: "Agregar" }));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());

        const nextRows = onSubmit.mock.calls.at(-1)[0];
        expect(nextRows).toHaveLength(2);
        expect(nextRows[0]).toMatchObject({ id: "row-1", ref_id: ACTION_1 });
        expect(nextRows[1]).toMatchObject({
            type: "ACTION",
            ref_id: ACTION_2,
            label: "Etiqueta nueva",
        });
        expect(nextRows[1].id).toBeTruthy();
        expect(nextRows[1].id).not.toBe("row-1");
    });
});
