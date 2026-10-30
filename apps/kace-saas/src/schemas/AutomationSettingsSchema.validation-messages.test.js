import { describe, it, expect, beforeAll } from "vitest";
import i18n from "i18next";
import { AutomationSettingsCreateSchema } from "./AutomationSettingsSchema";
import { joiFormikAdapter } from "@/utils/src/joiFormikAdapter";

const adapter = joiFormikAdapter(AutomationSettingsCreateSchema);

const validAutomationSettings = {
    description: "Servicio automatizado",
    frequency: "*/5 * * * *",
    start_date: new Date("2026-07-04T00:00:00.000Z"),
    end_date: new Date("2026-07-04T23:59:59.000Z"),
};

async function getFieldError(data, field) {
    try {
        await adapter.validate(data);
        return null;
    } catch (e) {
        return e.inner.find((err) => err.path === field)?.message ?? null;
    }
}

describe("AutomationSettings frequency validation messages", () => {
    beforeAll(async () => {
        await i18n.changeLanguage("es");
    });

    it("shows a translated Spanish cron message for malformed frequency", async () => {
        const message = await getFieldError(
            {
                ...validAutomationSettings,
                frequency: "*/5 * * *dd",
            },
            "frequency",
        );

        expect(message).toBe("Debe ser una expresión cron válida (ej: */5 * * * *)");
        expect(message).not.toContain("validations.string.crontab");
    });

    it("accepts a valid cron frequency", async () => {
        await expect(adapter.validate(validAutomationSettings)).resolves.toBeUndefined();
    });

    it("shows a translated English cron message when locale is en", async () => {
        await i18n.changeLanguage("en");
        const message = await getFieldError(
            {
                ...validAutomationSettings,
                frequency: "*/5 * * *dd",
            },
            "frequency",
        );

        expect(message).toBe("Must be a valid cron expression (for example: */5 * * * *)");
        await i18n.changeLanguage("es");
    });
});
