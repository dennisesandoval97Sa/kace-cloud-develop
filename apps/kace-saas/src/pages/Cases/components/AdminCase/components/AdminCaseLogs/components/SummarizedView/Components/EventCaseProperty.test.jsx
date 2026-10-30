import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { format, parseISO } from "date-fns";
import EventCaseProperty from "./EventCaseProperty";

describe("EventCaseProperty", () => {
    it("returns null when prop is falsy", () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        const { container } = render(<EventCaseProperty prop={null} propKey="prop-empty" />);
        expect(container).toBeEmptyDOMElement();
        spy.mockRestore();
    });

    it("renders ISO date with milliseconds in yyyy-MM-dd HH:mm:ss.SSS format", () => {
        const isoString = "2026-09-08T15:30:45.123Z";
        const expectedDate = format(parseISO(isoString), "yyyy-MM-dd HH:mm:ss.SSS");

        const prop = {
            name: "created_at",
            previousValue: null,
            newValue: isoString,
        };

        render(<EventCaseProperty prop={prop} propKey="prop-millis" />);

        expect(screen.getByText(expectedDate)).toBeInTheDocument();
        expect(expectedDate).toMatch(/\.123$/);
    });

    it("renders ISO date without milliseconds in yyyy-MM-dd HH:mm:ss format", () => {
        const isoString = "2026-09-08T15:30:45Z";
        const expectedDate = format(parseISO(isoString), "yyyy-MM-dd HH:mm:ss");

        const prop = {
            name: "updated_at",
            previousValue: null,
            newValue: isoString,
        };

        render(<EventCaseProperty prop={prop} propKey="prop-no-millis" />);

        expect(screen.getByText(expectedDate)).toBeInTheDocument();
        expect(expectedDate).not.toMatch(/\.\d+/);
    });

    it("renders short date string (yyyy-MM-dd) formatted without milliseconds", () => {
        const shortDate = "2026-09-08";
        const expectedDate = format(parseISO(shortDate), "yyyy-MM-dd HH:mm:ss");

        const prop = {
            name: "due_date",
            previousValue: null,
            newValue: shortDate,
        };

        render(<EventCaseProperty prop={prop} propKey="prop-short-date" />);

        expect(screen.getByText(expectedDate)).toBeInTheDocument();
        expect(expectedDate).not.toMatch(/\.\d+/);
    });

    it("formats nested ISO dates within a serialized JSON string", () => {
        const dateWithMillis = "2026-09-08T15:30:45.123Z";
        const dateWithoutMillis = "2026-09-08T15:30:45Z";
        const formattedMillis = format(parseISO(dateWithMillis), "yyyy-MM-dd HH:mm:ss.SSS");
        const formattedNoMillis = format(parseISO(dateWithoutMillis), "yyyy-MM-dd HH:mm:ss");

        const jsonPayload = JSON.stringify({
            startDate: dateWithMillis,
            endDate: dateWithoutMillis,
            status: "active",
        });

        const prop = {
            name: "metadata",
            previousValue: null,
            newValue: jsonPayload,
        };

        render(<EventCaseProperty prop={prop} propKey="prop-json" />);

        const expectedJson = JSON.stringify({
            startDate: formattedMillis,
            endDate: formattedNoMillis,
            status: "active",
        });

        expect(screen.getByText(expectedJson)).toBeInTheDocument();
    });

    it("formats object values containing ISO dates when rendered as a leaf", () => {
        const dateWithMillis = "2026-09-08T15:30:45.123Z";
        const formattedMillis = format(parseISO(dateWithMillis), "yyyy-MM-dd HH:mm:ss.SSS");

        const prop = {
            name: "config",
            previousValue: null,
            newValue: {
                timestamp: dateWithMillis,
                description: "Initial config",
            },
        };

        render(<EventCaseProperty prop={prop} propKey="prop-leaf-object" />);

        const expectedObjectJson = JSON.stringify({
            timestamp: formattedMillis,
            description: "Initial config",
        });

        expect(screen.getByText(expectedObjectJson)).toBeInTheDocument();
    });

    it("recursively renders changed child properties when both values are objects", () => {
        const oldDate = "2026-09-08T10:00:00Z";
        const newDate = "2026-09-08T15:30:45.123Z";
        const formattedOldDate = format(parseISO(oldDate), "yyyy-MM-dd HH:mm:ss");
        const formattedNewDate = format(parseISO(newDate), "yyyy-MM-dd HH:mm:ss.SSS");

        const prop = {
            name: "auditLog",
            previousValue: {
                timestamp: oldDate,
                unchangedField: "same",
            },
            newValue: {
                timestamp: newDate,
                unchangedField: "same",
            },
        };

        render(<EventCaseProperty prop={prop} propKey="prop-nested" />);

        expect(screen.getByRole("button", { name: /auditLog:/i })).toBeInTheDocument();
        expect(screen.getByText(/timestamp:/i)).toBeInTheDocument();
        expect(screen.getByText(formattedOldDate)).toBeInTheDocument();
        expect(screen.getByText(formattedNewDate)).toBeInTheDocument();
        expect(screen.queryByText(/unchangedField:/i)).not.toBeInTheDocument();
    });

    it("handles null, undefined, primitive, and non-ISO string values gracefully", () => {
        const prop = {
            name: "status",
            previousValue: null,
            newValue: "in_progress",
        };

        const { rerender } = render(<EventCaseProperty prop={prop} propKey="prop-primitives" />);

        expect(screen.getByText("Null")).toBeInTheDocument();
        expect(screen.getByText("in_progress")).toBeInTheDocument();

        rerender(
            <EventCaseProperty
                prop={{ name: "counter", previousValue: undefined, newValue: 42 }}
                propKey="prop-primitives"
            />,
        );

        expect(screen.getByText("-")).toBeInTheDocument();
        expect(screen.getByText("42")).toBeInTheDocument();
    });

    it("falls back to raw string when JSON is invalid", () => {
        const invalidJson = "{ invalid_json: true ";
        const prop = {
            name: "raw_payload",
            previousValue: null,
            newValue: invalidJson,
        };

        render(<EventCaseProperty prop={prop} propKey="prop-invalid-json" />);

        expect(screen.getByText(invalidJson.trim(), { exact: false })).toBeInTheDocument();
    });
});
