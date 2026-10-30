import { beforeEach, describe, expect, it, vi } from "vitest";
import { genericSearchService } from "@/services/genericSearchService";
import {
    buildSuggestedClientFilters,
    extractSenderEmailAddress,
    filterExactSuggestedClients,
    searchSuggestedClientsByEmail,
} from "./suggestedInteractionClients";

vi.mock("@/services/genericSearchService", () => ({
    genericSearchService: vi.fn(),
}));

describe("suggestedInteractionClients", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("extracts one normalized sender email from a display address", () => {
        expect(extractSenderEmailAddress("Cliente Demo <CLIENTE@DEMO.COM>")).toBe("cliente@demo.com");
    });

    it("skips sender values with more than one email address", () => {
        expect(extractSenderEmailAddress("one@example.com, two@example.com")).toBe("");
    });

    it("keeps only exact primary-email matches from search results", () => {
        const clients = filterExactSuggestedClients(
            [
                { id: "client-1", email: "cliente@demo.com", nombres: "Primary" },
                { id: "client-2", email_alterno: "CLIENTE@DEMO.COM", nombres: "Alternate" },
                { id: "client-3", email: "otro-cliente@demo.com", nombres: "Partial" },
            ],
            "cliente@demo.com",
        );

        expect(clients).toEqual([
            expect.objectContaining({
                id: "client-1",
                suggestedClientMatchedFields: [{ key: "email", value: "cliente@demo.com" }],
            }),
        ]);
    });

    it("builds a restricted-search-authorized primary email filter", () => {
        expect(buildSuggestedClientFilters("cliente@demo.com")).toEqual([
            {
                field: "email",
                operator: "ilike",
                value: "cliente@demo.com",
                type: "AND",
            },
            {
                field: "status",
                operator: "eq",
                value: 1,
                type: "AND",
            },
        ]);
    });

    it("searches active Clients by primary email before exact filtering", async () => {
        genericSearchService.mockResolvedValue({
            data: [
                { id: "client-1", email: "cliente@demo.com", nombres: "Primary" },
                { id: "client-2", email: "otro-cliente@demo.com", nombres: "Partial" },
            ],
        });

        const result = await searchSuggestedClientsByEmail("Cliente Demo <CLIENTE@DEMO.COM>");

        expect(genericSearchService).toHaveBeenCalledWith(
            "/clients/search",
            [
                {
                    field: "email",
                    operator: "ilike",
                    value: "cliente@demo.com",
                    type: "AND",
                },
                {
                    field: "status",
                    operator: "eq",
                    value: 1,
                    type: "AND",
                },
            ],
            { limit: 50, offset: 0 },
            "clients",
        );
        expect(result).toEqual({
            senderEmail: "cliente@demo.com",
            clients: [
                expect.objectContaining({
                    id: "client-1",
                    suggestedClientMatchedFields: [{ key: "email", value: "cliente@demo.com" }],
                }),
            ],
        });
    });
});
