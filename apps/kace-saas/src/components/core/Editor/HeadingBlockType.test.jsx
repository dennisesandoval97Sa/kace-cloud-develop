import { render, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect } from "vitest";
import { RichEditor } from "./Editor";

Element.prototype.scrollIntoView = () => {};
Element.prototype.hasPointerCapture = () => false;

describe("RichEditor heading block type", () => {
    it("loads a real <h1> body as an actual heading node, not escaped text (regression: HeadingNode was not registered)", async () => {
        const { container } = render(<RichEditor value="<h1>Hola mundo</h1>" setValue={vi.fn()} name="cuerpo" />);

        await waitFor(() => {
            expect(container.querySelector("h1")).not.toBeNull();
        });
        expect(container.querySelector("h1").textContent).toBe("Hola mundo");
        // The literal "<h1>" text must never appear as escaped/plain content in the editor.
        expect(container.textContent).not.toContain("<h1>");
    });

    it("converts the current block to a real Heading 1 via the toolbar select, and exports real <h1> HTML", async () => {
        let latestHtml = "";
        const setValue = vi.fn((_name, html) => {
            latestHtml = html;
        });
        const user = userEvent.setup();

        const { getByTestId, getAllByTestId } = render(
            <RichEditor value="Hola mundo" setValue={setValue} name="cuerpo" />,
        );

        await act(async () => {
            fireEvent.input(getByTestId("rich_editor_input_cuerpo"), {
                target: { textContent: "Hola mundo" },
            });
        });

        const trigger = getByTestId("toolbar_block_type");
        await user.click(trigger);
        await user.click(getAllByTestId("toolbar_block_type_h1")[0]);

        await waitFor(() => {
            expect(latestHtml).toContain("<h1");
        });
        expect(latestHtml).not.toContain("&lt;h1&gt;");
    });
});
