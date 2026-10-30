import { render, fireEvent, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { RichEditor } from "./Editor";

Element.prototype.scrollIntoView = () => {};
Element.prototype.hasPointerCapture = () => false;

const SANITIZE_DELAY_MS = 200;

// Loading the initial HTML is a dirty update, so the sanitize debounce is pending right after mount.
const renderWithPendingExport = async () => {
    const setValue = vi.fn();
    const onBlur = vi.fn();
    const utils = render(<RichEditor value="<p>Hola</p>" setValue={setValue} onBlur={onBlur} name="cuerpo" />);
    await act(async () => {});
    const input = utils.getByTestId("rich_editor_input_cuerpo");
    expect(input.textContent).toContain("Hola");
    return { setValue, onBlur, input };
};

describe("RichEditor blur", () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("entrega en el acto el HTML que seguía esperando el temporizador y luego avisa con onBlur", async () => {
        const { setValue, onBlur, input } = await renderWithPendingExport();
        expect(setValue).not.toHaveBeenCalled();

        fireEvent.blur(input);

        expect(setValue).toHaveBeenCalledOnce();
        expect(setValue.mock.calls[0][0]).toBe("cuerpo");
        expect(setValue.mock.calls[0][1]).toContain("Hola");
        expect(onBlur).toHaveBeenCalledOnce();
        expect(setValue.mock.invocationCallOrder[0]).toBeLessThan(onBlur.mock.invocationCallOrder[0]);

        vi.advanceTimersByTime(SANITIZE_DELAY_MS);
        expect(setValue).toHaveBeenCalledOnce();
    });

    it("sin cambios pendientes no vuelve a exportar el HTML, pero sí avisa con onBlur", async () => {
        const { setValue, onBlur, input } = await renderWithPendingExport();
        vi.advanceTimersByTime(SANITIZE_DELAY_MS);
        expect(setValue).toHaveBeenCalledOnce();

        fireEvent.blur(input);

        expect(setValue).toHaveBeenCalledOnce();
        expect(onBlur).toHaveBeenCalledOnce();
    });
});

describe("RichEditor blur con un onBlur que cambia en cada render", () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("un re-render no descarta la exportación pendiente y se usa el onBlur más reciente", async () => {
        const setValue = vi.fn();
        const firstOnBlur = vi.fn();
        const latestOnBlur = vi.fn();
        const { rerender, getByTestId } = render(
            <RichEditor value="<p>Hola</p>" setValue={setValue} onBlur={firstOnBlur} name="cuerpo" />,
        );
        await act(async () => {});

        rerender(<RichEditor value="<p>Hola</p>" setValue={setValue} onBlur={latestOnBlur} name="cuerpo" />);
        vi.advanceTimersByTime(SANITIZE_DELAY_MS);
        expect(setValue).toHaveBeenCalledOnce();

        fireEvent.blur(getByTestId("rich_editor_input_cuerpo"));
        expect(firstOnBlur).not.toHaveBeenCalled();
        expect(latestOnBlur).toHaveBeenCalledOnce();
    });
});
