import { describe, expect, it } from "vitest";

import { parseResponseApi, resolveSearchTotal } from "@kace_v2/shared/utils/parse-response-api.util";

describe("resolveSearchTotal", () => {
    it("desenvuelve el count knex de actions y onescript", () => {
        expect(resolveSearchTotal({ count: 80 })).toBe(80);
    });

    it("acepta el total numerico de rest flows", () => {
        expect(resolveSearchTotal(80)).toBe(80);
    });
});

describe("parseResponseApi", () => {
    it("normaliza metadata.count objeto a total numerico", () => {
        const parsed = parseResponseApi({
            data: {
                data: { items: [{ id: "a1" }] },
                metadata: { count: { count: 80 } },
            },
        });

        expect(parsed).toEqual({
            data: [{ id: "a1" }],
            count: 1,
            total: 80,
        });
    });
});
