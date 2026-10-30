import { describe, expect, it } from "vitest";
import { PUBLIC_ERROR_CODES } from "@kace/error-codes";
import { resolveGroupDeleteErrorMessage } from "./resolveGroupDeleteErrorMessage";

describe("resolveGroupDeleteErrorMessage", () => {
    const t = (key) => {
        const dictionary = {
            "app.errors.public.GROUP_HAS_ACTIVE_USERS":
                "The group cannot be deleted or deactivated because users still have it as their active group.",
            "app.errors.generic": "Check the information and try again.",
            "app.forms.error_delete": "Cannot delete",
            "app.title.group_singular": "group",
        };
        return dictionary[key] ?? key;
    };

    it("translates GROUP_HAS_ACTIVE_USERS instead of exposing the English backend message", () => {
        const error = {
            response: {
                data: {
                    message: "Cannot proceed: 2 user(s) still have this group as their active group",
                    data: { code: PUBLIC_ERROR_CODES.GROUP_HAS_ACTIVE_USERS },
                },
            },
        };

        expect(resolveGroupDeleteErrorMessage(error, t)).toBe(
            "The group cannot be deleted or deactivated because users still have it as their active group.",
        );
    });

    it("falls back through getTranslatedError when there is no public error code", () => {
        expect(resolveGroupDeleteErrorMessage(new Error("network"), t)).toBe("network");
    });
});
