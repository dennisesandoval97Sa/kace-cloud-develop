import { describe, expect, it } from "vitest";
import { processSubcasesData } from "./processSubcasesData";

describe("processSubcasesData time description prefixes", () => {
    it("strips prefixes when flag is false", () => {
        const process = processSubcasesData(false, false, false);
        const rows = process([
            {
                reference: "S-1",
                antiguedad: "Tiempo laboral transcurrido: 1 días -> 2 horas -> 3 minutos",
                nombres: "Ada",
                apellido1: "Lovelace",
            },
        ]);

        expect(rows[0].antiguedad).toBe("1 days 2 hours 3 minutes");
    });
});
