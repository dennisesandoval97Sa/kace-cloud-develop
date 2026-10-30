import { describe, expect, it } from "vitest";
import { processData } from "./datatableProcess";

describe("client notification table data", () => {
    it("renders range boundaries as calendar dates and audit timestamps in local time", async () => {
        const [row] = await processData({
            data: [
                {
                    id: "notification-id",
                    is_active: true,
                    start_date: "2026-07-01T00:00:00.000Z",
                    end_date: "2026-08-01T23:59:59.999Z",
                    created_at: "2026-07-16T00:45:00.155Z",
                    updated_at: null,
                },
            ],
        });

        expect(row.start_date).toBe("01/07/2026");
        expect(row.end_date).toBe("01/08/2026");
        expect(row.created_at).toBe("15/07/2026 19:45:00");
    });
});
