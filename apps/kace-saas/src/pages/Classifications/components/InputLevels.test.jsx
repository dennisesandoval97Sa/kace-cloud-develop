/* eslint-disable react/prop-types */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InputLevels } from "./InputLevels";
import { toast } from "sonner";

vi.mock("@kace/ui-shared", () => ({
    Button: ({ children, ...props }) => <button {...props}>{children}</button>,
    Input: (props) => <input {...props} />,
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("sonner", () => ({
    toast: {
        warning: vi.fn(),
    },
}));

describe("InputLevels", () => {
    it("rejects a duplicate level name after trimming whitespace and ignoring letter case", () => {
        const setLevels = vi.fn();
        const setValues = vi.fn();
        render(<InputLevels levelList={["Test1"]} setLevels={setLevels} setValues={setValues} />);

        fireEvent.change(screen.getByTestId("input_levels"), {
            target: { value: " test1 " },
        });
        fireEvent.click(screen.getByTestId("btn_input_add_level"));

        expect(setLevels).not.toHaveBeenCalled();
        expect(setValues).not.toHaveBeenCalled();
        expect(toast.warning).toHaveBeenCalledWith("classification.form.alerts.sameName");
    });

    it("adds a new level with outer whitespace removed and capitalization preserved", () => {
        const setLevels = vi.fn();
        const setValues = vi.fn();
        render(<InputLevels levelList={["Existing"]} setLevels={setLevels} setValues={setValues} />);

        fireEvent.change(screen.getByTestId("input_levels"), {
            target: { value: " New Level " },
        });
        fireEvent.click(screen.getByTestId("btn_input_add_level"));

        expect(setLevels).toHaveBeenCalledOnce();
        expect(setLevels.mock.calls[0][0](["Existing"])).toEqual(["Existing", "New Level"]);
        expect(setValues).toHaveBeenCalledWith("nivel2", "New Level");
    });
});
