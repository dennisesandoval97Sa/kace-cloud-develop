import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EventGroup from "./EventGroup";

describe("EventGroup", () => {
    it("renders time including seconds and milliseconds", () => {
        const timestamp = "2026-09-08T15:30:45.123Z";
        const mockGroup = {
            id: "group-1",
            occurred_at: timestamp,
            initiator: { name: "John Doe" },
            events: [
                {
                    id: "event-1",
                    event_name: "case.created",
                    case_id: "case-123",
                },
            ],
        };

        render(<EventGroup group={mockGroup} showCaseBadge={false} caseLabelById={{}} />);

        expect(screen.getByText(/45[.,]123/)).toBeInTheDocument();
    });
});
