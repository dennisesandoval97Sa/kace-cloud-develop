import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createColumns, getChildClassificationLevels, getFilledClassificationLevels } from "./columns";

describe("createColumns nivel1 cell", () => {
    it("counts filled classification levels when row children are used for another expansion", () => {
        const columns = createColumns(
            [{ accessorKey: "nivel1", header: "Nivel1", value: "string" }],
            false,
            [],
            [],
            false,
        );
        const nivelColumn = columns.find((column) => column.accessorKey === "nivel1");
        const toggleExpanded = vi.fn();
        const setExpandedContentType = vi.fn();

        render(
            nivelColumn.cell({
                row: {
                    id: "0",
                    original: {
                        id: "case-130",
                        nivel1: "categoria clasificacion 1",
                        nivel2: "categoria clasificacion 2",
                        children: [],
                    },
                    getToggleExpandedHandler: () => toggleExpanded,
                    getIsExpanded: () => false,
                },
                table: {
                    options: {
                        meta: {
                            getExpandedContentType: () => undefined,
                            setExpandedContentType,
                        },
                    },
                },
            }),
        );

        expect(screen.getByText("2")).toBeInTheDocument();
        expect(screen.getByText("categoria clasificacion 1")).toBeInTheDocument();

        fireEvent.click(screen.getByTestId("btn_expand_case-130"));

        expect(setExpandedContentType).toHaveBeenCalledWith("0", "classification");
        expect(toggleExpanded).toHaveBeenCalledTimes(1);
    });

    it("collapses an expanded classification panel", () => {
        const columns = createColumns(
            [{ accessorKey: "nivel1", header: "Nivel1", value: "string" }],
            false,
            [],
            [],
            false,
        );
        const nivelColumn = columns.find((column) => column.accessorKey === "nivel1");
        const toggleExpanded = vi.fn();

        render(
            nivelColumn.cell({
                row: {
                    id: "case-130",
                    original: { id: "case-130", nivel1: "Root", nivel2: "Leaf" },
                    getToggleExpandedHandler: () => vi.fn(),
                    getIsExpanded: () => true,
                    toggleExpanded,
                },
                table: {
                    options: {
                        meta: {
                            getExpandedContentType: () => "classification",
                            setExpandedContentType: vi.fn(),
                        },
                    },
                },
            }),
        );

        fireEvent.click(screen.getByTestId("btn_expand_case-130"));

        expect(toggleExpanded).toHaveBeenCalledWith(false);
    });

    it("switches an expanded subcases panel to classifications without collapsing", () => {
        const columns = createColumns(
            [{ accessorKey: "nivel1", header: "Nivel1", value: "string" }],
            false,
            [],
            [],
            false,
        );
        const nivelColumn = columns.find((column) => column.accessorKey === "nivel1");
        const toggleExpanded = vi.fn();
        const setExpandedContentType = vi.fn();

        render(
            nivelColumn.cell({
                row: {
                    id: "case-130",
                    original: { id: "case-130", nivel1: "Root", nivel2: "Leaf" },
                    getToggleExpandedHandler: () => vi.fn(),
                    getIsExpanded: () => true,
                    toggleExpanded,
                },
                table: {
                    options: {
                        meta: {
                            getExpandedContentType: () => "subcases",
                            setExpandedContentType,
                        },
                    },
                },
            }),
        );

        fireEvent.click(screen.getByTestId("btn_expand_case-130"));

        expect(setExpandedContentType).toHaveBeenCalledWith("case-130", "classification");
        expect(toggleExpanded).not.toHaveBeenCalled();
    });

    it("falls back to the row expansion handler when the table has no content-type meta", () => {
        const columns = createColumns(
            [{ accessorKey: "nivel1", header: "Nivel1", value: "string" }],
            false,
            [],
            [],
            false,
        );
        const nivelColumn = columns.find((column) => column.accessorKey === "nivel1");
        const toggleExpanded = vi.fn();

        render(
            nivelColumn.cell({
                row: {
                    id: "case-130",
                    original: { id: "case-130", nivel1: "Root", nivel2: "Leaf" },
                    getToggleExpandedHandler: () => toggleExpanded,
                    getIsExpanded: () => true,
                },
                table: { options: {} },
            }),
        );

        fireEvent.click(screen.getByTestId("btn_expand_case-130"));

        expect(toggleExpanded).toHaveBeenCalledTimes(1);
    });
});

describe("getFilledClassificationLevels", () => {
    it("normalizes numeric labels and ignores unrelated nivel fields", () => {
        expect(
            getFilledClassificationLevels({
                nivel1: "Root",
                nivel2: 200,
                nivel_riesgo: "High",
            }),
        ).toEqual([
            { id: "nivel1", label: "Root", value: "Root" },
            { id: "nivel2", label: "200", value: "200" },
        ]);
    });

    it("ignores empty levels and keeps filled nivel values", () => {
        expect(
            getFilledClassificationLevels({
                nivel1: "categoria clasificacion 1",
                nivel2: "categoria clasificacion 2",
                nivel3: "",
                nivel4: null,
            }),
        ).toEqual([
            {
                id: "nivel1",
                label: "categoria clasificacion 1",
                value: "categoria clasificacion 1",
            },
            {
                id: "nivel2",
                label: "categoria clasificacion 2",
                value: "categoria clasificacion 2",
            },
        ]);
    });

    it("returns only levels below nivel1 for the expanded submenu", () => {
        expect(
            getChildClassificationLevels({
                nivel1: "categoria clasificacion 1",
                nivel2: "categoria clasificacion 2",
                nivel10: "categoria clasificacion 10",
            }),
        ).toEqual([
            {
                id: "nivel2",
                label: "categoria clasificacion 2",
                value: "categoria clasificacion 2",
            },
            {
                id: "nivel10",
                label: "categoria clasificacion 10",
                value: "categoria clasificacion 10",
            },
        ]);
    });
});

describe("createColumns date cells", () => {
    const formattedDatePattern = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/;

    it("formats created_at with dd/MM/yyyy HH:mm:ss instead of sv-SE", () => {
        const columns = createColumns(
            [{ accessorKey: "created_at", header: "Creado", value: "date" }],
            false,
            [],
            [],
            false,
        );
        const createdColumn = columns.find((column) => column.accessorKey === "created_at");

        const { container } = render(
            createdColumn.cell({
                row: { original: { created_at: "2026-09-07 11:21:53" } },
            }),
        );

        expect(container.textContent).toMatch(formattedDatePattern);
        expect(container.textContent).not.toMatch(/^\d{4}-\d{2}-\d{2}/);
    });

    it("keeps already localized created_at values", () => {
        const columns = createColumns(
            [{ accessorKey: "created_at", header: "Creado", value: "date" }],
            false,
            [],
            [],
            false,
        );
        const createdColumn = columns.find((column) => column.accessorKey === "created_at");

        const { container } = render(
            createdColumn.cell({
                row: { original: { created_at: "15/07/2026 16:20:56" } },
            }),
        );

        expect(container.textContent).toBe("15/07/2026 16:20:56");
    });
});
