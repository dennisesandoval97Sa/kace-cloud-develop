import { describe, it, expect } from "vitest";
import { handleStateTimer } from "./FormatData";

describe("handleStateTimer", () => {
    const formattedDatePattern = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/;

    it("formats fecha_asignacion when provided in schema", () => {
        const schema = [{ column_name: "fecha_asignacion", data_type: "Date" }];
        const data = [{ fecha_asignacion: "2026-07-15T15:40:01.049Z" }];

        const result = handleStateTimer(data, [], schema);

        expect(result[0].fecha_asignacion).toMatch(formattedDatePattern);
        expect(result[0].fecha_asignacion).not.toContain("T");
    });

    it("does not reformat already formatted created_at", () => {
        const schema = [{ column_name: "created_at", data_type: "Date" }];
        const data = [{ created_at: "15/07/2026 10:17:10" }];

        const result = handleStateTimer(data, [], schema);

        expect(result[0].created_at).toBe("15/07/2026 10:17:10");
    });

    it("formats default date fields without schema", () => {
        const data = [{ created_at: "2026-07-15T10:17:10.000Z" }];

        const result = handleStateTimer(data);

        expect(result[0].created_at).toMatch(formattedDatePattern);
        expect(result[0].created_at).not.toContain("T");
    });

    it("formats postgres timestamp with timezone offset like created_at", () => {
        const data = [{ created_at: "2026-07-15 10:17:10-05:00" }];

        const result = handleStateTimer(data);

        expect(result[0].created_at).toMatch(formattedDatePattern);
        expect(result[0].created_at).not.toContain("-05:00");
    });

    it("formats fecha_resolucion with postgres timestamp format", () => {
        const data = [{ fecha_resolucion: "2026-07-14 12:39:09-05:00" }];

        const result = handleStateTimer(data);

        expect(result[0].fecha_resolucion).toMatch(formattedDatePattern);
    });

    it("formats all date columns to the same pattern", () => {
        const schema = [
            { column_name: "fecha_asignacion", data_type: "Date" },
            { column_name: "created_at", data_type: "Date" },
            { column_name: "fecha_resolucion", data_type: "Date" },
        ];
        const data = [
            {
                fecha_asignacion: "2026-07-15T15:40:01.049Z",
                created_at: "2026-07-15 10:17:10-05:00",
                fecha_resolucion: "2026-07-14 12:39:09-05:00",
            },
        ];

        const result = handleStateTimer(data, [], schema);

        expect(result[0].fecha_asignacion).toMatch(formattedDatePattern);
        expect(result[0].created_at).toMatch(formattedDatePattern);
        expect(result[0].fecha_resolucion).toMatch(formattedDatePattern);
    });
});
