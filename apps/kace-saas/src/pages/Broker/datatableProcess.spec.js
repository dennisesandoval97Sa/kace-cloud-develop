import { beforeAll, describe, expect, it, vi } from "vitest";

/*
 * dateUtils captures the display time zone from Intl when the module loads, so the module graph is
 * reloaded with Intl reporting the requested zone instead of the zone of the machine running the tests.
 */
const loadProcessDataInTimeZone = async (module, timeZone) => {
    const realResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
    const resolvedOptionsSpy = vi
        .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
        .mockImplementation(function () {
            return { ...realResolvedOptions.call(this), timeZone };
        });

    try {
        vi.resetModules();
        const { processData } = await import(`./${module}/utils/datatableProcess.js`);
        return processData;
    } finally {
        resolvedOptionsSpy.mockRestore();
    }
};

const row = {
    name: "Broker QA",
    created_at: "2026-08-27 14:23:45-05:00",
    updated_at: "2026-08-27 19:35:38+00:00",
};

const TIME_ZONES = [
    { timeZone: "America/Bogota", createdAt: "27/08/2026 14:23:45", updatedAt: "27/08/2026 14:35:38" },
    { timeZone: "UTC", createdAt: "27/08/2026 19:23:45", updatedAt: "27/08/2026 19:35:38" },
];

describe.each(["Adapters", "Mappers"].flatMap((module) => TIME_ZONES.map((zone) => ({ module, ...zone }))))(
    "$module DataTable processData in $timeZone",
    ({ module, timeZone, createdAt, updatedAt }) => {
        let processData;

        beforeAll(async () => {
            processData = await loadProcessDataInTimeZone(module, timeZone);
        });

        it("formats created_at and updated_at with the shared table date pattern", async () => {
            const [result] = await processData([row]);

            expect(result.created_at).toBe(createdAt);
            expect(result.updated_at).toBe(updatedAt);
            expect(result.name).toBe(row.name);
        });

        it("unwraps the data envelope before formatting", async () => {
            const [result] = await processData({ data: [row] });

            expect(result.created_at).toBe(createdAt);
        });

        it("leaves a missing updated_at empty", async () => {
            const [result] = await processData([{ ...row, updated_at: null }]);

            expect(result.updated_at).toBeNull();
        });
    },
);
