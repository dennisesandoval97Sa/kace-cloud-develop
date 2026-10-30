import { describe, expect, it } from "vitest";
import { applyBoardTimeDescriptionDisplay } from "./applyBoardTimeDescriptionDisplay.util";

const tEs = (key) =>
    ({
        "gridMain.text.days": " días ",
        "gridMain.text.hours": " horas ",
        "gridMain.text.minutes": " minutos ",
        "gridMain.text.workingTime": "tiempo transcurrido: ",
        "gridMain.text.remainingTime": "Tiempo restante: ",
    })[key] ?? key;

describe("applyBoardTimeDescriptionDisplay", () => {
    const columns = [
        { field: "remaining_time", alias: "tiempo_restante" },
        { field: "reference", alias: "ref" },
        { field: "antiguedad" },
    ];

    it("localizes with Spanish prefix when showPrefixes is true", () => {
        const row = {
            tiempo_restante: "Remaining time: 1 days, 0 hours and 0 minutes",
            antiguedad: "Tiempo laboral transcurrido: 0 días -> 1 horas -> 0 minutos",
        };
        expect(applyBoardTimeDescriptionDisplay(row, columns, true, tEs)).toEqual({
            tiempo_restante: "Tiempo restante: 1 días 0 horas 0 minutos",
            antiguedad: "tiempo transcurrido: 0 días 1 horas 0 minutos",
        });
    });

    it("localizes without prefix and writes alias key when present", () => {
        const row = {
            tiempo_restante: "Remaining time: 1 days, 0 hours and 0 minutes",
            antiguedad: "Tiempo laboral transcurrido: 0 días -> 1 horas -> 0 minutos",
            ref: "C-1",
        };
        expect(applyBoardTimeDescriptionDisplay(row, columns, false, tEs)).toEqual({
            tiempo_restante: "1 días 0 horas 0 minutos",
            antiguedad: "0 días 1 horas 0 minutos",
            ref: "C-1",
        });
    });
});
