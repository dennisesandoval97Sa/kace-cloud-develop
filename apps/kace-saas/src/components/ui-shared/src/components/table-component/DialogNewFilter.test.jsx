import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DialogNewFilter } from "./DialogNewFilter";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

describe("DialogNewFilter", () => {
    it("resets the name when reopened so a previous save does not overwrite", async () => {
        const user = userEvent.setup();
        const save = vi.fn();
        const setOpen = vi.fn();

        const { rerender } = render(<DialogNewFilter open={true} save={save} setOpen={setOpen} />);

        const input = screen.getByTestId("input_name");
        await user.type(input, "Filtro Uno");
        expect(input).toHaveValue("Filtro Uno");

        rerender(<DialogNewFilter open={false} save={save} setOpen={setOpen} />);
        rerender(<DialogNewFilter open={true} save={save} setOpen={setOpen} />);

        expect(screen.getByTestId("input_name")).toHaveValue("");
        expect(screen.getByRole("button", { name: "app.button.save" })).toBeDisabled();
    });

    it("blocks save when the name already exists", async () => {
        const user = userEvent.setup();
        const save = vi.fn();

        render(<DialogNewFilter open={true} save={save} setOpen={vi.fn()} existingNames={["Filtro Uno"]} />);

        await user.type(screen.getByTestId("input_name"), "Filtro Uno");
        expect(screen.getByText("app.text.filterNameExists")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "app.button.save" })).toBeDisabled();
        expect(save).not.toHaveBeenCalled();
    });
});
