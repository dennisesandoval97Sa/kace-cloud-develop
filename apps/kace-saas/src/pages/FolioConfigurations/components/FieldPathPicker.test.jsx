import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "@/locale/i18n";
import FieldPathPicker from "./FieldPathPicker";

// cmdk y Radix Select los llaman al montar sus listas; jsdom no los implementa.
Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    releasePointerCapture: { configurable: true, value: () => {} },
    scrollIntoView: { configurable: true, value: () => {} },
    setPointerCapture: { configurable: true, value: () => {} },
});

// El idioma depende del entorno, así que las etiquetas se resuelven por i18n, no a mano.
const CASES_LABEL = i18n.t("actions.form.cases");
const AUX_LABEL = i18n.t("actions.form.auxCase");

const mockUseModelsData = vi.fn();

vi.mock("@/pages/Actions/hooks/useModelsData", () => ({
    default: (args) => mockUseModelsData(args),
}));

const AUX_PATH = "aux_cases.asistencia_movilidad.monitoreo_proveedor_hidden.canal";

const opcionesBuilder = [
    {
        dataOrigin: "clasificaciones",
        options: [{ value: "clasificaciones.nivel1", label: "Nivel 1", id: 1 }],
    },
    {
        dataOrigin: "cases",
        options: [
            { value: "cases.reference", label: "Consecutivo", id: 2 },
            { value: "cases.estadoActual", label: "Estado actual", id: 8 },
        ],
    },
    { dataOrigin: "usuarios", options: [{ value: "usuarios.nombres", label: "Nombres", id: 3 }] },
    { dataOrigin: "aux_cases", options: [{ value: AUX_PATH, label: AUX_PATH, id: "s_canal" }] },
];

const fieldTrigger = () => within(screen.getByTestId("folio_segment_path")).getByRole("button");
const openFields = async (user) => user.click(fieldTrigger());
const openOrigins = async (user) => user.click(screen.getByTestId("folio_segment_origin"));

beforeEach(() => {
    mockUseModelsData.mockReturnValue({ opcionesBuilder, loading: false });
});

describe("FieldPathPicker", () => {
    it("arranca en Casos y sólo lista rutas de ese origen", async () => {
        const user = userEvent.setup();
        render(<FieldPathPicker value="" onChange={vi.fn()} />);

        expect(screen.getByTestId("folio_segment_origin")).toHaveTextContent(CASES_LABEL);

        await openFields(user);

        expect(screen.getByText("Consecutivo")).toBeInTheDocument();
        expect(screen.queryByText(AUX_PATH)).not.toBeInTheDocument();
        // Sigue oculta: getFieldValue la reescribe a estados.id y el folio fallaría siempre.
        expect(screen.queryByText("Estado actual")).not.toBeInTheDocument();
    });

    it("al cambiar a AuxCaso lista el auxiliar y limpia la selección previa", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<FieldPathPicker value="cases.reference" onChange={onChange} />);

        await openOrigins(user);
        await user.click(screen.getByTestId("folio_segment_origin_aux_cases"));

        expect(onChange).toHaveBeenCalledWith("");

        await openFields(user);
        expect(screen.getByText(AUX_PATH)).toBeInTheDocument();
        expect(screen.queryByText("Consecutivo")).not.toBeInTheDocument();
    });

    it("no ofrece orígenes que el folio no resuelve", async () => {
        const user = userEvent.setup();
        render(<FieldPathPicker value="" onChange={vi.fn()} />);

        await openOrigins(user);

        expect(screen.getByTestId("folio_segment_origin_cases")).toBeInTheDocument();
        expect(screen.getByTestId("folio_segment_origin_aux_cases")).toBeInTheDocument();
        expect(screen.queryByTestId("folio_segment_origin_usuarios")).not.toBeInTheDocument();
        expect(screen.queryByTestId("folio_segment_origin_clasificaciones")).not.toBeInTheDocument();
    });

    it("devuelve la ruta íntegra al seleccionarla", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<FieldPathPicker value={AUX_PATH} onChange={onChange} />);

        await openFields(user);
        await user.click(screen.getByRole("option", { name: AUX_PATH }));

        /*
         * cmdk sólo hace trim sobre el value, así que la ruta no debe llegar recortada ni en
         * minúsculas: el backend la resuelve tal cual con getFieldValue.
         */
        expect(onChange).toHaveBeenCalledWith(AUX_PATH);
    });

    it("preselecciona origen y campo al reabrir una configuración guardada", () => {
        render(<FieldPathPicker value={AUX_PATH} onChange={vi.fn()} />);

        expect(screen.getByTestId("folio_segment_origin")).toHaveTextContent(AUX_LABEL);
        expect(fieldTrigger()).toHaveTextContent(AUX_PATH);
    });

    it("conserva un origen legado que ya no se ofrece, en vez de vaciar el control", () => {
        render(<FieldPathPicker value="clasificaciones.nivel1" onChange={vi.fn()} />);

        expect(screen.getByTestId("folio_segment_origin")).toHaveTextContent("clasificaciones");
        expect(fieldTrigger()).toHaveTextContent("Nivel 1");
    });

    it("no deshabilita los controles mientras cargan los orígenes", () => {
        mockUseModelsData.mockReturnValue({ opcionesBuilder: [], loading: true });
        render(<FieldPathPicker value="" onChange={vi.fn()} />);

        expect(fieldTrigger()).not.toBeDisabled();
    });
});
