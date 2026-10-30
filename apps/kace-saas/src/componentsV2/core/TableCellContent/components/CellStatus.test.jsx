import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CellStatus from "./CellStatus";
import { CaseStatusColorMapProvider } from "../context/CaseStatusColorMapContext";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

const makeRow = (data) => ({ original: data });

const renderWithColorMap = (ui, colorMap = {}) =>
    render(<CaseStatusColorMapProvider value={colorMap}>{ui}</CaseStatusColorMapProvider>);

describe("CellStatus", () => {
    it("paints case estado columns with colors from countByStatus metadata", () => {
        renderWithColorMap(<CellStatus row={makeRow({ estadoactual: "Abierto" })} accessorKey="estadoactual" />, {
            Abierto: "#FFAA00",
        });

        const badge = screen.getByText("Abierto");
        expect(badge.style.backgroundColor).toBe("rgb(255, 170, 0)");
    });

    it("renders plain text for case estado columns when color is unavailable", () => {
        const { container } = renderWithColorMap(
            <CellStatus row={makeRow({ estadoactual: "Sin color" })} accessorKey="estadoactual" />,
        );

        expect(screen.getByText("Sin color")).toBeInTheDocument();
        expect(container.querySelector("span.inline-block")).toBeNull();
    });

    it("uses import palette and translates processing statuses", () => {
        renderWithColorMap(<CellStatus row={makeRow({ status: "processing" })} accessorKey="status" />);

        const badge = screen.getByText("importExport.form.statuses.processing");
        expect(badge.style.backgroundColor).toBe("rgba(231, 140, 80, 0.44)");
    });

    it("translates failed imports with the rejected palette", () => {
        renderWithColorMap(<CellStatus row={makeRow({ status: "failed" })} accessorKey="status" />);

        const badge = screen.getByText("importExport.form.statuses.failed");
        expect(badge.style.backgroundColor).toBe("rgba(231, 110, 80, 0.5)");
    });

    it("uses inactive palette for subclassification values", () => {
        renderWithColorMap(
            <CellStatus
                row={makeRow({ can_start_sub_cases_flow: "gridMain.text.isSubclassification" })}
                accessorKey="can_start_sub_cases_flow"
            />,
        );

        const badge = screen.getByText("gridMain.text.isSubclassification");
        expect(badge.style.backgroundColor).toBe("rgba(231, 110, 80, 0.5)");
    });

    it("renders dash for empty estado values", () => {
        renderWithColorMap(<CellStatus row={makeRow({ estadoactual: null })} accessorKey="estadoactual" />);

        expect(screen.getByText("-")).toBeInTheDocument();
    });
});
