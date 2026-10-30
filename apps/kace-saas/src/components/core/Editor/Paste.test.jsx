import { render, waitFor, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeAll } from "vitest";
import { RichEditor } from "./Editor";

/*
 * jsdom doesn't implement these, but Lexical's selection-sync/drag-drop/paste
 * wiring reference them as soon as a real caret/selection exists in the editor.
 */
const boundingRect = () => ({
    width: 0,
    height: 0,
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    x: 0,
    y: 0,
    toJSON: () => {},
});

beforeAll(() => {
    Element.prototype.getBoundingClientRect ??= boundingRect;
    Range.prototype.getBoundingClientRect ??= boundingRect;
    Range.prototype.getClientRects ??= () => [];
    globalThis.DragEvent ??= class DragEvent extends Event {};
    globalThis.ClipboardEvent ??= class ClipboardEvent extends Event {
        constructor(type, options = {}) {
            super(type, options);
            this.clipboardData = options.clipboardData ?? null;
        }
    };
});

function pasteText(target, text) {
    const clipboardData = {
        getData: (type) => (type === "text/plain" ? text : ""),
    };
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: clipboardData });
    target.dispatchEvent(event);
}

/*
 * Simulates copying a chat message (Slack/Teams/WhatsApp Web) whose text
 * literally reads "<table>...". Such clients DO write a text/html entry, but
 * it just wraps that same literal string in the chat bubble's own markup
 * (e.g. a <span>) — it never contains a real <table> element, because the
 * chat never rendered it as one.
 */
function pasteChatMessageContainingHtmlSource(target, htmlSourceText) {
    const clipboardData = {
        getData: (type) => {
            if (type === "text/plain") return htmlSourceText;
            if (type === "text/html") {
                const escaped = htmlSourceText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                return `<span style="font-family:sans-serif">${escaped}</span>`;
            }
            return "";
        },
    };
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: clipboardData });
    target.dispatchEvent(event);
}

describe("RichEditor paste flow (text/plain clipboard containing raw HTML)", () => {
    it("parses a bare inline tag like <b>Hola</b> as real bold formatting, not literal/escaped text", async () => {
        let latestHtml = "";
        const setValue = vi.fn((_name, html) => {
            latestHtml = html;
        });

        const { getByTestId } = render(<RichEditor value="" setValue={setValue} name="cuerpo" />);
        const editable = getByTestId("rich_editor_input_cuerpo");
        editable.focus();

        await act(async () => {
            pasteText(editable, "<b>Hola</b>");
        });

        await waitFor(() => {
            expect(latestHtml).not.toBe("");
        });

        expect(latestHtml).not.toContain("&lt;b&gt;");
        expect(latestHtml).toMatch(/<(b|strong)[^>]*>Hola<\/(b|strong)>/);
    });

    it("parses a pasted table (raw HTML as plain text) into a real <table>, not escaped text", async () => {
        let latestHtml = "";
        const setValue = vi.fn((_name, html) => {
            latestHtml = html;
        });

        const { getByTestId } = render(<RichEditor value="" setValue={setValue} name="cuerpo" />);
        const editable = getByTestId("rich_editor_input_cuerpo");
        editable.focus();

        const tableSource = "<table><tbody><tr><td>col1</td><td>col2</td></tr></tbody></table>";
        await act(async () => {
            pasteText(editable, tableSource);
        });

        await waitFor(() => {
            expect(latestHtml).not.toBe("");
        });

        expect(latestHtml).not.toContain("&lt;table&gt;");
        expect(latestHtml).toContain("<table");
        expect(latestHtml).toContain("col1");
    });

    it("still inserts genuinely plain text as literal text (no false-positive HTML parsing)", async () => {
        let latestHtml = "";
        const setValue = vi.fn((_name, html) => {
            latestHtml = html;
        });

        const { getByTestId } = render(<RichEditor value="" setValue={setValue} name="cuerpo" />);
        const editable = getByTestId("rich_editor_input_cuerpo");
        editable.focus();

        await act(async () => {
            pasteText(editable, "5 es menor que 10");
        });

        await waitFor(() => {
            expect(latestHtml).not.toBe("");
        });

        expect(latestHtml).toContain("5 es menor que 10");
    });

    it("parses HTML source pasted from a chat message even though the clipboard also carries a text/html entry", async () => {
        let latestHtml = "";
        const setValue = vi.fn((_name, html) => {
            latestHtml = html;
        });

        const { getByTestId } = render(<RichEditor value="" setValue={setValue} name="cuerpo" />);
        const editable = getByTestId("rich_editor_input_cuerpo");
        editable.focus();

        const tableSource =
            '<table style="border-collapse:collapse;width:100%" border="0"><tbody><tr>' +
            '<td><p class="mb-1"><span>Hola Consultor</span></p></td>' +
            "</tr></tbody></table>";

        await act(async () => {
            pasteChatMessageContainingHtmlSource(editable, tableSource);
        });

        await waitFor(() => {
            expect(latestHtml).not.toBe("");
        });

        expect(latestHtml).not.toContain("&lt;table");
        expect(latestHtml).toContain("<table");
        expect(latestHtml).toContain("Hola Consultor");
    });
});
