import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TableContainer } from "./TableContainer";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key, values = {}) => {
            const translations = {
                "dataTable.pagination.caption": `Página ${values.page} de ${values.totalPages} — Registros: ${values.totalRecords}`,
                "dashboard.tables.empty": "No hay datos para mostrar",
            };

            return translations[key] ?? key;
        },
    }),
}));

vi.mock("@kace/ui-shared", async () => {
    const { createElement } = await import("react");
    const passthrough = (tag) => {
        const Passthrough = ({ children }) => createElement(tag, null, children);
        return Passthrough;
    };

    return {
        Table: passthrough("table"),
        TableBody: passthrough("tbody"),
        TableCaption: passthrough("caption"),
        TableCell: passthrough("td"),
        TableHead: passthrough("th"),
        TableHeader: passthrough("thead"),
        TableRow: passthrough("tr"),
        Pagination: passthrough("nav"),
        PaginationContent: passthrough("ul"),
        PaginationEllipsis: () => createElement("span", null, "…"),
        PaginationItem: passthrough("li"),
        PaginationLink: ({ children, onClick, "data-testid": testId }) =>
            createElement("a", { onClick, "data-testid": testId }, children),
        PaginationNext: ({ onClick, "data-testid": testId }) =>
            createElement("button", { onClick, "data-testid": testId }, "next"),
        PaginationPrevious: ({ onClick, "data-testid": testId }) =>
            createElement("button", { onClick, "data-testid": testId }, "previous"),
        GeneralLoader: () => createElement("div", null, "loading"),
    };
});

vi.mock("@/utils/src/helpers", () => ({
    formatTestId: (...parts) => parts.join("_"),
}));

describe("Dashboard SectionTables TableContainer", () => {
    it("renders the translated page/records caption when there is data", () => {
        render(
            <TableContainer
                dataTable={[
                    { grupos: "A", id: 1, total: 3 },
                    { grupos: "B", id: 2, total: 4 },
                ]}
                columns={["grupos", "total"]}
                rowsPerPage={10}
            />,
        );

        expect(screen.getByText("Página 1 de 1 — Registros: 2")).toBeInTheDocument();
    });

    it("shows the empty-state caption instead of 'Página 1 de 0' when there is no data", () => {
        render(<TableContainer dataTable={[]} columns={["grupos", "total"]} rowsPerPage={10} />);

        expect(screen.getByText("No hay datos para mostrar")).toBeInTheDocument();
        expect(screen.queryByText(/de 0/)).not.toBeInTheDocument();
    });

    it("does not crash and shows the empty-state caption when dataTable is explicitly null", () => {
        render(<TableContainer dataTable={null} columns={["grupos", "total"]} rowsPerPage={10} />);

        expect(screen.getByText("No hay datos para mostrar")).toBeInTheDocument();
    });

    it("renders the GeneralLoader and hides the table while loading", () => {
        render(
            <TableContainer
                dataTable={[{ grupos: "A", id: 1, total: 3 }]}
                columns={["grupos", "total"]}
                rowsPerPage={10}
                loading
            />,
        );

        expect(screen.getByText("loading")).toBeInTheDocument();
        expect(screen.queryByText(/Página 1 de/)).not.toBeInTheDocument();
    });

    it("advances the page when clicking next", () => {
        const data = Array.from({ length: 25 }, (_, i) => ({ grupos: `G${i}`, id: i, total: i }));
        render(<TableContainer dataTable={data} columns={["grupos", "total"]} rowsPerPage={10} />);

        expect(screen.getByText("Página 1 de 3 — Registros: 25")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("pagination_next_1"));
        expect(screen.getByText("Página 2 de 3 — Registros: 25")).toBeInTheDocument();
    });

    it("keeps the caption and empty-state keys present in both locale bundles", async () => {
        const en = (await import("../../../locale/en.json")).default;
        const es = (await import("../../../locale/es.json")).default;

        expect(en.dataTable.pagination.caption).toBeDefined();
        expect(es.dataTable.pagination.caption).toBeDefined();
        expect(en.dashboard.tables.empty).toBeDefined();
        expect(es.dashboard.tables.empty).toBeDefined();
    });
});
