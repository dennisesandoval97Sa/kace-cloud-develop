import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FilterUsersMultiselect from "./FilterUsersMultiselect";

const hookState = vi.hoisted(() => ({ current: {} }));

vi.mock("./useUsersFilterOptions", () => ({
    useUsersFilterOptions: () => hookState.current,
}));

vi.mock("@/componentsV2/core/MultiSelect", () => ({
    default: ({ options, selectedData, onSelectOption, onSelectedAll, onDeselectAll }) => (
        <div>
            <div data-testid="selected-labels">{selectedData.map((item) => item.label).join(",")}</div>
            {options.map((option) => (
                <button key={option.id} type="button" onClick={() => onSelectOption(option.id)}>
                    {option.label}
                </button>
            ))}
            <button type="button" onClick={onSelectedAll}>
                select-all
            </button>
            <button type="button" onClick={onDeselectAll}>
                deselect-all
            </button>
        </div>
    ),
}));

const baseHook = (overrides = {}) => ({
    usersOptions: [
        { id: "1", label: "Ana Pérez" },
        { id: "2", label: "Bruno Díaz" },
    ],
    isLoadingUsers: false,
    fetchNextUsers: vi.fn(),
    hasNextPageUsers: false,
    isFetchingNextPageUsers: false,
    onSearchUsers: vi.fn(),
    ...overrides,
});

describe("FilterUsersMultiselect", () => {
    it("emite CSV de ids y conserva etiquetas ya vistas tras cambiar las opciones", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        hookState.current = baseHook();
        const { rerender } = render(<FilterUsersMultiselect value="" onChange={onChange} />);

        await user.click(screen.getByText("Ana Pérez"));
        expect(onChange).toHaveBeenLastCalledWith("1", "Ana Pérez");

        hookState.current = baseHook({
            usersOptions: [{ id: "2", label: "Bruno Díaz" }],
        });
        rerender(<FilterUsersMultiselect value="1" onChange={onChange} />);

        expect(screen.getByTestId("selected-labels")).toHaveTextContent("Ana Pérez");

        await user.click(screen.getByText("Bruno Díaz"));
        expect(onChange).toHaveBeenLastCalledWith("1,2", "Ana Pérez, Bruno Díaz");
    });

    it("une los visibles al select-all sin borrar la seleccion previa", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        hookState.current = baseHook({
            usersOptions: [{ id: "2", label: "Bruno Díaz" }],
            hasNextPageUsers: true,
        });
        render(<FilterUsersMultiselect value="1" onChange={onChange} />);

        await user.click(screen.getByText("select-all"));
        expect(onChange).toHaveBeenCalledWith("1,2", "Bruno Díaz");
    });

    it("quita solo lo visible cuando todo lo cargado ya esta seleccionado", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        hookState.current = baseHook({
            usersOptions: [{ id: "1", label: "Ana Pérez" }],
            hasNextPageUsers: false,
        });
        render(<FilterUsersMultiselect value="1,9" onChange={onChange} />);

        await user.click(screen.getByText("select-all"));
        expect(onChange).toHaveBeenCalledWith("9", "");
    });

    it("limpia toda la seleccion, incluso los usuarios que no estan cargados", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        hookState.current = baseHook({ usersOptions: [{ id: "1", label: "Ana Pérez" }] });
        render(<FilterUsersMultiselect value="1,9" onChange={onChange} />);

        await user.click(screen.getByText("deselect-all"));

        expect(onChange).toHaveBeenCalledWith("", "");
    });
});
