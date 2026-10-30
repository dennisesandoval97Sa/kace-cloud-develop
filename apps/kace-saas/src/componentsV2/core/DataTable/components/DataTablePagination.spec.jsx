import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DataTablePagination from "./DataTablePagination";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key, values = {}) => {
            const translations = {
                "button.previous": "Anterior",
                "button.next": "Siguiente",
                "dataTable.pagination.pageOf": `Página ${values.page} de ${values.totalPages}`,
                "dataTable.pagination.records": `Registros: ${values.totalRecords}`,
                "dataTable.pagination.first": "Primera",
                "dataTable.pagination.last": "Última",
                "dataTable.pagination.pageSize": "Filas por página",
                "dataTable.pagination.goToPage": "Ir a página",
                "dataTable.pagination.go": "Ir",
                "dataTable.pagination.jumpBackward": "-10",
                "dataTable.pagination.jumpForward": "+10",
                "dataTable.pagination.jumpBackwardAriaLabel": "Atrás 10 páginas",
                "dataTable.pagination.jumpForwardAriaLabel": "Adelante 10 páginas",
            };

            return translations[key] ?? key;
        },
    }),
}));

describe("DataTablePagination", () => {
    it("renders page status, page-size selector, and navigation buttons", () => {
        render(
            <DataTablePagination
                onFirstPage={vi.fn()}
                onPreviousPage={vi.fn()}
                onNextPage={vi.fn()}
                onLastPage={vi.fn()}
                onPageSizeChange={vi.fn()}
                onGoToPage={vi.fn()}
                page={2}
                totalPages={5}
                totalRecords={42}
                pageSize={25}
                pageSizeOptions={[10, 25, 50]}
                canPreviousPage
                canNextPage
            />,
        );

        expect(screen.getByRole("button", { name: "Anterior" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Siguiente" })).toBeEnabled();
        expect(screen.getByText("Página 2 de 5")).toBeInTheDocument();
        expect(screen.getByText("Registros: 42")).toBeInTheDocument();
        expect(screen.getByRole("combobox", { name: "Filas por página" })).toHaveValue("25");
        expect(screen.getByRole("spinbutton", { name: "Ir a página" })).toHaveValue(2);
    });

    it("routes previous and next actions to the provided handlers", async () => {
        const user = userEvent.setup();
        const onPreviousPage = vi.fn();
        const onNextPage = vi.fn();

        render(
            <DataTablePagination onPreviousPage={onPreviousPage} onNextPage={onNextPage} canPreviousPage canNextPage />,
        );

        await user.click(screen.getByRole("button", { name: "Anterior" }));
        await user.click(screen.getByRole("button", { name: "Siguiente" }));

        expect(onPreviousPage).toHaveBeenCalledTimes(1);
        expect(onNextPage).toHaveBeenCalledTimes(1);
    });

    it("disables buttons from pagination state", () => {
        render(
            <DataTablePagination
                onFirstPage={vi.fn()}
                onPreviousPage={vi.fn()}
                onNextPage={vi.fn()}
                onLastPage={vi.fn()}
                canPreviousPage={false}
                canNextPage={false}
            />,
        );

        expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    });

    it("disables navigation while fetching and shows the loading indicator on next", () => {
        render(
            <DataTablePagination
                onFirstPage={vi.fn()}
                onPreviousPage={vi.fn()}
                onNextPage={vi.fn()}
                onLastPage={vi.fn()}
                onPageSizeChange={vi.fn()}
                onGoToPage={vi.fn()}
                canPreviousPage
                canNextPage
                pageSize={25}
                pageSizeOptions={[10, 25, 50]}
                isFetching
            />,
        );

        expect(screen.getByRole("button", { name: "Primera" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
        expect(screen.getByTestId("btn_pg_next_page")).toBeDisabled();
        expect(screen.getByRole("button", { name: "Última" })).toBeDisabled();
        expect(screen.getByRole("combobox", { name: "Filas por página" })).toBeDisabled();
        expect(screen.getByRole("spinbutton", { name: "Ir a página" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Ir" })).toBeDisabled();
        expect(screen.queryByRole("button", { name: "Siguiente" })).not.toBeInTheDocument();
    });

    it("routes page-size changes to the configured handler", async () => {
        const user = userEvent.setup();
        const onPageSizeChange = vi.fn();

        render(
            <DataTablePagination
                onPreviousPage={vi.fn()}
                onNextPage={vi.fn()}
                onPageSizeChange={onPageSizeChange}
                canPreviousPage
                canNextPage
                pageSize={10}
                pageSizeOptions={[10, 25]}
            />,
        );

        await user.selectOptions(screen.getByRole("combobox", { name: "Filas por página" }), "25");

        expect(onPageSizeChange).toHaveBeenCalledWith(25);
    });

    it("routes direct page jumps to the configured handler", async () => {
        const user = userEvent.setup();
        const onGoToPage = vi.fn();

        render(
            <DataTablePagination
                onPreviousPage={vi.fn()}
                onNextPage={vi.fn()}
                onGoToPage={onGoToPage}
                canPreviousPage
                canNextPage
                page={2}
                totalPages={5}
            />,
        );

        const pageInput = screen.getByRole("spinbutton", { name: "Ir a página" });
        await user.clear(pageInput);
        await user.type(pageInput, "4");
        await user.click(screen.getByRole("button", { name: "Ir" }));

        expect(onGoToPage).toHaveBeenCalledWith(4);
    });

    it("routes numbered page buttons to the configured handler", async () => {
        const user = userEvent.setup();
        const onGoToPage = vi.fn();

        render(
            <DataTablePagination
                onPreviousPage={vi.fn()}
                onNextPage={vi.fn()}
                onGoToPage={onGoToPage}
                canPreviousPage
                canNextPage
                page={2}
                totalPages={5}
            />,
        );

        await user.click(screen.getByTestId("btn_pg_number_4"));

        expect(onGoToPage).toHaveBeenCalledWith(4);
    });

    it("does not render jump buttons when jump handlers are not provided", () => {
        render(
            <DataTablePagination
                onFirstPage={vi.fn()}
                onPreviousPage={vi.fn()}
                onNextPage={vi.fn()}
                onLastPage={vi.fn()}
                onGoToPage={vi.fn()}
                canPreviousPage
                canNextPage
                page={2}
                totalPages={5}
            />,
        );

        expect(screen.queryByTestId("btn_pg_jump_backward")).not.toBeInTheDocument();
        expect(screen.queryByTestId("btn_pg_jump_forward")).not.toBeInTheDocument();
    });

    it("renders jump buttons and routes clicks to the jump handlers", async () => {
        const user = userEvent.setup();
        const onJumpBackward = vi.fn();
        const onJumpForward = vi.fn();

        render(
            <DataTablePagination
                onPreviousPage={vi.fn()}
                onNextPage={vi.fn()}
                onJumpBackward={onJumpBackward}
                onJumpForward={onJumpForward}
                canPreviousPage
                canNextPage
                page={5}
                totalPages={20}
            />,
        );

        await user.click(screen.getByTestId("btn_pg_jump_backward"));
        await user.click(screen.getByTestId("btn_pg_jump_forward"));

        expect(onJumpBackward).toHaveBeenCalledTimes(1);
        expect(onJumpForward).toHaveBeenCalledTimes(1);
    });

    it("disables the backward jump on the first page and the forward jump on the last page", () => {
        const { rerender } = render(
            <DataTablePagination
                onPreviousPage={vi.fn()}
                onNextPage={vi.fn()}
                onJumpBackward={vi.fn()}
                onJumpForward={vi.fn()}
                canPreviousPage={false}
                canNextPage
                page={1}
                totalPages={20}
            />,
        );

        expect(screen.getByTestId("btn_pg_jump_backward")).toBeDisabled();
        expect(screen.getByTestId("btn_pg_jump_forward")).toBeEnabled();

        rerender(
            <DataTablePagination
                onPreviousPage={vi.fn()}
                onNextPage={vi.fn()}
                onJumpBackward={vi.fn()}
                onJumpForward={vi.fn()}
                canPreviousPage
                canNextPage={false}
                page={20}
                totalPages={20}
            />,
        );

        expect(screen.getByTestId("btn_pg_jump_backward")).toBeEnabled();
        expect(screen.getByTestId("btn_pg_jump_forward")).toBeDisabled();
    });

    it("disables both jump buttons while fetching", () => {
        render(
            <DataTablePagination
                onPreviousPage={vi.fn()}
                onNextPage={vi.fn()}
                onJumpBackward={vi.fn()}
                onJumpForward={vi.fn()}
                canPreviousPage
                canNextPage
                page={5}
                totalPages={20}
                isFetching
            />,
        );

        expect(screen.getByTestId("btn_pg_jump_backward")).toBeDisabled();
        expect(screen.getByTestId("btn_pg_jump_forward")).toBeDisabled();
    });
});
