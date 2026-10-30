import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";
import i18n from "@/locale/i18n";
import { FolioConfigurationForm } from "./FolioConfigurationForm";

vi.mock("./FolioPreview", () => ({ default: () => <div data-testid="folio_preview" /> }));
vi.mock("sonner", () => ({ toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() } }));

const renderForm = (data, dataHandler = vi.fn()) => {
    render(
        <MemoryRouter initialEntries={["/folio-configurations/create"]}>
            <FolioConfigurationForm data={data} dataHandler={dataHandler} />
        </MemoryRouter>,
    );
    return { dataHandler };
};

const fillName = async (user, name) => {
    const input = screen.getByLabelText(i18n.t("folioConfigurations.form.nombre"));
    await user.clear(input);
    await user.type(input, name);
};

describe("FolioConfigurationForm", () => {
    beforeEach(() => {
        vi.mocked(toast.warning).mockClear();
    });

    it("monta en alta, cuando data llega como null", () => {
        expect(() => renderForm(null)).not.toThrow();

        expect(screen.getByTestId("folio_reset_policy")).toBeInTheDocument();
        expect(screen.getByTestId("folio_overflow_policy")).toBeInTheDocument();
        expect(screen.getByTestId("folio_segment_0")).toBeInTheDocument();
    });

    it("no muestra estado ni clasificaciones mientras no haya id", () => {
        renderForm(null);

        expect(screen.queryByTestId("folio_classifications")).not.toBeInTheDocument();
    });

    it("muestra los encabezados de sección", () => {
        renderForm(null);

        for (const key of [
            "folioConfigurations.form.information",
            "folioConfigurations.form.counter",
            "folioConfigurations.form.segments",
        ]) {
            expect(screen.getByRole("heading", { name: i18n.t(key) })).toBeInTheDocument();
        }
    });

    it("no envía y avisa cuando hay un segmento sin completar", async () => {
        const user = userEvent.setup();
        const { dataHandler } = renderForm(null);
        await fillName(user, "Radicado");

        // Añadir deja un literal vacío, que el API rechazaría con un 400.
        await user.click(screen.getByTestId("folio_segment_add"));
        await user.click(screen.getByTestId("btn_form_card_save"));

        await waitFor(() =>
            expect(toast.warning).toHaveBeenCalledWith(i18n.t("folioConfigurations.messages.incompleteSegment")),
        );
        expect(dataHandler).not.toHaveBeenCalled();
    });

    it("envía los segmentos junto con los helpers de Formik para pintar los errores del API", async () => {
        const user = userEvent.setup();
        const { dataHandler } = renderForm(null);
        await fillName(user, "Radicado");

        await user.click(screen.getByTestId("btn_form_card_save"));

        await waitFor(() => expect(dataHandler).toHaveBeenCalledOnce());
        const [values, setErrors, setStatus] = dataHandler.mock.calls[0];
        expect(values).toMatchObject({
            nombre: "Radicado",
            segments: [{ type: "sequence", length: 6, pad_char: "0" }],
        });
        expect(setErrors).toEqual(expect.any(Function));
        expect(setStatus).toEqual(expect.any(Function));
        expect(toast.warning).not.toHaveBeenCalled();
    });
});
