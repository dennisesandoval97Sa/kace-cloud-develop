import { describe, expect, it } from "vitest";
import { normalizeNotificationDateRange } from "./notificationDates";

describe("normalizeNotificationDateRange", () => {
    it("serializes locally selected calendar dates as inclusive UTC day boundaries", () => {
        const result = normalizeNotificationDateRange(
            {
                start_date: new Date(2026, 6, 1),
                end_date: new Date(2026, 7, 1),
            },
            { startField: "start_date", endField: "end_date" },
        );

        expect(result.start_date).toBe("2026-07-01T00:00:00.000Z");
        expect(result.end_date).toBe("2026-08-01T23:59:59.999Z");
    });

    it("preserves the calendar dates in stored UTC boundaries", () => {
        const result = normalizeNotificationDateRange(
            {
                fecha_inicio: "2026-07-01T00:00:00.000Z",
                fecha_fin: "2026-08-01T23:59:59.999Z",
            },
            { startField: "fecha_inicio", endField: "fecha_fin" },
        );

        expect(result.fecha_inicio).toBe("2026-07-01T00:00:00.000Z");
        expect(result.fecha_fin).toBe("2026-08-01T23:59:59.999Z");
    });

    it("does not add date fields to a partial update", () => {
        const result = normalizeNotificationDateRange(
            { id: "notification-id", subject: "Updated subject" },
            { startField: "start_date", endField: "end_date" },
        );

        expect(result).toEqual({ id: "notification-id", subject: "Updated subject" });
    });
});
