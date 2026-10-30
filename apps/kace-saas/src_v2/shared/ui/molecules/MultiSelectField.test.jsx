import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MultiSelectField from "@kace_v2/shared/ui/molecules/MultiSelectField";

vi.mock("react-intersection-observer", () => ({
    useInView: () => ({ ref: () => {}, inView: true }),
}));

const baseProps = (overrides = {}) => ({
    label: "Usuarios",
    selectedValues: [],
    defaultOptions: [],
    onChange: vi.fn(),
    onSearch: vi.fn().mockResolvedValue([]),
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    ...overrides,
});

const openPopover = () => {
    fireEvent.click(screen.getByRole("button", { name: /seleccionar opciones/i }));
};

describe("MultiSelectField hasNextPage contract", () => {
    it("no llama fetchNextPage cuando hasNextPage=false aunque el sentinel este en vista", () => {
        const fetchNextPage = vi.fn();
        render(<MultiSelectField {...baseProps({ fetchNextPage, hasNextPage: false })} />);

        openPopover();

        expect(fetchNextPage).not.toHaveBeenCalled();
    });

    it("llama fetchNextPage cuando hasNextPage=true y el sentinel esta en vista", () => {
        const fetchNextPage = vi.fn();
        render(<MultiSelectField {...baseProps({ fetchNextPage, hasNextPage: true })} />);

        openPopover();

        expect(fetchNextPage).toHaveBeenCalled();
    });

    it("llama fetchNextPage cuando hasNextPage cambia a true con el sentinel ya en vista", () => {
        const fetchNextPage = vi.fn();
        const { rerender } = render(<MultiSelectField {...baseProps({ fetchNextPage, hasNextPage: false })} />);

        openPopover();

        expect(fetchNextPage).not.toHaveBeenCalled();

        rerender(<MultiSelectField {...baseProps({ fetchNextPage, hasNextPage: true })} />);

        expect(fetchNextPage).toHaveBeenCalledTimes(1);
    });

    it("un valor truthy no-booleano (regresion del bug hasNextPage={{ hasNextPage }}) dispara fetchNextPage aunque no deberia", () => {
        /*
         * Este test documenta por que el contrato debe ser booleano: si un consumidor
         * vuelve a pasar un objeto en vez de un booleano, aqui se ve la regresion.
         */
        const fetchNextPage = vi.fn();
        render(<MultiSelectField {...baseProps({ fetchNextPage, hasNextPage: { hasNextPage: false } })} />);

        openPopover();

        expect(fetchNextPage).toHaveBeenCalled();
    });
});

describe("MultiSelectField search error state", () => {
    it("muestra un mensaje de error distinto al de 'sin resultados' cuando onSearch falla", async () => {
        const onSearch = vi.fn().mockRejectedValue(new Error("network error"));
        render(<MultiSelectField {...baseProps({ onSearch })} />);

        openPopover();
        fireEvent.change(screen.getByPlaceholderText("Buscar..."), { target: { value: "juan" } });

        await waitFor(() => expect(screen.getByText(/ocurrió un error al buscar/i)).toBeInTheDocument());
        expect(screen.queryByText("No se encontraron opciones")).not.toBeInTheDocument();
    });

    it("limpia el estado de error cuando se borra la busqueda", async () => {
        const onSearch = vi.fn().mockRejectedValue(new Error("network error"));
        render(<MultiSelectField {...baseProps({ onSearch })} />);

        openPopover();
        const input = screen.getByPlaceholderText("Buscar...");
        fireEvent.change(input, { target: { value: "juan" } });
        await waitFor(() => expect(screen.getByText(/ocurrió un error al buscar/i)).toBeInTheDocument());

        fireEvent.change(input, { target: { value: "" } });

        expect(screen.queryByText(/ocurrió un error al buscar/i)).not.toBeInTheDocument();
    });

    it("no muestra el error cuando onSearch resuelve sin resultados", async () => {
        const onSearch = vi.fn().mockResolvedValue([]);
        render(<MultiSelectField {...baseProps({ onSearch })} />);

        openPopover();
        fireEvent.change(screen.getByPlaceholderText("Buscar..."), { target: { value: "juan" } });

        await waitFor(() => expect(screen.getByText("No se encontraron opciones")).toBeInTheDocument());
        expect(screen.queryByText(/ocurrió un error al buscar/i)).not.toBeInTheDocument();
    });
});
