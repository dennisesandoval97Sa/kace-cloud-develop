/* eslint-disable react/prop-types */
import React from "react";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = { modalBehavior: { open: true, idSelected: "list-1" } };

let viewData = null;
let formikOnSubmit;
let formikInitialValues;
const resetFormSpy = vi.fn();
const multiSelectPropsSpy = vi.fn();
const sendInformationSpy = vi.fn(() => ({ mock: true }));
const mutateSpy = vi.fn();

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("react-redux", () => ({
    useSelector: (selector) => selector(state),
}));

vi.mock("sonner", () => ({ toast: { warning: vi.fn() } }));

vi.mock("../../../hooks/useGeneralMutation", () => ({
    default: () => ({ mutate: mutateSpy, isPending: false }),
}));

vi.mock("../../../hooks/useGenericViewQuery", () => ({
    default: () => ({ data: viewData, isLoading: false }),
}));

vi.mock("../../../services/genericHandleSendInformation", () => ({
    genericHandleSendInformation: (args) => sendInformationSpy(args),
}));

vi.mock("../../../components/core/multiselector/MultiSelectUsers", () => ({
    MultiSelectUsers: (props) => {
        multiSelectPropsSpy(props);
        return <div data-testid="multi-select-users" />;
    },
}));

vi.mock("../../../components/core/ModalForm/modal-form", () => ({
    default: ({ children, resetForm }) => (
        <div>
            <button data-testid="btn_clear_modal_form" onClick={resetForm} type="button">
                clear
            </button>
            {children}
        </div>
    ),
}));

vi.mock("formik", () => ({
    Formik: ({ children, onSubmit, initialValues }) => {
        formikOnSubmit = onSubmit;
        formikInitialValues = initialValues;
        return children({ errors: {}, status: undefined, setStatus: vi.fn(), resetForm: resetFormSpy });
    },
}));

vi.mock("@kace/ui-shared", () => ({
    InputFormModal: () => null,
    KField: ({ children }) => <div>{children}</div>,
    FormikStatusMessages: () => null,
    SelectByProvider: () => null,
}));

vi.mock("@kace/utils", () => ({ joiFormikAdapter: () => undefined }));

const { default: UserListForm } = await import("./UserListForm");

const existingList = {
    id: "list-1",
    descripcion: "Lista original",
    is_active: true,
    group_id: "",
    lista_usuarios: [{ id: "u-1" }],
};

describe("UserListForm — botón «Limpiar» en modo edición", () => {
    beforeEach(() => {
        viewData = existingList;
        resetFormSpy.mockClear();
        multiSelectPropsSpy.mockClear();
        sendInformationSpy.mockClear();
        mutateSpy.mockClear();
    });

    it("preserva el id de la entidad y vacía los usuarios seleccionados", () => {
        render(<UserListForm />);

        act(() => {
            document.querySelector('[data-testid="btn_clear_modal_form"]').click();
        });

        expect(resetFormSpy).toHaveBeenCalledWith({
            values: expect.objectContaining({ id: "list-1", descripcion: "" }),
        });
        // usersData es la prop `values` del multiselector: debe quedar vacía tras «Limpiar»
        expect(multiSelectPropsSpy.mock.calls.at(-1)[0].values).toEqual([]);
    });

    it("onSubmit conserva el id y no muta el objeto values de Formik", () => {
        render(<UserListForm />);
        expect(formikInitialValues).toEqual(expect.objectContaining({ id: "list-1" }));

        act(() => {
            multiSelectPropsSpy.mock.calls.at(-1)[0].setListValues([{ id: "u-1" }]);
        });

        const values = { id: "list-1", descripcion: "Lista original" };
        act(() => {
            formikOnSubmit(values, { setErrors: vi.fn(), setStatus: vi.fn() });
        });

        expect(values).not.toHaveProperty("lista_usuarios");
        expect(sendInformationSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                values: expect.objectContaining({
                    id: "list-1",
                    descripcion: "Lista original",
                    lista_usuarios: [{ id: "u-1" }],
                }),
            }),
        );
    });

    it("pide al selector conservar el orden del catálogo, igual que Lista de Grupos", () => {
        render(<UserListForm />);

        expect(multiSelectPropsSpy.mock.calls.at(-1)[0].groupSelectedFirst).toBe(false);
    });
});
