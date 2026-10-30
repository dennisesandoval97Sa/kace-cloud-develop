/* eslint-disable react/prop-types */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import HelpsForm from "./HelpsForm";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("@kace/ui-shared", () => ({
    KField: ({ children }) => <>{children}</>,
    InputForm: ({ name }) => <input name={name} />,
}));

vi.mock("../../../components/core/Cards/InputCard", () => ({
    default: ({ children }) => <>{children}</>,
}));

vi.mock("../../../components/core/Cards/FormCard", () => ({
    default: ({ children }) => (
        <>
            {children}
            <button type="submit">Save Help</button>
        </>
    ),
}));

vi.mock("../../../components/core/Cards/section-form", () => ({
    default: ({ children }) => <>{children}</>,
}));

vi.mock("./DescriptionEditor", () => ({
    DescriptionEditor: ({ touched, error }) => (
        <div data-testid="description-validation">{touched && error ? error : ""}</div>
    ),
}));

vi.mock("../../../components/core/SelectColor/select-color", () => ({
    SelectColor: () => null,
}));

vi.mock("./HelpsAttachments", () => ({
    default: () => null,
}));

vi.mock("../../../components/core/switchState/SwitchStateAdmin", () => ({
    SwitchStateAdmin: () => null,
}));

const blankDescriptionData = {
    titulo: "Help title",
    descripcion: '<p class="mb-1"><br></p>',
    color: "#2563EB",
    is_active: 1,
};

describe("HelpsForm description validation", () => {
    it.each([
        ["create", blankDescriptionData, false],
        [
            "edit",
            {
                ...blankDescriptionData,
                id: "server-help-id",
                help_id: "server-help-id",
            },
            true,
        ],
    ])(
        "blocks %s submission and shows the required error for a visually blank description",
        async (_, data, isEditMode) => {
            const user = userEvent.setup();
            const dataHandler = vi.fn();

            render(<HelpsForm data={data} dataHandler={dataHandler} isEditMode={isEditMode} />);
            await user.click(screen.getByRole("button", { name: "Save Help" }));

            await waitFor(() => {
                expect(dataHandler).not.toHaveBeenCalled();
                expect(screen.getByTestId("description-validation")).toHaveTextContent("Required");
            });
        },
    );
});
