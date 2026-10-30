import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EventDetail from "./EventDetail";

vi.mock("@/components/ui-shared", () => ({
    TooltipProvider: ({ children }) => children,
    Tooltip: ({ children }) => children,
    TooltipTrigger: ({ children }) => children,
    TooltipContent: ({ children, className }) => (
        <div data-testid="event-detail-tooltip" className={className}>
            {children}
        </div>
    ),
}));

describe("EventDetail tooltip", () => {
    it("gives a long motivo_baja a max height, vertical scroll and a responsive width wider than max-w-xs", () => {
        render(
            <EventDetail
                event={{
                    id: "evt-1",
                    fields: [{ name: "motivo_baja", value: "x".repeat(5000), tooltip: true }],
                }}
            />,
        );

        const tooltip = screen.getByTestId("event-detail-tooltip");
        expect(tooltip.className).toMatch(/max-h-/);
        expect(tooltip.className).toMatch(/overflow-y-auto/);
        expect(tooltip.className).not.toMatch(/\bmax-w-xs\b/);
        expect(tooltip.className).toMatch(/max-w-/);
    });
});
