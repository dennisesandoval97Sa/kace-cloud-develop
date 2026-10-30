import { describe, it, expect } from "vitest";
import Joi from "joi";
import {
    clientCharLimitSchema,
    GeneralSetupSchemaForm,
    generalSetupSessionTimingShape,
    reopenCasesOnlyLastDaysSchema,
} from "./GeneralSetupSchemaForm";

const sessionFields = Joi.object(generalSetupSessionTimingShape);

const buildValidPayload = (overrides = {}) => ({
    description: "Configuración global del agente",
    label_1: "Etiqueta uno",
    label_2: "Etiqueta dos",
    label_3: "Etiqueta tres",
    label_4: "Etiqueta cuatro",
    label_5: "Etiqueta cinco",
    label_6: "Etiqueta seis",
    label_7: "Etiqueta siete",
    label_8: "Etiqueta ocho",
    label_9: "Etiqueta nueve",
    label_10: "Etiqueta diez",
    tipo_documento: "Cédula",
    documento: "Documento",
    nombres: "Nombres",
    apellido1: "Apellido uno",
    apellido2: "Apellido dos",
    nombre_empresa: "Empresa",
    sexo: "Sexo",
    estado_civil: "Estado civil",
    fecha_nacimiento: "Fecha de nacimiento",
    email: "Correo",
    email_alterno: "Correo alterno",
    telefono: "Teléfono",
    telefono_alterno: "Teléfono alterno",
    reference: "Referencia",
    habeas_data: "Habeas data",
    inactivity_time: 30,
    warning_logout_time: 5,
    ...overrides,
});

describe("GeneralSetupSchemaForm inactivity and warning", () => {
    it("accepts valid pair", async () => {
        await expect(sessionFields.validateAsync({ inactivity_time: 30, warning_logout_time: 5 })).resolves.toEqual({
            inactivity_time: 30,
            warning_logout_time: 5,
        });
    });

    it("rejects inactivity_time above 480", async () => {
        await expect(
            sessionFields.validateAsync({ inactivity_time: 500, warning_logout_time: 5 }),
        ).rejects.toBeDefined();
    });

    it("rejects inactivity_time below 1", async () => {
        await expect(sessionFields.validateAsync({ inactivity_time: 0, warning_logout_time: 1 })).rejects.toBeDefined();
    });

    it("rejects warning_logout_time not strictly less than inactivity_time", async () => {
        await expect(
            sessionFields.validateAsync({ inactivity_time: 10, warning_logout_time: 10 }),
        ).rejects.toBeDefined();
    });

    it("rejects warning_logout_time above 60", async () => {
        await expect(
            sessionFields.validateAsync({ inactivity_time: 30, warning_logout_time: 61 }),
        ).rejects.toBeDefined();
    });

    it("accepts warning_logout_time 0 with inactivity_time 1", async () => {
        await expect(sessionFields.validateAsync({ inactivity_time: 1, warning_logout_time: 0 })).resolves.toEqual({
            inactivity_time: 1,
            warning_logout_time: 0,
        });
    });
});

describe("GeneralSetupSchemaForm active_session_limit", () => {
    const field = Joi.object({ active_session_limit: GeneralSetupSchemaForm.extract("active_session_limit") });

    it.each([[1], [30], [60]])("accepts a valid value (%p)", async (value) => {
        await expect(field.validateAsync({ active_session_limit: value })).resolves.toEqual({
            active_session_limit: value,
        });
    });

    it.each([[0], [-1], [61], [1.5], [""], ["abc"]])("rejects an invalid value (%p)", async (value) => {
        await expect(field.validateAsync({ active_session_limit: value })).rejects.toBeDefined();
    });

    it("falls back to the default (2) when omitted", async () => {
        await expect(field.validateAsync({})).resolves.toEqual({ active_session_limit: 2 });
    });
});

describe("GeneralSetupSchemaForm assignment_active_session_limit", () => {
    const field = Joi.object({
        assignment_active_session_limit: GeneralSetupSchemaForm.extract("assignment_active_session_limit"),
    });

    it.each([[1], [30], [60]])("accepts a valid value (%p)", async (value) => {
        await expect(field.validateAsync({ assignment_active_session_limit: value })).resolves.toEqual({
            assignment_active_session_limit: value,
        });
    });

    it.each([[0], [-1], [61], [1.5], [""], ["abc"]])("rejects an invalid value (%p)", async (value) => {
        await expect(field.validateAsync({ assignment_active_session_limit: value })).rejects.toBeDefined();
    });

    it("falls back to the default (2) when omitted", async () => {
        await expect(field.validateAsync({})).resolves.toEqual({ assignment_active_session_limit: 2 });
    });
});

describe("GeneralSetupSchemaForm report_filter_days", () => {
    const field = Joi.object({ report_filter_days: GeneralSetupSchemaForm.extract("report_filter_days") });

    it.each([[1], [15], [30]])("accepts a valid value (%p)", async (value) => {
        await expect(field.validateAsync({ report_filter_days: value })).resolves.toEqual({
            report_filter_days: value,
        });
    });

    it.each([[0], [31], [2.5], ["abc"]])("rejects an invalid value (%p)", async (value) => {
        await expect(field.validateAsync({ report_filter_days: value })).rejects.toBeDefined();
    });
});

describe("GeneralSetupSchemaForm agent table headers configuration", () => {
    it("accepts headers_labels as an array of { key, label } entries", async () => {
        const payload = buildValidPayload({
            headers_labels: [{ key: "reference", label: "Consecutivo" }],
        });
        const result = await GeneralSetupSchemaForm.validateAsync(payload);
        expect(result.headers_labels).toEqual([{ key: "reference", label: "Consecutivo" }]);
    });

    it("rejects headers_labels entries with empty label", async () => {
        const payload = buildValidPayload({
            headers_labels: [{ key: "reference", label: "" }],
        });
        await expect(GeneralSetupSchemaForm.validateAsync(payload)).rejects.toBeDefined();
    });

    it("rejects headers_labels entries with empty key", async () => {
        const payload = buildValidPayload({
            headers_labels: [{ key: "", label: "Consecutivo" }],
        });
        await expect(GeneralSetupSchemaForm.validateAsync(payload)).rejects.toBeDefined();
    });

    it("accepts show_columns_dropdown set to false", async () => {
        const payload = buildValidPayload({ show_columns_dropdown: false });
        const result = await GeneralSetupSchemaForm.validateAsync(payload);
        expect(result.show_columns_dropdown).toBe(false);
    });

    it("accepts show_time_description_prefixes set to false", async () => {
        const payload = buildValidPayload({ show_time_description_prefixes: false });
        const result = await GeneralSetupSchemaForm.validateAsync(payload);
        expect(result.show_time_description_prefixes).toBe(false);
    });

    it("defaults headers_labels to [] when omitted", async () => {
        const payload = buildValidPayload();
        const result = await GeneralSetupSchemaForm.validateAsync(payload);
        expect(result.headers_labels).toEqual([]);
    });

    it("defaults show_columns_dropdown to true when omitted", async () => {
        const payload = buildValidPayload();
        const result = await GeneralSetupSchemaForm.validateAsync(payload);
        expect(result.show_columns_dropdown).toBe(true);
    });

    it("defaults show_time_description_prefixes to true when omitted", async () => {
        const payload = buildValidPayload();
        const result = await GeneralSetupSchemaForm.validateAsync(payload);
        expect(result.show_time_description_prefixes).toBe(true);
    });
});

describe("case_stale_check", () => {
    it("keeps null so General Setup can omit the unified key until the checkbox is touched", async () => {
        const result = await GeneralSetupSchemaForm.validateAsync(
            buildValidPayload({ case_stale_check: null, transition_stale_check: true }),
        );
        expect(result.case_stale_check).toBeNull();
        expect(result.transition_stale_check).toBe(true);
    });

    it("accepts an explicit boolean", async () => {
        const result = await GeneralSetupSchemaForm.validateAsync(buildValidPayload({ case_stale_check: true }));
        expect(result.case_stale_check).toBe(true);
    });
});

describe("reopen_cases_only_last_days", () => {
    it("accepts 0 and 7", async () => {
        await expect(reopenCasesOnlyLastDaysSchema.validateAsync(0)).resolves.toBe(0);
        await expect(reopenCasesOnlyLastDaysSchema.validateAsync(7)).resolves.toBe(7);
    });

    it("defaults undefined to 7", async () => {
        await expect(reopenCasesOnlyLastDaysSchema.validateAsync(undefined)).resolves.toBe(7);
    });

    it("rejects negatives", async () => {
        await expect(reopenCasesOnlyLastDaysSchema.validateAsync(-1)).rejects.toBeDefined();
    });

    it("rejects values above 36500", async () => {
        await expect(reopenCasesOnlyLastDaysSchema.validateAsync(36501)).rejects.toBeDefined();
    });
});

describe("clients form max/min characters", () => {
    it("rejects a max lower than its min", async () => {
        const payload = buildValidPayload({ field_documento_min: 2, field_documento_max: 1 });
        await expect(GeneralSetupSchemaForm.validateAsync(payload)).rejects.toMatchObject({
            details: [expect.objectContaining({ path: ["field_documento_max"] })],
        });
    });

    it("accepts a max equal to its min for exact-length fields", async () => {
        const payload = buildValidPayload({ field_telefono_min: 10, field_telefono_max: 10 });
        await expect(GeneralSetupSchemaForm.validateAsync(payload)).resolves.toBeDefined();
    });

    it("compares numeric strings as numbers", async () => {
        const payload = buildValidPayload({ field_telefono_min: "9", field_telefono_max: "10" });
        await expect(GeneralSetupSchemaForm.validateAsync(payload)).resolves.toBeDefined();
    });

    it("accepts a max greater than its min", async () => {
        const payload = buildValidPayload({ field_documento_min: 1, field_documento_max: 2 });
        await expect(GeneralSetupSchemaForm.validateAsync(payload)).resolves.toBeDefined();
    });

    it.each([
        ["field_documento_min", -1],
        ["field_documento_max", -1],
        ["field_documento_min", "-20"],
    ])("rejects a negative value in %s (%s)", async (key, value) => {
        const payload = buildValidPayload({ [key]: value });
        await expect(GeneralSetupSchemaForm.validateAsync(payload)).rejects.toMatchObject({
            details: [expect.objectContaining({ path: [key], type: "number.min" })],
        });
    });

    it("rejects negative min and max even when max is greater than min", async () => {
        const payload = buildValidPayload({ field_documento_min: -20, field_documento_max: -1 });
        await expect(GeneralSetupSchemaForm.validateAsync(payload)).rejects.toBeDefined();
    });

    it.each([
        ["field_documento_min", 2.5],
        ["field_documento_max", "10.5"],
    ])("rejects a decimal value in %s (%s)", async (key, value) => {
        const payload = buildValidPayload({ [key]: value });
        await expect(GeneralSetupSchemaForm.validateAsync(payload)).rejects.toMatchObject({
            details: [expect.objectContaining({ path: [key], type: "number.integer" })],
        });
    });

    it.each([
        [5, 0],
        [0, 0],
        ["5", "0"],
    ])("treats max=0 as no limit (min=%s, max=%s)", async (min, max) => {
        const payload = buildValidPayload({ field_documento_min: min, field_documento_max: max });
        await expect(GeneralSetupSchemaForm.validateAsync(payload)).resolves.toBeDefined();
    });

    it("accepts 0 as min", async () => {
        const payload = buildValidPayload({ field_documento_min: 0, field_documento_max: 5 });
        await expect(GeneralSetupSchemaForm.validateAsync(payload)).resolves.toBeDefined();
    });

    it.each([
        ["", ""],
        [5, ""],
        ["", 5],
        [null, 5],
        [5, undefined],
    ])("skips the comparison when min=%s and max=%s", async (min, max) => {
        const payload = buildValidPayload({ field_email_min: min, field_email_max: max });
        await expect(GeneralSetupSchemaForm.validateAsync(payload)).resolves.toBeDefined();
    });

    it.each([
        [2, -1, ["field_documento_max"], "number.min"],
        [2.5, 2, ["field_documento_min"], "number.integer"],
    ])("reports only the invalid value, not the max/min comparison (min=%s, max=%s)", async (min, max, path, type) => {
        const payload = buildValidPayload({ field_documento_min: min, field_documento_max: max });
        await expect(GeneralSetupSchemaForm.validateAsync(payload, { abortEarly: false })).rejects.toMatchObject({
            details: [expect.objectContaining({ path, type })],
        });
    });

    it("rejects a non-numeric value as number.base", async () => {
        const payload = buildValidPayload({ field_documento_min: "abc" });
        await expect(GeneralSetupSchemaForm.validateAsync(payload)).rejects.toMatchObject({
            details: [expect.objectContaining({ path: ["field_documento_min"], type: "number.base" })],
        });
    });

    it("validates a single limit under a key that is not a char-limit key", () => {
        const limitSchema = Joi.object({ limit: clientCharLimitSchema });

        expect(limitSchema.validate({ limit: 5 }).error).toBeUndefined();
        expect(limitSchema.validate({ limit: -1 }).error?.details[0].type).toBe("number.min");
    });

    it("gives readable messages when validated without joiFormikAdapter", async () => {
        const payload = buildValidPayload({ field_documento_min: 2, field_documento_max: 1 });
        await expect(GeneralSetupSchemaForm.validateAsync(payload)).rejects.toMatchObject({
            details: [expect.objectContaining({ message: '"field_documento_max" must not be less than its min' })],
        });
    });
});
