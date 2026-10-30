import { describe, expect, it } from "vitest";
import { formatActiveGroupUserName, parseGroupHasActiveUsersError } from "./activeGroupUsersDisplay";
import { PUBLIC_ERROR_CODES } from "@kace/error-codes";

describe("formatActiveGroupUserName", () => {
    it("joins nombres and apellidos without double spaces when apellido2 is empty", () => {
        expect(
            formatActiveGroupUserName({
                nombres: "Ana",
                apellido1: "Pérez",
                apellido2: null,
            }),
        ).toBe("Ana Pérez");
        expect(
            formatActiveGroupUserName({
                nombres: "Ana",
                apellido1: "Pérez",
                apellido2: "",
            }),
        ).toBe("Ana Pérez");
    });

    it("includes apellido2 when present", () => {
        expect(
            formatActiveGroupUserName({
                nombres: "Ana",
                apellido1: "Pérez",
                apellido2: "López",
            }),
        ).toBe("Ana Pérez López");
    });
});

describe("parseGroupHasActiveUsersError", () => {
    it("returns null for unrelated errors", () => {
        expect(parseGroupHasActiveUsersError(new Error("boom"))).toBeNull();
        expect(
            parseGroupHasActiveUsersError({
                response: { data: { data: { code: "0x050001" } } },
            }),
        ).toBeNull();
    });

    it("extracts count and users from axios-shaped payload", () => {
        const users = [{ nombres: "Ana", apellido1: "A", apellido2: "B", email: "a@x.io" }];
        expect(
            parseGroupHasActiveUsersError({
                response: {
                    data: {
                        message: "No se puede inactivar...",
                        data: {
                            code: PUBLIC_ERROR_CODES.GROUP_HAS_ACTIVE_USERS,
                            count: 1,
                            users,
                        },
                    },
                },
            }),
        ).toEqual({ count: 1, users, message: "No se puede inactivar..." });
    });
});
