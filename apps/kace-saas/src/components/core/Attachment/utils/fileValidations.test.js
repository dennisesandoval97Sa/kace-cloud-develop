import { describe, expect, it } from "vitest";
import { hasAllowedExtension, validateFileContent } from "./fileValidations";

const makeFile = (name) => ({ name });

describe("hasAllowedExtension", () => {
    it("allows a file whose extension case differs from the allowed_file_extensions config", () => {
        const file = makeFile("CAROLINA.PNG");

        expect(hasAllowedExtension(file, [".pdf", ".png", ".jpg", ".jpeg"])).toBe(true);
    });

    it("allows a lowercase file extension when the allowed_file_extensions config is uppercase", () => {
        const file = makeFile("carolina.png");

        expect(hasAllowedExtension(file, [".PNG"])).toBe(true);
    });

    it("rejects a file extension that is not in allowed_file_extensions regardless of case", () => {
        const file = makeFile("CAROLINA.EXE");

        expect(hasAllowedExtension(file, [".pdf", ".png", ".jpg", ".jpeg"])).toBe(false);
    });

    it("allows a file when allowedTypes is a single extension string with mismatched case", () => {
        const file = makeFile("report.PDF");

        expect(hasAllowedExtension(file, ".pdf")).toBe(true);
    });

    it("rejects a filename without an extension even when it matches an allowed entry verbatim", () => {
        const file = makeFile("png");

        expect(hasAllowedExtension(file, [".png"])).toBe(false);
    });
});

describe("validateFileContent - legacy Office", () => {
    const XLS = "application/vnd.ms-excel";
    const PPT = "application/vnd.ms-powerpoint";
    const bytes = (...b) => new Uint8Array(b);
    const fileOf = (content, type, name) => new File([content], name, { type });
    const OLE = bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
    const zipWithFirstEntry = (name) => {
        const header = new Uint8Array(30 + name.length);
        header.set([0x50, 0x4b, 0x03, 0x04]);
        header[26] = name.length;
        header.set(new TextEncoder().encode(name), 30);
        return header;
    };
    const ZIP = zipWithFirstEntry("[Content_Types].xml");

    it.each([
        ["xls", XLS],
        ["ppt", PPT],
    ])("accepts a binary OLE .%s", async (ext, type) => {
        expect(await validateFileContent(fileOf(OLE, type, `a.${ext}`))).toBe(true);
    });

    it.each([
        ["xls", XLS],
        ["ppt", PPT],
    ])("accepts an OOXML container saved with .%s extension", async (ext, type) => {
        expect(await validateFileContent(fileOf(ZIP, type, `a.${ext}`))).toBe(true);
    });

    it.each([
        ["xls", XLS],
        ["ppt", PPT],
    ])("rejects a non-OOXML zip archive saved with .%s extension", async (ext, type) => {
        expect(await validateFileContent(fileOf(zipWithFirstEntry("payload.exe"), type, `a.${ext}`))).toBe(false);
    });

    it("accepts a tab-delimited text .xls", async () => {
        const text = "Producto\tCantidad\nTornillo\t10\n";
        expect(await validateFileContent(fileOf(text, XLS, "inventario.xls"))).toBe(true);
    });

    it.each([
        ["a class grade", "name\tclass\nfoo\tClass A\n"],
        ["a let phrase", "greeting\tvalue\nhello\tlet us know\n"],
        ["a VAR column", "var\tvalue\nVAR \t10\n"],
        ["a function-like value", "name\tdesc\nbracket\tfunction (x)\n"],
    ])("accepts a delimited text .xls with %s", async (_, text) => {
        expect(await validateFileContent(fileOf(text, XLS, "x.xls"))).toBe(true);
    });

    it("accepts a UTF-8 delimited text .xls with accented characters", async () => {
        expect(await validateFileContent(fileOf("Año\tLínea\n2026\tCañón\n", XLS, "x.xls"))).toBe(true);
    });

    it("accepts a UTF-8 .xls whose multibyte character is cut by the 1000-byte read window", async () => {
        const text = `a\t${"x".repeat(997)}ñ\n`;
        expect(new TextEncoder().encode(text.slice(0, 999)).length).toBe(999);
        expect(await validateFileContent(fileOf(text, XLS, "x.xls"))).toBe(true);
    });

    it("rejects an .xls with markup content", async () => {
        const html = "<html><script>alert(1)</script></html>";
        expect(await validateFileContent(fileOf(html, XLS, "x.xls"))).toBe(false);
    });

    it("rejects an .xls that starts with markup without script patterns", async () => {
        expect(await validateFileContent(fileOf("  <html><body>hola</body></html>", XLS, "x.xls"))).toBe(false);
    });

    it("accepts markup after the first line of a delimited .xls (only leading markup and script are rejected)", async () => {
        const text = "col\tvalor\nx\t<img src=x onerror=alert(1)>\n";
        expect(await validateFileContent(fileOf(text, XLS, "x.xls"))).toBe(true);
    });

    it("rejects an .xls with arbitrary binary content", async () => {
        expect(await validateFileContent(fileOf(bytes(0x00, 0x01, 0x02, 0x03), XLS, "x.xls"))).toBe(false);
    });

    it("rejects an .xls with high bytes that are not valid UTF-8", async () => {
        expect(await validateFileContent(fileOf(new Uint8Array(500).fill(0x80), XLS, "x.xls"))).toBe(false);
    });

    it("accepts any content whose first 4 bytes are the OLE signature (heuristic by design)", async () => {
        const oleHeaderOnly = bytes(0xd0, 0xcf, 0x11, 0xe0, 0x00, 0x01, 0x02, 0x03);
        expect(await validateFileContent(fileOf(oleHeaderOnly, XLS, "x.xls"))).toBe(true);
    });

    it("rejects a text .ppt", async () => {
        expect(await validateFileContent(fileOf("hola\tmundo", PPT, "x.ppt"))).toBe(false);
    });

    it("rejects an empty .xls", async () => {
        expect(await validateFileContent(fileOf("", XLS, "x.xls"))).toBe(false);
    });

    it("rejects an .xls with script content after leading text", async () => {
        const text = "x\n<script>alert(1)</script>";
        expect(await validateFileContent(fileOf(text, XLS, "x.xls"))).toBe(false);
    });

    it("rejects an .xls with javascript: payload", async () => {
        expect(await validateFileContent(fileOf("a\tjavascript:alert(1)", XLS, "x.xls"))).toBe(false);
    });
});

describe("validateFileContent - csv", () => {
    const CSV = "text/csv";
    const fileOf = (content) => new File([content], "a.csv", { type: CSV });

    it("accepts a plain csv", async () => {
        expect(await validateFileContent(fileOf("nombre,cantidad\ntornillo,10\n"))).toBe(true);
    });

    it.each([
        ["empty", ""],
        ["control characters", "a,b\u0001"],
        ["script", "a,<script>alert(1)</script>"],
        ["code-like keywords, unlike a delimited .xls", "name,class\nfoo,Class A\n"],
    ])("rejects a csv with %s", async (_, content) => {
        expect(await validateFileContent(fileOf(content))).toBe(false);
    });
});
