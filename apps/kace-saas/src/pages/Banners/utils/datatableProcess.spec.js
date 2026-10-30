import { beforeAll, describe, expect, it, vi } from "vitest";
import { SPECIAL_FIELDS } from "../../../services/createSchemaFilter";
import { processFilters } from "./datatableProcess";

/*
 * dateUtils captures the display time zone from Intl when the module loads, so the module graph is
 * reloaded with Intl reporting the requested zone instead of the zone of the machine running the tests.
 */
const loadProcessDataInTimeZone = async (timeZone) => {
    const realResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
    const resolvedOptionsSpy = vi
        .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
        .mockImplementation(function () {
            return { ...realResolvedOptions.call(this), timeZone };
        });

    try {
        vi.resetModules();
        const { processData } = await import("./datatableProcess");
        return processData;
    } finally {
        resolvedOptionsSpy.mockRestore();
    }
};

const row = {
    descripcion: "Prueba QA",
    fecha_inicio: "2026-08-01",
    fecha_fin: "2026-08-31",
    status: 2,
    created_at: "2026-08-27 14:23:45-05:00",
    updated_at: "2026-08-27 19:35:38+00:00",
};

describe.each([
    { timeZone: "America/Bogota", createdAt: "27/08/2026 14:23:45", updatedAt: "27/08/2026 14:35:38" },
    { timeZone: "UTC", createdAt: "27/08/2026 19:23:45", updatedAt: "27/08/2026 19:35:38" },
])("Banners DataTable processData in $timeZone", ({ timeZone, createdAt, updatedAt }) => {
    let processData;

    beforeAll(async () => {
        processData = await loadProcessDataInTimeZone(timeZone);
    });

    it("formats created_at and updated_at when data is a plain array, as useDataTable passes it", async () => {
        const [result] = await processData([row]);

        expect(result.created_at).toBe(createdAt);
        expect(result.updated_at).toBe(updatedAt);
    });

    it("formats created_at and updated_at when data comes wrapped in { data }", async () => {
        const [result] = await processData({ data: [row] });

        expect(result.created_at).toBe(createdAt);
        expect(result.updated_at).toBe(updatedAt);
    });
});

describe("Banners DataTable processData", () => {
    let processData;

    beforeAll(async () => {
        processData = await loadProcessDataInTimeZone("America/Bogota");
    });

    it("keeps fecha_inicio and fecha_fin as date-only values", async () => {
        const [result] = await processData([row]);

        expect(result.fecha_inicio).toBe("2026-08-01");
        expect(result.fecha_fin).toBe("2026-08-31");
    });

    it("leaves null and undefined date fields untouched", async () => {
        const [result] = await processData([{ ...row, created_at: null, updated_at: undefined }]);

        expect(result.created_at).toBeNull();
        expect(result.updated_at).toBeUndefined();
    });
});

describe("Banners DataTable processFilters", () => {
    it("appends the status switch filter after the default filters", () => {
        const defaultFilter = { column_name: "descripcion" };

        const result = processFilters([defaultFilter]);

        expect(result).toEqual([defaultFilter, { column_name: "status", field: SPECIAL_FIELDS.switch_state }]);
    });
});
