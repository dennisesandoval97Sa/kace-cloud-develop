import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TableCellContent from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

const makeRow = (data) => ({ original: data });

describe("TableCellContent", () => {
    it("formats created_at dates consistently as dd/MM/yyyy HH:mm:ss", () => {
        render(<TableCellContent row={makeRow({ created_at: "2026-09-07 11:21:53" })} accessorKey="created_at" />);
        expect(screen.getByText(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/)).toBeInTheDocument();
    });

    it("renders CellClassification when cellType is clasificacion on non-level fields", () => {
        render(
            <TableCellContent row={makeRow({ anyField: "Soporte" })} accessorKey="anyField" cellType="clasificacion" />,
        );
        expect(screen.getByText("Soporte")).toBeInTheDocument();
    });

    it("renders CellLevels showing root level (nivel1) as label when cellType is clasificacion", () => {
        const row = {
            original: { nivel1: "Asistencia", nivel2: "Tareas de monitoreo" },
            getIsExpanded: () => false,
            toggleExpanded: () => {},
        };
        render(<TableCellContent row={row} accessorKey="nivel1" cellType="clasificacion" />);
        expect(screen.getByText("Asistencia")).toBeInTheDocument();
        expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("renders CellLevels like nivel1 when configured on nivel5 with expand enabled (shows root label)", () => {
        const row = {
            original: {
                nivel1: "Asistencia",
                nivel2: "Tareas de monitoreo",
            },
            getIsExpanded: () => false,
            toggleExpanded: () => {},
        };
        render(<TableCellContent row={row} accessorKey="nivel5" cellType="clasificacion" expandLevels={true} />);
        expect(screen.getByText("Asistencia")).toBeInTheDocument();
        expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("renders CellLevels like nivel1 when configured on nivel10 with expand enabled", () => {
        const row = {
            original: {
                nivel1: "Asistencia",
            },
            getIsExpanded: () => false,
            toggleExpanded: () => {},
        };
        render(<TableCellContent row={row} accessorKey="nivel10" cellType="clasificacion" expandLevels={true} />);
        expect(screen.getByText("Asistencia")).toBeInTheDocument();
        expect(screen.getByText("1")).toBeInTheDocument();
    });

    it("renders CellLevels for separator clasificacion with expand enabled (shows first parsed level)", () => {
        const row = {
            original: {
                clasificacion_path: "Asistencia -> Tareas de monitoreo",
            },
            getIsExpanded: () => false,
            toggleExpanded: () => {},
        };

        render(
            <TableCellContent
                row={row}
                accessorKey="clasificacion_path"
                cellType="clasificacion"
                separator="->"
                expandLevels={true}
            />,
        );

        expect(screen.getByText("Asistencia")).toBeInTheDocument();
        expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("renders CellClassification when expandLevels is false on nivel columns", () => {
        render(
            <TableCellContent
                row={makeRow({ nivel5: "Solo nivel 5" })}
                accessorKey="nivel5"
                cellType="clasificacion"
                expandLevels={false}
            />,
        );
        expect(screen.getByText("Solo nivel 5")).toBeInTheDocument();
    });

    it("renders CellStatus when cellType is estado", () => {
        render(
            <TableCellContent
                row={makeRow({ estadoactual: "Abierto" })}
                accessorKey="estadoactual"
                cellType="estado"
            />,
        );
        expect(screen.getByText("Abierto")).toBeInTheDocument();
    });

    it("uses getComponentKey when cellType is absent (regression: nivel1 → CellLevels)", () => {
        const row = {
            original: { nivel1: "Root", children: [] },
            getIsExpanded: () => false,
            toggleExpanded: () => {},
        };
        render(<TableCellContent row={row} accessorKey="nivel1" />);
        expect(screen.getByText("Root")).toBeInTheDocument();
    });

    it("renders dash when cellType is unknown and value is empty", () => {
        render(
            <TableCellContent row={makeRow({ anyField: null })} accessorKey="anyField" cellType="nonexistent_type" />,
        );
        expect(screen.getByText("-")).toBeInTheDocument();
    });

    it("renders default cell without badges for non-string expandable separator columns", () => {
        render(
            <TableCellContent
                row={makeRow({ antiguedad_minutos: 120 })}
                accessorKey="antiguedad_minutos"
                cellType="clasificacion"
                separator="f"
                expandLevels={true}
            />,
        );

        expect(screen.getByText("120")).toBeInTheDocument();
        expect(screen.queryByText("1")).not.toBeInTheDocument();
    });
});
