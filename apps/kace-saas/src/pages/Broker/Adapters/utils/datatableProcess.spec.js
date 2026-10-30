import { beforeAll, describe, expect, it, vi } from "vitest";

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
    name: "Adaptador QA",
    created_at: "2026-10-06 09:15:30-05:00",
    updated_at: "2026-10-06 15:40:10+00:00",
};

describe.each([
    { timeZone: "America/Bogota", createdAt: "06/10/2026 09:15:30", updatedAt: "06/10/2026 10:40:10" },
    { timeZone: "UTC", createdAt: "06/10/2026 14:15:30", updatedAt: "06/10/2026 15:40:10" },
])("Adapters DataTable processData in $timeZone", ({ timeZone, createdAt, updatedAt }) => {
    let processData;

    beforeAll(async () => {
        processData = await loadProcessDataInTimeZone(timeZone);
    });

    it("formats created_at and updated_at when data is a plain array, as useDataTable passes it", async () => {
        const [result] = await processData([row]);

        expect(result).toEqual({ name: "Adaptador QA", created_at: createdAt, updated_at: updatedAt });
    });

    it("formats created_at and updated_at when data comes wrapped in { data }", async () => {
        const [result] = await processData({ data: [row] });

        expect(result.created_at).toBe(createdAt);
        expect(result.updated_at).toBe(updatedAt);
    });
});
