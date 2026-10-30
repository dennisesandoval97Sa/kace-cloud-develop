import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../Attachment/hooks/useAttachmentsS3", () => ({
    default: () => ({ getUrlS3File: vi.fn(), downloadFile: vi.fn(), deleteFile: vi.fn(), loading: false }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

/*
 * Regression guard for a bug that is invisible to every other test in this suite:
 * Lexical's dev build (loaded only when NODE_ENV === "development" — i.e. the real
 * `pnpm dev` server, never `vitest`/the prod bundle) throws synchronously if a node's
 * constructor class doesn't match whatever class is registered for its type.
 * KaceTableNode/KaceTableCellNode are registered under the "table"/"tablecell" types
 * (see Editor.jsx), but @lexical/table's own INSERT_TABLE_COMMAND listener builds
 * plain base TableNode/TableCellNode instances directly — so dispatching that command
 * crashes the editor the instant a user clicks "insert table", in dev mode only.
 * handleInsertTableClick (Toolbar.jsx) works around this by building the table with
 * $createKaceTableNode/$createKaceTableCellNode by hand instead of dispatching
 * INSERT_TABLE_COMMAND. This test forces the dev Lexical build (the only build where
 * the crash is even possible) to actually exercise that path.
 */
describe("RichEditor table insert — Lexical dev build", () => {
    beforeEach(() => {
        vi.resetModules();
        process.env.NODE_ENV = "development";
    });

    it("does not crash and actually inserts a real, correctly-exported table under the dev Lexical build", async () => {
        const { render, waitFor, fireEvent, act } = await import("@testing-library/react");
        const { RichEditor } = await import("./Editor.jsx");
        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        let latestHtml = "";
        const setValue = vi.fn((_name, html) => {
            latestHtml = html;
        });

        const { getByTestId, container } = render(<RichEditor value="" setValue={setValue} name="cuerpo" />);
        await act(async () => {
            fireEvent.click(getByTestId("toolbar_insert_table_cuerpo"));
        });

        // The table must actually be there, not just "no crash was thrown".
        expect(container.querySelector("table")).not.toBeNull();
        await waitFor(() => expect(latestHtml).toContain("<table"));
        /*
         * Same KaceTableNode.exportDOM behavior verified for the prod build in
         * TableInsert.test.jsx — the editor-only theme class must not leak into it.
         */
        expect(latestHtml).not.toContain("kace-editor-table");

        expect(consoleErrorSpy).not.toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
    });
});
