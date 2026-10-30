import { describe, expect, it } from "vitest";
import { BOARDS_INITIAL_FILTER } from "@kace_v2/features/boards/constants/boards.constants";
import { isBoardIdentityFunction } from "./boardFunctionsHelper.util";

describe("isBoardIdentityFunction", () => {
    it("is true for logged_in_user, logged_in_user_group, and active_client", () => {
        expect(isBoardIdentityFunction(BOARDS_INITIAL_FILTER.LOGGED_IN_USER)).toBe(true);
        expect(isBoardIdentityFunction(BOARDS_INITIAL_FILTER.LOGGED_IN_USER_GROUP)).toBe(true);
        expect(isBoardIdentityFunction(BOARDS_INITIAL_FILTER.ACTIVE_CLIENT)).toBe(true);
    });

    it("is false for date functions and empty values", () => {
        expect(isBoardIdentityFunction("date_calculated_add")).toBe(false);
        expect(isBoardIdentityFunction("")).toBe(false);
        expect(isBoardIdentityFunction(undefined)).toBe(false);
    });
});
