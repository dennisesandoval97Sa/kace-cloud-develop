import { describe, it, expect } from "vitest";
import {
    TIME_DESCRIPTION_FIELDS,
    stripTimeDescriptionPrefix,
    parseTimeDescription,
    formatLocalizedTimeDescription,
    applyTimeDescriptionDisplay,
} from "./timeDescriptionPrefix";

const tEs = (key) =>
    ({
        "gridMain.text.days": " días ",
        "gridMain.text.hours": " horas ",
        "gridMain.text.minutes": " minutos ",
        "gridMain.text.workingTime": "tiempo transcurrido: ",
        "gridMain.text.remainingTime": "Tiempo restante: ",
    })[key] ?? key;

describe("TIME_DESCRIPTION_FIELDS", () => {
    it("includes the seven configured columns", () => {
        expect(TIME_DESCRIPTION_FIELDS).toEqual([
            "antiguedad",
            "remaining_time",
            "sla_elapsed_time",
            "sla_remaining_time",
            "sla_state_elapsed_time",
            "sla_state_remaining_time",
            "state_elapsed_time",
        ]);
    });
});

describe("stripTimeDescriptionPrefix", () => {
    it("strips Tiempo laboral transcurrido prefix", () => {
        expect(stripTimeDescriptionPrefix("Tiempo laboral transcurrido: 7 días -> 9 horas -> 27 minutos")).toBe(
            "7 días -> 9 horas -> 27 minutos",
        );
    });

    it("strips Remaining time prefix", () => {
        expect(stripTimeDescriptionPrefix("Remaining time: 0 days, 0 hours and 50 minutes")).toBe(
            "0 days, 0 hours and 50 minutes",
        );
    });

    it("returns non-matching strings unchanged", () => {
        expect(stripTimeDescriptionPrefix("plain text")).toBe("plain text");
    });

    it("returns non-strings unchanged", () => {
        expect(stripTimeDescriptionPrefix(null)).toBe(null);
        expect(stripTimeDescriptionPrefix(undefined)).toBe(undefined);
        expect(stripTimeDescriptionPrefix(12)).toBe(12);
    });

    it("returns empty string unchanged", () => {
        expect(stripTimeDescriptionPrefix("")).toBe("");
    });
});

describe("parseTimeDescription", () => {
    it("parses English remaining time", () => {
        expect(parseTimeDescription("Remaining time: 0 days, 0 hours and 50 minutes")).toEqual({
            days: 0,
            hours: 0,
            minutes: 50,
            kind: "remaining",
        });
    });

    it("parses Spanish elapsed time", () => {
        expect(parseTimeDescription("Tiempo laboral transcurrido: 7 días -> 9 horas -> 27 minutos")).toEqual({
            days: 7,
            hours: 9,
            minutes: 27,
            kind: "elapsed",
        });
    });

    it("returns null for unrelated strings", () => {
        expect(parseTimeDescription("plain text")).toBe(null);
        expect(parseTimeDescription(null)).toBe(null);
    });
});

describe("formatLocalizedTimeDescription", () => {
    it("localizes English remaining without prefix when flag is false", () => {
        expect(
            formatLocalizedTimeDescription("Remaining time: 0 days, 0 hours and 0 minutes", {
                showPrefixes: false,
                t: tEs,
            }),
        ).toBe("0 días 0 horas 0 minutos");
    });

    it("localizes English remaining with Spanish prefix when flag is true", () => {
        expect(
            formatLocalizedTimeDescription("Remaining time: 0 days, 0 hours and 0 minutes", {
                showPrefixes: true,
                t: tEs,
            }),
        ).toBe("Tiempo restante: 0 días 0 horas 0 minutos");
    });

    it("localizes Spanish elapsed without prefix when flag is false", () => {
        expect(
            formatLocalizedTimeDescription("Tiempo laboral transcurrido: 7 días -> 9 horas -> 27 minutos", {
                showPrefixes: false,
                t: tEs,
            }),
        ).toBe("7 días 9 horas 27 minutos");
    });
});

describe("applyTimeDescriptionDisplay", () => {
    const row = {
        reference: "C-1",
        antiguedad: "Tiempo laboral transcurrido: 1 días -> 0 horas -> 0 minutos",
        remaining_time: "Remaining time: 0 days, 0 hours and 50 minutes",
        other: "Tiempo laboral transcurrido: should stay",
    };

    it("localizes only known fields when showPrefixes is false", () => {
        expect(applyTimeDescriptionDisplay(row, false, tEs)).toEqual({
            reference: "C-1",
            antiguedad: "1 días 0 horas 0 minutos",
            remaining_time: "0 días 0 horas 50 minutos",
            other: "Tiempo laboral transcurrido: should stay",
        });
    });

    it("localizes known fields with prefixes when showPrefixes is true", () => {
        expect(applyTimeDescriptionDisplay(row, true, tEs)).toEqual({
            reference: "C-1",
            antiguedad: "tiempo transcurrido: 1 días 0 horas 0 minutos",
            remaining_time: "Tiempo restante: 0 días 0 horas 50 minutos",
            other: "Tiempo laboral transcurrido: should stay",
        });
    });

    it("returns the same row when no known fields are present", () => {
        const plain = { reference: "C-1" };
        expect(applyTimeDescriptionDisplay(plain, false, tEs)).toBe(plain);
    });
});
