import { describe, expect, it } from "vitest";
import { PUBLIC_ERROR_CODES } from "@kace/error-codes";
import { getTranslatedError, getTranslatedPublicErrorCode } from "./getTranslatedError.js";
import es from "@/locale/es.json";
import en from "@/locale/en.json";

const translations = {
    "app.errors.generic": "Generic localized error",
    "app.errors.public.VALIDATION_ERROR": "Check the information and try again.",
    "app.errors.public.AUTHORIZATION_ERROR": "You do not have permission to perform this action.",
    "app.errors.public.CASE_BULK_TRANSITION_MIXED_CURRENT_TRANSITION": "Cases must share the same current transition.",
    "app.errors.public.BOARD_EXPORT_NO_RECORDS": "No records were found for this export.",
    "app.errors.public.RESOURCE_ALREADY_EXISTS": "A record with the same value already exists.",
    "app.errors.public.MAIL_ACCOUNT_HOST_NOT_ALLOWED":
        "The mail server host is not authorized. Add it to the allowed connections first.",
    "app.errors.public.HELP_ATTACHMENT_FILENAME_REJECTED":
        "This attachment filename is not allowed. Remove the attachment, or rename the file and try again.",
    "app.errors.public.GROUP_CREATE_USERS_NOT_FOUND": "One or more selected users no longer exist.",
    "app.errors.public.SHIFT_MANAGEMENT_IN_USE_BY_GROUPS":
        "The schedule cannot be deleted because groups still use it. Assign them another schedule first.",
    "app.errors.public.CLASSIFICATION_CREATE_TEMPLATES_NOT_FOUND": "One or more selected templates no longer exist.",
    "app.errors.public.CASE_REOPEN_WINDOW_EXCEEDED": "Only cases created in the last days can be reopened.",
    "app.errors.public.CASE_REOPEN_CONFIG_UNAVAILABLE": "The reopen window could not be validated.",
    "app.errors.public.CASE_REOPEN_CASE_NOT_CLOSED": "The case is not closed and cannot be reopened.",
    "boards.bulkActions.apiErrors.sameTransitionRequired": "Same transition required",
};

const t = (key, options) => translations[key] ?? options?.defaultValue ?? key;

const apiError = (message) => ({ response: { data: { message } } });

describe("getTranslatedError", () => {
    it("prefers nested public error codes over backend details and legacy substrings", () => {
        const error = {
            response: {
                data: {
                    message: "You do not have permission",
                    data: { code: PUBLIC_ERROR_CODES.VALIDATION_ERROR },
                    errors: [{ message: '"first_name" is required' }],
                },
            },
        };

        expect(getTranslatedError(error, t)).toBe("Check the information and try again.");
    });

    it("maps the dedicated uniqueness public error code to the duplicate message (sanitized payload)", () => {
        // Real payload when the backend hides details: only the public code travels, message is the safe one.
        const error = {
            response: {
                data: {
                    message: "The request could not be processed.",
                    data: { code: PUBLIC_ERROR_CODES.RESOURCE_ALREADY_EXISTS },
                },
            },
        };

        expect(getTranslatedError(error, t)).toBe("A record with the same value already exists.");
    });

    it("maps the mail account host public error code to the specific message (sanitized payload)", () => {
        const error = {
            response: {
                data: {
                    message: "Bad request",
                    data: { code: PUBLIC_ERROR_CODES.MAIL_ACCOUNT_HOST_NOT_ALLOWED },
                },
            },
        };

        expect(getTranslatedError(error, t)).toBe(
            "The mail server host is not authorized. Add it to the allowed connections first.",
        );
    });

    it("maps the Help attachment filename code to safe actionable feedback", () => {
        expect(PUBLIC_ERROR_CODES.HELP_ATTACHMENT_FILENAME_REJECTED).toBe("0x120001");
        const error = {
            response: {
                data: {
                    message: "Bad request",
                    data: { code: "0x120001" },
                },
            },
        };

        expect(getTranslatedError(error, t)).toBe(
            "This attachment filename is not allowed. Remove the attachment, or rename the file and try again.",
        );
    });

    it("translates a public error code directly without an HTTP response shape", () => {
        expect(getTranslatedPublicErrorCode(PUBLIC_ERROR_CODES.HELP_ATTACHMENT_FILENAME_REJECTED, t)).toBe(
            "This attachment filename is not allowed. Remove the attachment, or rename the file and try again.",
        );
    });

    it("maps a schedule still used by groups to the localized delete message", () => {
        const error = {
            response: {
                data: {
                    message: "Bad request",
                    data: { code: PUBLIC_ERROR_CODES.SHIFT_MANAGEMENT_IN_USE_BY_GROUPS },
                },
            },
        };

        expect(getTranslatedError(error, t)).toBe(
            "The schedule cannot be deleted because groups still use it. Assign them another schedule first.",
        );
    });

    it("keeps the schedule-in-use mock copy equal to the real en locale", () => {
        expect(translations["app.errors.public.SHIFT_MANAGEMENT_IN_USE_BY_GROUPS"]).toBe(
            en.app.errors.public.SHIFT_MANAGEMENT_IN_USE_BY_GROUPS,
        );
    });

    it("maps an unknown selected user during group creation to the localized message", () => {
        const error = {
            response: {
                data: {
                    message: "The request could not be processed.",
                    data: { code: PUBLIC_ERROR_CODES.GROUP_CREATE_USERS_NOT_FOUND },
                },
            },
        };

        expect(getTranslatedError(error, t)).toBe("One or more selected users no longer exist.");
    });

    it("translates top-level public error codes", () => {
        const error = {
            response: {
                data: {
                    code: PUBLIC_ERROR_CODES.AUTHORIZATION_ERROR,
                    message: "An unexpected error occurred.",
                },
            },
        };

        expect(getTranslatedError(error, t)).toBe("You do not have permission to perform this action.");
    });

    it("translates case workflow public error codes without backend message details", () => {
        const error = {
            response: {
                data: {
                    message: "The request could not be processed.",
                    data: { code: PUBLIC_ERROR_CODES.CASE_BULK_TRANSITION_MIXED_CURRENT_TRANSITION },
                },
            },
        };

        expect(getTranslatedError(error, t)).toBe("Cases must share the same current transition.");
    });

    it("translates board public error codes without backend message details", () => {
        const error = {
            response: {
                data: {
                    message: "The request could not be processed.",
                    data: { code: PUBLIC_ERROR_CODES.BOARD_EXPORT_NO_RECORDS },
                },
            },
        };

        expect(getTranslatedError(error, t)).toBe("No records were found for this export.");
    });

    it("keeps known substring handling as a backward-compatible fallback", () => {
        const error = {
            response: {
                data: {
                    message: "Cases must share the same current transition before this action runs.",
                },
            },
        };

        expect(getTranslatedError(error, t)).toBe("Same transition required");
    });

    it("does not build generic mutation toasts from backend validation field details", () => {
        const error = {
            response: {
                data: {
                    errors: [{ message: '"first_name" is required' }],
                },
            },
        };

        expect(getTranslatedError(error, t)).toBe("Generic localized error");
    });

    it("maps 'already closed' to the localized interactions key", () => {
        expect(getTranslatedError(apiError("Some interactions are already closed"), t)).toBe(
            "interactions.bulk.apiErrors.alreadyClosed",
        );
    });

    it("distinguishes 'already deleted' from 'deleted'", () => {
        expect(getTranslatedError(apiError("Some interactions are already deleted"), t)).toBe(
            "interactions.bulk.apiErrors.alreadyDeleted",
        );
        expect(getTranslatedError(apiError("Some interactions are deleted"), t)).toBe(
            "interactions.bulk.apiErrors.deleted",
        );
    });

    it("maps the remaining bulk validation errors", () => {
        expect(getTranslatedError(apiError("Interactions are already in the destination workspace"), t)).toBe(
            "interactions.bulk.apiErrors.alreadyInDestination",
        );
        expect(getTranslatedError(apiError("Destination workspace does not exist or is inactive"), t)).toBe(
            "interactions.bulk.apiErrors.destinationInactive",
        );
        expect(
            getTranslatedError(apiError("Interactions not found: a, b. Select existing interactions and retry."), t),
        ).toBe("interactions.bulk.apiErrors.notFound");
        expect(getTranslatedError(apiError("Invalid interaction motive"), t)).toBe(
            "interactions.bulk.apiErrors.invalidMotive",
        );
    });

    it("falls back to the raw message when there is no known mapping", () => {
        expect(getTranslatedError(apiError("Totally unrelated error"), t)).toBe("Totally unrelated error");
    });

    it("maps CASE_REOPEN_WINDOW_EXCEEDED from the public catalog", () => {
        const error = {
            response: {
                data: {
                    data: { code: PUBLIC_ERROR_CODES.CASE_REOPEN_WINDOW_EXCEEDED, days: 7 },
                },
            },
        };

        expect(getTranslatedError(error, t)).toBe("Only cases created in the last days can be reopened.");
    });

    it("passes public data through i18n replace so reserved option keys cannot override", () => {
        const tWithVars = (key, vars = {}) => {
            if (key === "app.errors.generic") {
                return "Generic localized error";
            }
            expect(vars.defaultValue).toBe("Generic localized error");
            expect(vars.replace).toEqual({ days: 7, defaultValue: "hack" });
            return `${key}:${vars.replace.days}`;
        };
        const error = {
            response: {
                data: {
                    data: { code: PUBLIC_ERROR_CODES.CASE_REOPEN_WINDOW_EXCEEDED, days: 7, defaultValue: "hack" },
                },
            },
        };

        expect(getTranslatedError(error, tWithVars)).toBe("app.errors.public.CASE_REOPEN_WINDOW_EXCEEDED:7");
    });

    it("passes days from public data to i18n for CASE_REOPEN_WINDOW_EXCEEDED", () => {
        const tWithVars = (key, vars) => `${key}:${vars?.replace?.days}`;
        const error = {
            response: {
                data: {
                    data: { code: PUBLIC_ERROR_CODES.CASE_REOPEN_WINDOW_EXCEEDED, days: 7 },
                },
            },
        };

        expect(getTranslatedError(error, tWithVars)).toBe("app.errors.public.CASE_REOPEN_WINDOW_EXCEEDED:7");
    });

    it("maps CASE_REOPEN_CONFIG_UNAVAILABLE from the public catalog", () => {
        const error = {
            response: {
                data: {
                    data: { code: PUBLIC_ERROR_CODES.CASE_REOPEN_CONFIG_UNAVAILABLE },
                },
            },
        };

        expect(getTranslatedError(error, t)).toBe("The reopen window could not be validated.");
    });

    it("maps CASE_REOPEN_CASE_NOT_CLOSED from the public catalog", () => {
        const error = {
            response: {
                data: {
                    data: { code: PUBLIC_ERROR_CODES.CASE_REOPEN_CASE_NOT_CLOSED },
                },
            },
        };

        expect(getTranslatedError(error, t)).toBe("The case is not closed and cannot be reopened.");
    });

    it("keeps reopen window copy in es and en public catalog keys", () => {
        expect(es.app.errors.public.CASE_REOPEN_WINDOW_EXCEEDED).toContain("{{days}}");
        expect(en.app.errors.public.CASE_REOPEN_WINDOW_EXCEEDED).toContain("{{days}}");
        expect(es.app.errors.public.CASE_REOPEN_CONFIG_UNAVAILABLE).toEqual(expect.any(String));
        expect(en.app.errors.public.CASE_REOPEN_CONFIG_UNAVAILABLE).toEqual(expect.any(String));
        expect(es.app.errors.public.CASE_REOPEN_CASE_NOT_CLOSED).toEqual(expect.any(String));
        expect(en.app.errors.public.CASE_REOPEN_CASE_NOT_CLOSED).toEqual(expect.any(String));
        expect(es.app.errors.public.CASE_REOPEN_CASE_NOT_FOUND).toEqual(expect.any(String));
        expect(en.app.errors.public.CASE_REOPEN_CASE_NOT_FOUND).toEqual(expect.any(String));
        expect(es.app.errors.public.CASE_REOPEN_NO_ACTIVE_GROUP).toEqual(expect.any(String));
        expect(en.app.errors.public.CASE_REOPEN_NO_ACTIVE_GROUP).toEqual(expect.any(String));
        expect(es.app.errors.public.CASE_REOPEN_USER_GROUP_NOT_FOUND).toEqual(expect.any(String));
        expect(en.app.errors.public.CASE_REOPEN_USER_GROUP_NOT_FOUND).toEqual(expect.any(String));
        expect(es.app.errors.public.CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE).toBe(
            "No se pudo asignar una persona responsable al caso.",
        );
        expect(en.app.errors.public.CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE).toBe(
            "Could not assign a person responsible to the case.",
        );
    });

    it("maps CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE (0x030005) from the public catalog", () => {
        const error = {
            response: {
                data: {
                    code: PUBLIC_ERROR_CODES.CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE,
                },
            },
        };

        const tEs = (key) => {
            const parts = key.split(".");
            let cur = es;
            for (const p of parts) cur = cur?.[p];
            return cur ?? key;
        };

        const tEn = (key) => {
            const parts = key.split(".");
            let cur = en;
            for (const p of parts) cur = cur?.[p];
            return cur ?? key;
        };

        expect(getTranslatedError(error, tEs)).toBe("No se pudo asignar una persona responsable al caso.");
        expect(getTranslatedError(error, tEn)).toBe("Could not assign a person responsible to the case.");
        expect(es.app.errors.public.CASE_ASSIGNMENT_GROUP_UNAVAILABLE).toEqual(expect.any(String));
        expect(en.app.errors.public.CASE_ASSIGNMENT_GROUP_UNAVAILABLE).toEqual(expect.any(String));
        expect(es.app.errors.public.CASE_ASSIGNMENT_USER_UNAVAILABLE).toEqual(expect.any(String));
        expect(en.app.errors.public.CASE_ASSIGNMENT_USER_UNAVAILABLE).toEqual(expect.any(String));
        expect(es.app.errors.public.CASE_ASSIGNMENT_USER_GROUP_UNAVAILABLE).toEqual(expect.any(String));
        expect(en.app.errors.public.CASE_ASSIGNMENT_USER_GROUP_UNAVAILABLE).toEqual(expect.any(String));
    });

    it("maps CASE_ASSIGNMENT_GROUP_UNAVAILABLE, CASE_ASSIGNMENT_USER_UNAVAILABLE, and CASE_ASSIGNMENT_USER_GROUP_UNAVAILABLE from public catalog", () => {
        expect(
            getTranslatedError(
                { response: { data: { data: { code: PUBLIC_ERROR_CODES.CASE_ASSIGNMENT_GROUP_UNAVAILABLE } } } },
                (key) => es[key.split(".")[0]]?.[key.split(".")[1]]?.[key.split(".")[2]]?.[key.split(".")[3]] ?? key,
            ),
        ).toBe("El grupo seleccionado está inactivo o no existe.");

        expect(
            getTranslatedError(
                { response: { data: { data: { code: PUBLIC_ERROR_CODES.CASE_ASSIGNMENT_USER_UNAVAILABLE } } } },
                (key) => es[key.split(".")[0]]?.[key.split(".")[1]]?.[key.split(".")[2]]?.[key.split(".")[3]] ?? key,
            ),
        ).toBe("El usuario seleccionado está inactivo o no existe.");

        expect(
            getTranslatedError(
                { response: { data: { data: { code: PUBLIC_ERROR_CODES.CASE_ASSIGNMENT_USER_GROUP_UNAVAILABLE } } } },
                (key) => es[key.split(".")[0]]?.[key.split(".")[1]]?.[key.split(".")[2]]?.[key.split(".")[3]] ?? key,
            ),
        ).toBe("El usuario no pertenece al grupo o la relación no está disponible.");
    });

    it("translates bulk case public error codes from es and en locale files", () => {
        const tFrom = (locale) => (key) => key.split(".").reduce((node, segment) => node?.[segment], locale) ?? key;

        expect(
            getTranslatedError(
                { response: { data: { data: { code: PUBLIC_ERROR_CODES.CASE_BULK_CASES_ALREADY_CLOSED } } } },
                tFrom(es),
            ),
        ).toBe("Algunos de los casos seleccionados ya están cerrados.");
        expect(
            getTranslatedError(
                { response: { data: { data: { code: PUBLIC_ERROR_CODES.CASE_BULK_CASES_ALREADY_CLOSED } } } },
                tFrom(en),
            ),
        ).toBe("Some of the selected cases are already closed.");
        expect(
            getTranslatedError(
                { response: { data: { data: { code: PUBLIC_ERROR_CODES.CASE_BULK_CASES_NOT_FOUND } } } },
                tFrom(en),
            ),
        ).toBe("One or more of the selected cases do not exist.");
        expect(
            getTranslatedError(
                { response: { data: { data: { code: PUBLIC_ERROR_CODES.CASE_BULK_TRANSITION_NOT_FOUND } } } },
                tFrom(en),
            ),
        ).toBe("The selected transition does not exist.");
    });
});
