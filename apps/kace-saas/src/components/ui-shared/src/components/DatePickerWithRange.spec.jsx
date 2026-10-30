import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DatePickerWithRange } from "./DatePickerWithRange";
import { addDays, format } from "date-fns";

vi.mock("lucide-react", () => ({
    Calendar: (props) => <svg data-testid="calendar-icon" {...props} />,
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) => key.split(".").pop(),
        i18n: { language: "en" },
    }),
}));

vi.mock("./ui/button", () => {
    const Button = React.forwardRef(({ children, ...props }, ref) => (
        <button ref={ref} {...props}>
            {children}
        </button>
    ));
    Button.displayName = "Button";
    return { Button };
});

vi.mock("./ui/calendar", () => {
    const Calendar = React.forwardRef(({ onSelect }, ref) => (
        <div data-testid="calendar" ref={ref}>
            <button
                data-testid="calendar-select-range-btn"
                onClick={() =>
                    onSelect({ from: new Date("2025-11-01T12:00:00.000Z"), to: new Date("2025-11-10T12:00:00.000Z") })
                }
            >
                Select predefined range
            </button>
            <button
                data-testid="calendar-select-single-btn"
                onClick={() => onSelect({ from: new Date("2025-12-25T12:00:00.000Z"), to: undefined })}
            >
                Select single date
            </button>
            <button data-testid="calendar-clear-btn" onClick={() => onSelect(undefined)}>
                Clear
            </button>
        </div>
    ));
    Calendar.displayName = "Calendar";
    return { Calendar };
});

vi.mock("./ui/label", () => ({
    Label: ({ children, ...props }) => <label {...props}>{children}</label>,
}));

vi.mock("./ui/popover", () => ({
    Popover: ({ children }) => <div data-testid="popover">{children}</div>,
    PopoverTrigger: ({ children }) => <div data-testid="popover-trigger">{children}</div>,
    PopoverContent: ({ children }) => <div data-testid="popover-content">{children}</div>,
}));

vi.mock("../lib/utils", () => ({
    cn: (...classes) => classes.filter(Boolean).join(" "),
}));

describe("DatePickerWithRange", () => {
    let onChangeMock;
    let setValueMock;

    beforeEach(() => {
        onChangeMock = vi.fn();
        setValueMock = vi.fn();
        vi.clearAllMocks();
    });

    it("renders with default placeholder when noInitialDate is true", () => {
        render(<DatePickerWithRange noInitialDate />);
        expect(screen.getByText("selectDate")).toBeInTheDocument();
        expect(screen.getByTestId("calendar-icon")).toBeInTheDocument();
    });

    it("initializes with provided initialValues and does not call setValue (component doesn't set form values on init)", async () => {
        const fromDate = new Date("2025-10-16T00:00:00.000Z");
        const toDate = addDays(fromDate, 5);

        const { rerender } = render(
            <DatePickerWithRange
                initialValues={[fromDate.toISOString(), toDate.toISOString()]}
                onChange={onChangeMock}
                setValue={setValueMock}
                nameFrom="startDate"
                nameTo="endDate"
            />,
        );

        rerender(
            <DatePickerWithRange
                initialValues={[fromDate.toISOString(), toDate.toISOString()]}
                value={`${fromDate.toISOString()}, ${toDate.toISOString()}`}
                onChange={onChangeMock}
                setValue={setValueMock}
                nameFrom="startDate"
                nameTo="endDate"
            />,
        );

        expect(await screen.findByText(/Oct 16, 2025 - Oct 21, 2025/)).toBeInTheDocument();
        expect(setValueMock).not.toHaveBeenCalled();
    });

    it("does not set a date when noInitialDate is true and no initialValues are passed", () => {
        render(<DatePickerWithRange noInitialDate={true} onChange={onChangeMock} />);
        expect(screen.getByText("selectDate")).toBeInTheDocument();
        expect(onChangeMock).not.toHaveBeenCalled();
    });

    it("displays only a 'from' date after a single date selection", async () => {
        render(<DatePickerWithRange noInitialDate onChange={onChangeMock} setValue={setValueMock} />);

        const triggerButton = screen.getByRole("button", { name: /selectDate/i });
        fireEvent.click(triggerButton);

        const calendarSelectButton = screen.getByTestId("calendar-select-single-btn");

        await act(async () => {
            fireEvent.click(calendarSelectButton);
        });

        const updatedButton = screen.getByRole("button", { name: /Dec 25, 2025/i });
        expect(updatedButton).toBeInTheDocument();
        expect(updatedButton.textContent).not.toContain("-");
    });

    it("handles user selecting a new date range and calls callbacks", async () => {
        render(
            <DatePickerWithRange
                onChange={onChangeMock}
                setValue={setValueMock}
                nameFrom="start"
                nameTo="end"
                noInitialDate
            />,
        );

        const triggerButton = screen.getByText("selectDate");
        fireEvent.click(triggerButton);

        const calendarSelectButton = screen.getByTestId("calendar-select-range-btn");

        await act(async () => {
            fireEvent.click(calendarSelectButton);
        });

        const newFrom = new Date("2025-11-01T12:00:00.000Z");
        const newTo = new Date("2025-11-10T12:00:00.000Z");

        const expectedString = `${format(newFrom, "yyyy-MM-dd'T'00:00:00.000'Z'")}, ${format(newTo, "yyyy-MM-dd'T'23:59:59.999'Z'")}`;

        expect(onChangeMock).toHaveBeenCalledWith(expectedString);

        expect(setValueMock).toHaveBeenCalledTimes(2);
        expect(setValueMock).toHaveBeenCalledWith("start", expect.any(Date));
        expect(setValueMock).toHaveBeenCalledWith("end", expect.any(Date));

        const firstCallArg = setValueMock.mock.calls[0][1];
        const secondCallArg = setValueMock.mock.calls[1][1];
        expect(firstCallArg.toISOString()).toEqual(newFrom.toISOString());
        expect(secondCallArg.toISOString()).toEqual(newTo.toISOString());
    });

    it("handles clearing the selected date", async () => {
        const fromDateStr = "2025-10-16T00:00:00.000Z";
        const toDateStr = "2025-10-18T23:59:59.999Z";
        const valueString = `${fromDateStr}, ${toDateStr}`;

        render(
            <DatePickerWithRange
                value={valueString}
                onChange={onChangeMock}
                setValue={setValueMock}
                nameFrom="startDate"
                nameTo="endDate"
            />,
        );

        const triggerButton = await screen.findByText(/Oct 16, 2025/);
        fireEvent.click(triggerButton);

        const clearButton = screen.getByTestId("calendar-clear-btn");

        await act(async () => {
            fireEvent.click(clearButton);
        });

        expect(onChangeMock).toHaveBeenCalledWith("");
        expect(setValueMock).toHaveBeenCalledWith("startDate", "");
        expect(setValueMock).toHaveBeenCalledWith("endDate", "");
        expect(screen.getByText("selectDate")).toBeInTheDocument();
    });

    it("displays a title when isTitle is true", () => {
        render(<DatePickerWithRange isTitle={true} noInitialDate />);
        expect(screen.getByText("dateRange")).toBeInTheDocument();
    });

    it("displays an error message when error and touched props are true", () => {
        render(<DatePickerWithRange isTitle={true} errorFrom={true} touchedFrom={true} noInitialDate />);
        expect(screen.getByText("required")).toBeInTheDocument();
    });

    it("does not display an error message if not touched", () => {
        render(<DatePickerWithRange isTitle={true} errorFrom={true} touchedFrom={false} noInitialDate />);
        expect(screen.queryByText("required")).not.toBeInTheDocument();
    });

    it("does not display an error message if not in error state", () => {
        render(<DatePickerWithRange isTitle={true} errorFrom={false} touchedFrom={true} noInitialDate />);
        expect(screen.queryByText("required")).not.toBeInTheDocument();
    });

    it("calls handleUpdateDate when a new date is selected", async () => {
        const handleUpdateDateMock = vi.fn();
        render(<DatePickerWithRange onChange={onChangeMock} handleUpdateDate={handleUpdateDateMock} noInitialDate />);

        const triggerButton = screen.getByText("selectDate");
        fireEvent.click(triggerButton);

        await act(async () => {
            fireEvent.click(screen.getByTestId("calendar-select-range-btn"));
        });

        expect(handleUpdateDateMock).toHaveBeenCalledTimes(1);
    });

    it("updates based on the controlled 'value' prop", async () => {
        const fromDateStr = "2026-01-15T00:00:00.000Z";
        const toDateStr = "2026-01-20T23:59:59.999Z";
        const valueString = `${fromDateStr}, ${toDateStr}`;

        const { rerender } = render(<DatePickerWithRange value={undefined} />);
        expect(screen.getByText("selectDate")).toBeInTheDocument();

        rerender(<DatePickerWithRange value={valueString} />);

        expect(await screen.findByText(/Jan 15, 2026 - Jan 20, 2026/)).toBeInTheDocument();
    });

    it("keeps the calendar dates from an offset-bearing controlled value", async () => {
        render(
            <DatePickerWithRange value="2026-07-23T00:00:00.000-05:00, 2026-07-23T23:59:59.999-05:00" noInitialDate />,
        );

        expect(await screen.findByText(/Jul 23, 2026 - Jul 23, 2026/)).toBeInTheDocument();
    });
});
