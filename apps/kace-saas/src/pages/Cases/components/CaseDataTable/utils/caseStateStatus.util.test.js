import { describe, it, expect } from "vitest";
import {
    buildStatusColorMap,
    getCaseStateBadgeStyle,
    getImportStatusBadgeStyle,
    getStatusColumn,
    isCaseStateAccessorKey,
    isStatusCellType,
} from "./caseStateStatus.util";

describe("caseStateStatus.util", () => {
    it("detects case state accessor keys", () => {
        expect(isCaseStateAccessorKey("estadoactual")).toBe(true);
        expect(isCaseStateAccessorKey("reference")).toBe(false);
    });

    it("builds a color map from countByStatus metadata", () => {
        const map = buildStatusColorMap([
            { status: "Abierto", count: 3, color: "#FFAA00" },
            { status: "Cerrado", count: 1, color: null },
        ]);

        expect(map).toEqual({ Abierto: "#FFAA00" });
    });

    it("returns badge styles using estado color and contrast foreground", () => {
        const style = getCaseStateBadgeStyle("Abierto", { Abierto: "#FFAA00" });

        expect(style).toEqual({
            backgroundColor: "#FFAA00",
            color: "#fff",
        });
    });

    it("keeps import status palette separate from case states", () => {
        expect(getImportStatusBadgeStyle("processing")).toEqual({
            backgroundColor: "#E78C5070",
            color: "#E78C50",
        });
    });

    it("detects status cell types and finds the configured status column", () => {
        expect(isStatusCellType("estado")).toBe(true);
        expect(isStatusCellType("status")).toBe(true);
        expect(isStatusCellType("default")).toBe(false);

        const columns = [
            { column_name: "reference", cell_type: "default" },
            { column_name: "estadoactual", cell_type: "estado" },
        ];

        expect(getStatusColumn(columns)?.column_name).toBe("estadoactual");
    });
});
