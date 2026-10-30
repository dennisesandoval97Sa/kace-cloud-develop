import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { apiService } from "@kace/utils";
import FolioPreview from "./FolioPreview";

vi.mock("@kace/utils", async (importOriginal) => ({
    ...(await importOriginal()),
    apiService: { post: vi.fn() },
}));

const sequence = { type: "sequence", length: 6, pad_char: "0" };
const literal = (value) => ({ type: "literal", value });

const props = (segments) => ({ segments, resetPolicy: "never", startValue: 1, overflowPolicy: "fail" });

const deferred = () => {
    const handlers = {};
    const promise = new Promise((resolve, reject) => {
        handlers.resolve = resolve;
        handlers.reject = reject;
    });
    return { promise, ...handlers };
};

const folioResponse = (folio) => ({ data: { data: { folio } } });

const waitDebounce = () =>
    act(async () => {
        await vi.advanceTimersByTimeAsync(400);
    });

describe("FolioPreview", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.mocked(apiService.post).mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("no pide la vista previa mientras el borrador no sea previsualizable", async () => {
        render(<FolioPreview {...props([sequence, literal("")])} />);

        await waitDebounce();

        expect(apiService.post).not.toHaveBeenCalled();
    });

    it("espera al debounce y pide una sola vista previa con el último borrador", async () => {
        vi.mocked(apiService.post).mockResolvedValue(folioResponse("RAD-000001"));
        const { rerender } = render(<FolioPreview {...props([literal("A"), sequence])} />);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(200);
        });
        rerender(<FolioPreview {...props([literal("B"), sequence])} />);
        expect(apiService.post).not.toHaveBeenCalled();

        await waitDebounce();

        expect(apiService.post).toHaveBeenCalledTimes(1);
        expect(apiService.post).toHaveBeenCalledWith(
            "/folio-configurations/preview",
            expect.objectContaining({ segments: [literal("B"), sequence], reset_policy: "never" }),
        );
    });

    it("muestra el folio que devuelve el API", async () => {
        vi.mocked(apiService.post).mockResolvedValue(folioResponse("RAD-000001"));
        render(<FolioPreview {...props([literal("RAD-"), sequence])} />);

        await waitDebounce();

        expect(screen.getByTestId("folio_preview_value")).toHaveTextContent("RAD-000001");
    });

    it("muestra el mensaje del dominio cuando el API rechaza el borrador", async () => {
        vi.mocked(apiService.post).mockRejectedValue({
            response: {
                data: { message: 'reset_policy: "prefix" requiere al menos un segmento antes del consecutivo' },
            },
        });
        render(<FolioPreview {...props([sequence])} resetPolicy="prefix" />);

        await waitDebounce();

        expect(screen.getByRole("alert")).toHaveTextContent('"prefix" requiere al menos un segmento');
        expect(screen.queryByTestId("folio_preview_value")).not.toBeInTheDocument();
    });

    it("en producción toma el mensaje del dominio de data.detail, no el genérico", async () => {
        vi.mocked(apiService.post).mockRejectedValue({
            response: {
                data: { message: "Bad request", data: { code: "0x050001", detail: "pad_char no puede ser un dígito" } },
            },
        });
        render(<FolioPreview {...props([sequence])} />);

        await waitDebounce();

        expect(screen.getByRole("alert")).toHaveTextContent("pad_char no puede ser un dígito");
    });

    it("descarta una respuesta vieja que llega después de la del borrador actual", async () => {
        const first = deferred();
        const second = deferred();
        vi.mocked(apiService.post).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

        const { rerender } = render(<FolioPreview {...props([literal("A-"), sequence])} />);
        await waitDebounce();
        rerender(<FolioPreview {...props([literal("B-"), sequence])} />);
        await waitDebounce();
        expect(apiService.post).toHaveBeenCalledTimes(2);

        await act(async () => {
            second.resolve(folioResponse("B-000001"));
        });
        await act(async () => {
            first.resolve(folioResponse("A-000001"));
        });

        expect(screen.getByTestId("folio_preview_value")).toHaveTextContent("B-000001");
    });

    it("al editar una configuración guardada envía su id para que la vista previa use su contador", async () => {
        vi.mocked(apiService.post).mockResolvedValue(folioResponse("RAD-000004"));
        render(<FolioPreview configurationId="cfg-1" {...props([literal("RAD-"), sequence])} />);

        await waitDebounce();

        expect(apiService.post).toHaveBeenCalledWith(
            expect.stringMatching(/\/preview$/),
            expect.objectContaining({ id: "cfg-1" }),
        );
    });

    it("un borrador nuevo no envía id", async () => {
        vi.mocked(apiService.post).mockResolvedValue(folioResponse("RAD-000001"));
        render(<FolioPreview {...props([literal("RAD-"), sequence])} />);

        await waitDebounce();

        expect(apiService.post.mock.calls[0][1]).not.toHaveProperty("id");
    });
});
