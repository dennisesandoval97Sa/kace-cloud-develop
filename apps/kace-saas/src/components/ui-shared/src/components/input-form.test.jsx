import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InputForm } from "./input-form";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

const renderInput = (props) => render(<InputForm name="inactivity_time" label="Inactivity" {...props} />);

describe("InputForm error visibility", () => {
    it("hides the error while the field is untouched and touchedValue is false", () => {
        renderInput({ meta: { touched: false, error: "boom" } });
        expect(screen.queryByText("boom")).not.toBeInTheDocument();
    });

    it("shows the error once the field is touched", () => {
        renderInput({ meta: { touched: true, error: "boom" } });
        expect(screen.getByText("boom")).toBeInTheDocument();
    });

    it("shows the error when touchedValue forces it (e.g. after submit) even if the field was never focused", () => {
        renderInput({ meta: { touched: false, error: "boom" }, touchedValue: true });
        expect(screen.getByText("boom")).toBeInTheDocument();
    });

    it("does not render an error node when there is no error", () => {
        renderInput({ meta: { touched: true, error: undefined }, touchedValue: true });
        expect(screen.queryByText("boom")).not.toBeInTheDocument();
    });
});
