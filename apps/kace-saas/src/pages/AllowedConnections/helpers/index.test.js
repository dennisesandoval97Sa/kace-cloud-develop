import { describe, expect, it } from "vitest";
import { buildAllowedConnectionMutation } from ".";

describe("buildAllowedConnectionMutation", () => {
    it("keeps a cleared certificate in an update when HTTPS is disabled", () => {
        const request = buildAllowedConnectionMutation({
            values: {
                id: "allowed-connection-id",
                connection: "facebook.com",
                description: "Facebook",
                certificate: "",
                optional_note: "",
                has_ssl: false,
                is_active: true,
            },
            urlService: "/allowed-connections",
            pending: false,
        });

        expect(request.url).toBe("/allowed-connections/allowed-connection-id");
        expect(request.dataPost).toEqual({
            connection: "facebook.com",
            description: "Facebook",
            certificate: "",
            has_ssl: false,
            is_active: true,
        });
        expect(request.options).toEqual({});
    });

    it("clears a stale fingerprint from an update when HTTPS is disabled", () => {
        const values = {
            id: "allowed-connection-id",
            connection: "instagram.com",
            description: "Instagram url test",
            certificate: "12341234",
            has_ssl: false,
            is_active: true,
        };

        const request = buildAllowedConnectionMutation({
            values,
            urlService: "/allowed-connections",
            pending: false,
        });

        expect(request.dataPost).toMatchObject({
            certificate: "",
            has_ssl: false,
        });
        expect(values.certificate).toBe("12341234");
    });

    it("keeps the existing create behavior when HTTPS is disabled", () => {
        const request = buildAllowedConnectionMutation({
            values: {
                connection: "facebook.com",
                description: "Facebook",
                certificate: "",
                has_ssl: false,
                is_active: true,
            },
            urlService: "/allowed-connections",
            pending: false,
        });

        expect(request.url).toBe("/allowed-connections");
        expect(request.dataPost).not.toHaveProperty("certificate");
    });
});
