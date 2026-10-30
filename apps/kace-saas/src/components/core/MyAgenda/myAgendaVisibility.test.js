import { describe, it, expect } from "vitest";
import { isMyAgendaVisible } from "./myAgendaVisibility";

describe("isMyAgendaVisible", () => {
    it("hides the agenda when the tenant explicitly turns it off", () => {
        expect(isMyAgendaVisible({ my_agenda: false }, true)).toBe(false);
    });

    it("shows the agenda when the tenant explicitly turns it on", () => {
        expect(isMyAgendaVisible({ my_agenda: true }, true)).toBe(true);
    });

    it("shows the agenda for legacy tenants whose saved header has no my_agenda key", () => {
        expect(isMyAgendaVisible({ helps: true, search_clients: false }, true)).toBe(true);
    });

    it("hides the agenda while the header config is not loaded yet", () => {
        expect(isMyAgendaVisible(undefined, false)).toBe(false);
        expect(isMyAgendaVisible(null, false)).toBe(false);
        expect(isMyAgendaVisible({ my_agenda: true }, false)).toBe(false);
    });
});
