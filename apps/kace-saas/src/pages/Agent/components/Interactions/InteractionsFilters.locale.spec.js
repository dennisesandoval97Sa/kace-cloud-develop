import { describe, expect, it } from "vitest";
import en from "@/locale/en.json";
import es from "@/locale/es.json";

describe("Agent interaction filter translations", () => {
    it("defines the current-agent review filter label in English and Spanish", () => {
        expect(en.agent.interactions.filters.myReviews).toBe("My interactions under review");
        expect(es.agent.interactions.filters.myReviews).toBe("Mis interacciones en revisión");
    });
});
