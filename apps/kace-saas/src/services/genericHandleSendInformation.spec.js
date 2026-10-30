import { describe, expect, it, vi } from "vitest";
import { formatDataBeforePost, genericHandleSendInformation } from "./genericHandleSendInformation";

vi.mock("@kace/plugins", () => ({
    Uuid: () => "client-generated-id",
}));

describe("genericHandleSendInformation object identity compatibility", () => {
    it("omits canonical id on create when the endpoint uses server-generated identity", () => {
        const result = genericHandleSendInformation({
            values: {
                name: "Broker mapper",
                created_by: "attacker",
            },
            urlService: "/broker-mappers",
            options: { serverGeneratedId: true },
        });

        expect(result.url).toBe("/broker-mappers");
        expect(result.dataPost).toEqual({ name: "Broker mapper" });
        expect(result.options.serverGeneratedId).toBe(true);
    });

    it("keeps legacy client-generated ids for compatibility when serverGeneratedId is not enabled", () => {
        const result = genericHandleSendInformation({
            values: {
                name: "Legacy resource",
            },
            urlService: "/legacy",
        });

        expect(result.dataPost.id).toBe("client-generated-id");
    });

    it("omits an existing draft id on strict server-generated create paths", () => {
        const result = genericHandleSendInformation({
            values: {
                id: "draft-id",
                name: "Persisted case",
            },
            urlService: "/cases/auxiliary",
            options: { isCreate: true, serverGeneratedId: true },
        });

        expect(result.url).toBe("/cases/auxiliary");
        expect(result.dataPost).toEqual({ name: "Persisted case" });
    });

    it("uses the collection URL when serverGeneratedId create callers still carry a local id", () => {
        const result = genericHandleSendInformation({
            values: {
                id: "local-precreate-client-id",
                name: "New client",
            },
            urlService: "/clients",
            options: { serverGeneratedId: true },
        });

        expect(result.url).toBe("/clients");
        expect(result.dataPost).toEqual({ name: "New client" });
    });

    it("keeps update bodies id-free while using the path id for draft updates", () => {
        const result = genericHandleSendInformation({
            values: {
                id: "server-draft-id",
                name: "Draft",
            },
            urlService: "/tempcases",
            options: { isCreate: false },
        });

        expect(result.url).toBe("/tempcases/server-draft-id");
        expect(result.dataPost).toEqual({ name: "Draft" });
    });

    it("does not generate a fallback id when formatDataBeforePost uses serverGeneratedId", () => {
        expect(formatDataBeforePost({ name: "Temp client" }, undefined, [], { serverGeneratedId: true })).toEqual({
            name: "Temp client",
        });
    });
});

describe("formatDataBeforePost fieldsToKeepEmpty", () => {
    it("keeps an emptied string field so the API receives the order to clear it", () => {
        const dataPost = formatDataBeforePost({ login: "user", external_id: "" }, "user-1", [], {
            fieldsToKeepEmpty: ["external_id"],
        });

        expect(dataPost).toEqual({ login: "user", external_id: "" });
    });

    it("still drops empty strings for fields that are not listed", () => {
        const dataPost = formatDataBeforePost({ login: "user", external_id: "", telefono: "" }, "user-1", [], {
            fieldsToKeepEmpty: ["external_id"],
        });

        expect(dataPost).not.toHaveProperty("telefono");
    });

    it("keeps emptied objects, preserving the existing codigos_externos behaviour", () => {
        const dataPost = formatDataBeforePost({ login: "user", codigos_externos: {}, grid: {} }, "user-1", [], {
            fieldsToKeepEmpty: ["codigos_externos"],
        });

        expect(dataPost).toEqual({ login: "user", codigos_externos: {} });
    });
});

describe("formatDataBeforePost", () => {
    it("does not generate an id when generateId is false", () => {
        const dataPost = formatDataBeforePost(
            {
                interaction_id: "interaction-1",
                caso_id: "case-1",
            },
            undefined,
            [],
            { generateId: false },
        );

        expect(dataPost).toEqual({
            interaction_id: "interaction-1",
            caso_id: "case-1",
        });
    });
});
