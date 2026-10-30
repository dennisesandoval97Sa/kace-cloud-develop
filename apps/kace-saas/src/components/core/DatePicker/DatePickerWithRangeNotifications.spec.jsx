import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DatePickerWithRangeNotifications } from "./DatePickerWithRangeNotifications";

describe("DatePickerWithRangeNotifications", () => {
    it("renders stored UTC boundaries as the same calendar dates", async () => {
        render(
            <DatePickerWithRangeNotifications
                setValue={vi.fn()}
                nameFrom="start_date"
                nameTo="end_date"
                initialValues={["2026-07-01T00:00:00.000Z", "2026-08-01T23:59:59.999Z"]}
            />,
        );

        expect(await screen.findByRole("button", { name: /Jul 01, 2026\s*-\s*Aug 01, 2026/i })).toBeInTheDocument();
    });

    it("updates the displayed calendar range when a different notification is loaded", async () => {
        const { rerender } = render(
            <DatePickerWithRangeNotifications
                setValue={vi.fn()}
                nameFrom="start_date"
                nameTo="end_date"
                initialValues={["2026-07-01T00:00:00.000Z", "2026-08-01T23:59:59.999Z"]}
            />,
        );

        expect(await screen.findByRole("button", { name: /Jul 01, 2026\s*-\s*Aug 01, 2026/i })).toBeInTheDocument();

        rerender(
            <DatePickerWithRangeNotifications
                setValue={vi.fn()}
                nameFrom="start_date"
                nameTo="end_date"
                initialValues={["2026-09-10T00:00:00.000Z", "2026-10-12T23:59:59.999Z"]}
            />,
        );

        expect(await screen.findByRole("button", { name: /Sep 10, 2026\s*-\s*Oct 12, 2026/i })).toBeInTheDocument();
    });
});
