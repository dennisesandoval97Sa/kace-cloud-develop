import { describe, it, expect, beforeAll } from "vitest";
import Joi from "joi";
import i18n from "i18next";
import { clientCharLimitSchema, generalSetupSessionTimingShape } from "./GeneralSetupSchemaForm";
import { CHAR_LIMIT_KEY_PATTERN } from "@kace/core/src/global-config/domain/settings/clientFieldCharLimits.js";
import { joiFormikAdapter } from "@/utils/src/joiFormikAdapter";

const sessionFields = Joi.object(generalSetupSessionTimingShape);
const adapter = joiFormikAdapter(sessionFields);

async function getFieldError(data, field) {
    try {
        await adapter.validate(data);
        return null;
    } catch (e) {
        return e.inner.find((err) => err.path === field)?.message ?? null;
    }
}

describe("GeneralSetup session timing validation messages", () => {
    beforeAll(async () => {
        await i18n.changeLanguage("es");
    });

    it("shows a single Spanish number message for empty inactivity_time", async () => {
        const message = await getFieldError({ inactivity_time: "", warning_logout_time: 5 }, "inactivity_time");
        expect(message).toBe("Debe ser un número");
    });

    it("does not show warning_logout_time error when only inactivity_time is invalid", async () => {
        const message = await getFieldError({ inactivity_time: "", warning_logout_time: 5 }, "warning_logout_time");
        expect(message).toBeNull();
    });

    it("shows a single Spanish max message for warning_logout_time above 60", async () => {
        const message = await getFieldError(
            { inactivity_time: 30, warning_logout_time: 523442344 },
            "warning_logout_time",
        );
        expect(message).toBe("Máximo 60");
        expect(message).not.toMatch(/warning_logout_time/);
    });

    it("shows Spanish comparison message when warning equals inactivity", async () => {
        const message = await getFieldError({ inactivity_time: 10, warning_logout_time: 10 }, "warning_logout_time");
        expect(message).toBe("Si es mayor que cero, el tiempo de aviso debe ser menor que el tiempo de inactividad");
    });

    it("shows Spanish number message for non-numeric warning_logout_time", async () => {
        const message = await getFieldError({ inactivity_time: 30, warning_logout_time: "abc" }, "warning_logout_time");
        expect(message).toBe("Debe ser un número");
    });

    it("shows English max message when locale is en", async () => {
        await i18n.changeLanguage("en");
        const message = await getFieldError(
            { inactivity_time: 30, warning_logout_time: 523442344 },
            "warning_logout_time",
        );
        expect(message).toBe("Maximum 60");
        await i18n.changeLanguage("es");
    });
});

describe("GeneralSetup clients form max/min validation messages", () => {
    const adapter = joiFormikAdapter(Joi.object().pattern(CHAR_LIMIT_KEY_PATTERN, clientCharLimitSchema));

    beforeAll(async () => {
        await i18n.changeLanguage("es");
    });

    it("shows the Spanish message on the max field when max is less than min", async () => {
        try {
            await adapter.validate({ field_documento_min: 2, field_documento_max: 1 });
            expect.unreachable();
        } catch (e) {
            expect(e.inner).toEqual([
                { path: "field_documento_max", message: "El máximo no puede ser menor que el mínimo" },
            ]);
        }
    });

    it("shows the Spanish min message for a negative value", async () => {
        try {
            await adapter.validate({ field_documento_min: -20 });
            expect.unreachable();
        } catch (e) {
            expect(e.inner).toEqual([{ path: "field_documento_min", message: "Mínimo 0" }]);
        }
    });
});
