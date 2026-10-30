/* eslint-disable react/prop-types */
import React from "react";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = { modalBehavior: { open: true, idSelected: "group-list-1" } };

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

vi.mock("../../../components/core/multiselector/MultiSelectGroups", () => ({
    MultiSelectGroups: (props) => {
        multiSelectPropsSpy(props);
        return <div data-testid="multi-select-groups" />;
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
}));

vi.mock("@kace/utils", () => ({ joiFormikAdapter: () => undefined }));

const { GroupListForm } = await import("./GroupListForm");

const existingGroupList = {
    id: "group-list-1",
    descripcion: "Lista original",
    is_active: true,
    lista_grupos: [{ id: "g-1", label: "Grupo 1" }],
};

describe("GroupListForm — botón «Limpiar» en modo edición", () => {
    beforeEach(() => {
        viewData = existingGroupList;
        resetFormSpy.mockClear();
        multiSelectPropsSpy.mockClear();
        sendInformationSpy.mockClear();
        mutateSpy.mockClear();
    });

    it("preserva el id de la entidad y vacía los grupos seleccionados", () => {
        render(<GroupListForm />);

        act(() => {
            document.querySelector('[data-testid="btn_clear_modal_form"]').click();
        });

        expect(resetFormSpy).toHaveBeenCalledWith({
            values: expect.objectContaining({ id: "group-list-1", descripcion: "" }),
        });
        expect(multiSelectPropsSpy.mock.calls.at(-1)[0].listValues).toEqual([]);
    });

    it("onSubmit conserva el id y no muta el objeto values de Formik", () => {
        render(<GroupListForm />);
        expect(formikInitialValues).toEqual(expect.objectContaining({ id: "group-list-1" }));

        act(() => {
            multiSelectPropsSpy.mock.calls.at(-1)[0].setListValues([{ id: "g-1", label: "Grupo 1" }]);
        });

        const values = { id: "group-list-1", descripcion: "Lista original" };
        act(() => {
            formikOnSubmit(values);
        });

        expect(values).not.toHaveProperty("lista_grupos");
        expect(sendInformationSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                values: expect.objectContaining({
                    id: "group-list-1",
                    lista_grupos: [{ id: "g-1", label: "Grupo 1" }],
                }),
            }),
        );
    });
});
