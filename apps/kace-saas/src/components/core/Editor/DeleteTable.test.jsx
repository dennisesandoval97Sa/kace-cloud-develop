import { render, waitFor, fireEvent, act } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import { RichEditor } from "./Editor";

describe("RichEditor delete table flow", () => {
    it("shows a delete-table button only while the cursor is inside a table, and removes the table on click", async () => {
        let latestHtml = "";
        const setValue = vi.fn((_name, html) => {
            latestHtml = html;
        });

        const { getByTestId, queryByTestId } = render(<RichEditor value="" setValue={setValue} name="cuerpo" />);

        expect(queryByTestId("toolbar_delete_table_cuerpo")).toBeNull();

        await act(async () => {
            fireEvent.click(getByTestId("toolbar_insert_table_cuerpo"));
        });

        await waitFor(() => {
            expect(latestHtml).toContain("<table");
        });

        await waitFor(() => {
            expect(getByTestId("toolbar_delete_table_cuerpo")).not.toBeNull();
        });

        await act(async () => {
            fireEvent.click(getByTestId("toolbar_delete_table_cuerpo"));
        });

        await waitFor(() => {
            expect(latestHtml).not.toContain("<table");
        });
        expect(queryByTestId("toolbar_delete_table_cuerpo")).toBeNull();
    });
});
