import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HelpsForm from "./HelpsForm";

const mocks = vi.hoisted(() => ({
    values: {
        titulo: "Help title",
        descripcion: "Help description",
        color: "#ffffff",
    },
    setErrors: vi.fn(),
    setStatus: vi.fn(),
}));

vi.mock("formik", () => ({
    Formik: ({ onSubmit }) => (
        <button
            type="button"
            onClick={() =>
                onSubmit(mocks.values, {
                    setErrors: mocks.setErrors,
                    setStatus: mocks.setStatus,
                })
            }
        >
            Submit form
        </button>
    ),
    Form: ({ children }) => <form>{children}</form>,
}));

describe("HelpsForm submission identity", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("does not copy a draft Help ID into a create submission", async () => {
        const user = userEvent.setup();
        const dataHandler = vi.fn();
        render(<HelpsForm data={{ help_id: "draft-help-id" }} dataHandler={dataHandler} />);

        await user.click(screen.getByRole("button", { name: "Submit form" }));

        expect(dataHandler).toHaveBeenCalledWith(
            expect.not.objectContaining({ id: expect.anything() }),
            mocks.setErrors,
            mocks.setStatus,
        );
    });

    it("uses the persisted Help ID for edit submissions", async () => {
        const user = userEvent.setup();
        const dataHandler = vi.fn();
        render(<HelpsForm data={{ help_id: "server-help-id" }} dataHandler={dataHandler} isEditMode />);

        await user.click(screen.getByRole("button", { name: "Submit form" }));

        expect(dataHandler).toHaveBeenCalledWith(
            expect.objectContaining({ id: "server-help-id" }),
            mocks.setErrors,
            mocks.setStatus,
        );
    });
});
