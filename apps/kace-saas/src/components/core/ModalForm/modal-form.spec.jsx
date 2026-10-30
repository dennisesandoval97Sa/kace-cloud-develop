import { configureStore } from "@reduxjs/toolkit";
import { render, screen } from "@testing-library/react";
import { Formik } from "formik";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";
import modalBehaviorReducer from "../../../redux/state/modalBehavior";
import ModalForm from "./modal-form";

const renderModalForm = ({ canBeEditState = true, canBeEdit = true } = {}) => {
    const store = configureStore({
        reducer: { modalBehavior: modalBehaviorReducer },
        preloadedState: { modalBehavior: { open: true, idSelected: "1", canBeEdit: canBeEditState } },
    });

    render(
        <Provider store={store}>
            <Formik initialValues={{}} onSubmit={() => {}}>
                <ModalForm open isIcon={false} hasEntity title="States" canBeEdit={canBeEdit}>
                    <button type="button">Pick icon</button>
                </ModalForm>
            </Formik>
        </Provider>,
    );
};

describe("ModalForm", () => {
    it("disables the form and footer buttons when viewing a record", () => {
        renderModalForm({ canBeEditState: false });

        expect(screen.getByRole("button", { name: "Pick icon" })).toBeDisabled();
        expect(screen.getByTestId("btn_clear_modal_form")).toBeDisabled();
        expect(screen.getByTestId("btn_save_modal_form")).toBeDisabled();
    });

    it("disables the form and footer buttons when the module forbids editing", () => {
        renderModalForm({ canBeEdit: false });

        expect(screen.getByTestId("btn_clear_modal_form")).toBeDisabled();
        expect(screen.getByTestId("btn_save_modal_form")).toBeDisabled();
    });

    it("keeps the buttons enabled when editing a record", () => {
        renderModalForm();

        expect(screen.getByRole("button", { name: "Pick icon" })).toBeEnabled();
        expect(screen.getByTestId("btn_clear_modal_form")).toBeEnabled();
        expect(screen.getByTestId("btn_save_modal_form")).toBeEnabled();
    });
});
