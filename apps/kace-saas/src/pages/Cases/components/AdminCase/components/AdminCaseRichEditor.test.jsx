import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminCaseRichEditor from "./AdminCaseRichEditor";

const setFieldValue = vi.fn();
let formValues;
let editorProps;

vi.mock("formik", () => ({
    useFormikContext: () => ({
        values: formValues,
        setFieldValue,
        submitForm: vi.fn(),
    }),
}));

vi.mock("../hooks/useAdminCaseUserInfo", () => ({
    default: () => ({ userCanEditCase: true }),
}));

vi.mock("../hooks/useAdminCaseDescription", () => ({
    default: () => ({ handleCreateDescription: vi.fn() }),
}));

vi.mock("./AdminCaseCardModules", () => ({
    AdminCaseCardModules: ({ children }) => children,
}));

vi.mock("../../../../../components/core/Editor/Editor", () => ({
    RichEditor: (props) => {
        editorProps = props;
        return null;
    },
}));

const DEBOUNCE_MS = 800;
const type = (value) => editorProps.setValue("descripcion_caso", value);

describe("AdminCaseRichEditor - cambios pendientes del debounce", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        setFieldValue.mockClear();
        formValues = { descripcion_caso: "", descripcion_caso_id: "desc-1" };
        editorProps = undefined;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("envía a Formik el último texto tecleado en cuanto el editor pierde el foco (p. ej. al pulsar Enviar)", () => {
        render(<AdminCaseRichEditor />);

        type("<p>h</p>");
        type("<p>hola</p>");
        editorProps.onBlur();

        expect(setFieldValue).toHaveBeenCalledOnce();
        expect(setFieldValue).toHaveBeenCalledWith("descripcion_caso", "<p>hola</p>");

        vi.advanceTimersByTime(DEBOUNCE_MS);
        expect(setFieldValue).toHaveBeenCalledOnce();
    });

    it("no toca Formik al perder el foco si no hay texto pendiente", () => {
        render(<AdminCaseRichEditor />);

        editorProps.onBlur();

        expect(setFieldValue).not.toHaveBeenCalled();
    });

    it("envía a Formik el último texto tecleado cuando se desmonta antes de que venza el debounce", () => {
        const { unmount } = render(<AdminCaseRichEditor />);

        type("<p>h</p>");
        type("<p>hola</p>");
        vi.advanceTimersByTime(DEBOUNCE_MS - 1);
        expect(setFieldValue).not.toHaveBeenCalled();

        unmount();
        vi.advanceTimersByTime(DEBOUNCE_MS);

        expect(setFieldValue).toHaveBeenCalledOnce();
        expect(setFieldValue).toHaveBeenCalledWith("descripcion_caso", "<p>hola</p>");
    });

    it("no vuelve a enviar el texto al desmontar si el debounce ya lo aplicó", () => {
        const { unmount } = render(<AdminCaseRichEditor />);

        type("<p>hola</p>");
        vi.advanceTimersByTime(DEBOUNCE_MS);
        expect(setFieldValue).toHaveBeenCalledOnce();

        unmount();

        expect(setFieldValue).toHaveBeenCalledOnce();
    });

    it("no toca Formik al desmontar si no hubo tecleo", () => {
        const { unmount } = render(<AdminCaseRichEditor />);

        unmount();

        expect(setFieldValue).not.toHaveBeenCalled();
    });

    it("descarta el texto pendiente de la descripción anterior cuando Formik carga otra descripción", () => {
        const { rerender, unmount } = render(<AdminCaseRichEditor />);

        type("<p>texto de la descripción anterior</p>");
        formValues = { descripcion_caso: "<p>del servidor</p>", descripcion_caso_id: "desc-2" };
        rerender(<AdminCaseRichEditor />);
        vi.advanceTimersByTime(DEBOUNCE_MS);
        unmount();

        expect(setFieldValue).not.toHaveBeenCalled();
    });
});
