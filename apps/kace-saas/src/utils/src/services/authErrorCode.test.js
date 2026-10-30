import { describe, it, expect } from "vitest";
import { PUBLIC_ERROR_CODES } from "@kace/error-codes";
import { extractAuthErrorCode } from "./authErrorCode.js";

describe("extractAuthErrorCode", () => {
    it("reads code from response data.data.code", () => {
        const error = {
            response: {
                data: {
                    data: { code: PUBLIC_ERROR_CODES.AUTH_SESSION_COOKIE_STALE },
                },
            },
        };

        expect(extractAuthErrorCode(error)).toBe(PUBLIC_ERROR_CODES.AUTH_SESSION_COOKIE_STALE);
    });

    it("reads code from message suffix when data.code is missing", () => {
        const error = {
            response: {
                data: {
                    message: `An unexpected error occurred. Please contact support:${PUBLIC_ERROR_CODES.AUTH_SESSION_KEY_MISMATCH}`,
                    data: {},
                },
            },
        };

        expect(extractAuthErrorCode(error)).toBe(PUBLIC_ERROR_CODES.AUTH_SESSION_KEY_MISMATCH);
    });

    it("maps legacy short auth suffixes during rollout", () => {
        const error = {
            response: {
                data: {
                    message: "An unexpected error occurred. Please contact support:0x0705",
                    data: {},
                },
            },
        };

        expect(extractAuthErrorCode(error)).toBe(PUBLIC_ERROR_CODES.AUTH_SESSION_KEY_MISMATCH);
    });

    it("maps legacy short auth response codes during rollout", () => {
        const error = {
            response: {
                data: {
                    data: { code: "0x0708" },
                },
            },
        };

        expect(extractAuthErrorCode(error)).toBe(PUBLIC_ERROR_CODES.AUTH_SESSION_COOKIE_STALE);
    });

    it("ignores malformed auth suffixes", () => {
        const error = {
            response: {
                data: {
                    message: "An unexpected error occurred. Please contact support:0x07000",
                    data: {},
                },
            },
        };

        expect(extractAuthErrorCode(error)).toBeUndefined();
    });

    it("returns undefined when no code is present", () => {
        expect(extractAuthErrorCode({ response: { data: { message: "Bad request" } } })).toBeUndefined();
    });
});
