import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CellClassification from "./CellClassification";

const makeRow = (value) => ({ original: { myField: value } });

describe("CellClassification", () => {
    it("renders the single value when no separator is given", () => {
        render(<CellClassification row={makeRow("Soporte")} accessorKey="myField" />);
        expect(screen.getByText("Soporte")).toBeInTheDocument();
    });

    it("splits on separator and renders all parts", () => {
        render(<CellClassification row={makeRow("A > B > C")} accessorKey="myField" separator=" > " />);
        expect(screen.getByText("A")).toBeInTheDocument();
        expect(screen.getByText("B")).toBeInTheDocument();
        expect(screen.getByText("C")).toBeInTheDocument();
    });

    it("renders a dash when value is null", () => {
        render(<CellClassification row={makeRow(null)} accessorKey="myField" />);
        expect(screen.getByText("-")).toBeInTheDocument();
    });

    it("renders a dash when value is undefined", () => {
        render(<CellClassification row={makeRow(undefined)} accessorKey="myField" />);
        expect(screen.getByText("-")).toBeInTheDocument();
    });

    it("renders a dash when value is an empty string", () => {
        render(<CellClassification row={makeRow("")} accessorKey="myField" />);
        expect(screen.getByText("-")).toBeInTheDocument();
    });

    it("renders non-string values without splitting when separator is configured", () => {
        const { container } = render(<CellClassification row={makeRow(120)} accessorKey="myField" separator="f" />);

        expect(screen.getByText("120")).toBeInTheDocument();
        expect(container.querySelectorAll("svg")).toHaveLength(0);
    });
});
