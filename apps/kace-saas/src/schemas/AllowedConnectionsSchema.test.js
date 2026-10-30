import { beforeAll, describe, expect, it } from "vitest";
import i18n from "i18next";
import { joiFormikAdapter } from "@/utils/src/joiFormikAdapter";
import { AllowedConnectionForm } from "./AllowedConnectionsSchema";

const adapter = joiFormikAdapter(AllowedConnectionForm);

const validAllowedConnection = {
    description: "Allowed connection",
    connection: "api.example.com",
    has_ssl: false,
    certificate: "",
    is_active: 1,
};

async function getFieldError(data, field) {
    try {
        await adapter.validate(data);
        return null;
    } catch (e) {
        return e.inner.find((err) => err.path === field)?.message ?? null;
    }
}

describe("AllowedConnectionForm", () => {
    beforeAll(async () => {
        await i18n.changeLanguage("en");
    });

    it("requires certificate when SSL is enabled and the fingerprint is blank", async () => {
        const message = await getFieldError(
            { ...validAllowedConnection, has_ssl: true, certificate: "" },
            "certificate",
        );

        expect(message).toBe("Required");
    });

    it("allows a blank certificate when SSL is disabled", async () => {
        const message = await getFieldError(validAllowedConnection, "certificate");

        expect(message).toBeNull();
    });

    it.each([false, 0])("rejects a fingerprint when SSL is disabled with %p", (hasSsl) => {
        const { error } = AllowedConnectionForm.validate({
            ...validAllowedConnection,
            has_ssl: hasSsl,
            certificate: "12341234",
        });

        expect(error?.details).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    path: ["certificate"],
                    type: "any.only",
                }),
            ]),
        );
    });

    it("does not require certificate before SSL state is available", async () => {
        const { has_ssl, ...allowedConnectionWithoutSslState } = validAllowedConnection;

        const message = await getFieldError(allowedConnectionWithoutSslState, "certificate");

        expect(message).toBeNull();
    });
});
