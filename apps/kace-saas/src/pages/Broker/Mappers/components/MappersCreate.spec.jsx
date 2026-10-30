/* eslint-disable react/prop-types */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MappersCreate from "./MappersCreate";

const testState = vi.hoisted(() => ({
    mutate: vi.fn(),
    navigate: vi.fn(),
    setErrors: vi.fn(),
    setStatus: vi.fn(),
    values: {},
}));

vi.mock("react-i18next", async (importOriginal) => ({
    ...(await importOriginal()),
    useTranslation: () => ({
        t: (key) =>
            key === "app.errors.public.BROKER_MAPPER_VALIDATION_FAILED"
                ? "Complete the mapper name and REST flow, and complete every field in each added mapping rule."
                : key,
    }),
}));

vi.mock("react-router-dom", () => ({
    useLocation: () => ({ pathname: "/broker/mappers/update/991f1a99-1d75-4b7d-8bd7-379ab919bb70" }),
    useNavigate: () => testState.navigate,
    useParams: () => ({ id: "991f1a99-1d75-4b7d-8bd7-379ab919bb70" }),
}));

vi.mock("@/hooks/useGenericViewQuery", () => ({
    default: () => ({
        data: null,
        isLoading: false,
    }),
}));

vi.mock("@/hooks/useGeneralMutation", () => ({
    default: () => ({
        mutate: testState.mutate,
        isPending: false,
    }),
}));

vi.mock("./MappersCreateForm", () => ({
    default: ({ dataHandler }) => (
        <button
            type="button"
            onClick={() => {
                dataHandler(testState.values, testState.setErrors, testState.setStatus).catch(() => {});
            }}
        >
            Submit mapper
        </button>
    ),
}));

vi.mock("@/components/core/Cards/DashboardSectionCard", () => ({
    DashboardSectionCard: ({ children }) => <div>{children}</div>,
}));

describe("MappersCreate", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        testState.values = {
            id: "991f1a99-1d75-4b7d-8bd7-379ab919bb70",
            name: "Cases mapper",
            queue: "",
            rest_flow_id: "flow-1",
            rules: [],
        };
        testState.mutate.mockResolvedValue({});
    });

    it("sends an explicit empty rules array when all rules are removed during edit", async () => {
        const user = userEvent.setup();

        render(<MappersCreate />);
        await user.click(screen.getByRole("button", { name: "Submit mapper" }));

        await waitFor(() => {
            expect(testState.mutate).toHaveBeenCalledWith(
                expect.objectContaining({
                    dataPost: expect.objectContaining({
                        queue: null,
                        rules: [],
                    }),
                }),
            );
        });
    });

    it("clears Formik status after a successful save", async () => {
        const user = userEvent.setup();

        render(<MappersCreate />);
        await user.click(screen.getByRole("button", { name: "Submit mapper" }));

        await waitFor(() => {
            expect(testState.setStatus).toHaveBeenCalledWith(undefined);
            expect(testState.navigate).toHaveBeenCalledWith("/broker/mappers");
        });
    });

    it("maps backend debug field errors to their Formik paths", async () => {
        const user = userEvent.setup();
        testState.mutate.mockRejectedValue({
            response: {
                data: {
                    errors: [
                        { field: "rest_flow_id", message: "REST flow is required" },
                        { field: "rules.0.target_field", message: "Target field is required" },
                    ],
                },
            },
        });

        render(<MappersCreate />);
        await user.click(screen.getByRole("button", { name: "Submit mapper" }));

        await waitFor(() => {
            expect(testState.setErrors).toHaveBeenCalledWith({
                rest_flow_id: "REST flow is required",
                rules: [{ target_field: "Target field is required" }],
            });
        });
        expect(testState.setStatus).toHaveBeenLastCalledWith(undefined);
    });

    it("uses the translated public validation code when production suppresses field details", async () => {
        const user = userEvent.setup();
        testState.mutate.mockRejectedValue({
            response: {
                data: {
                    message: "The request could not be processed.",
                    data: { code: "0x030028" },
                    errors: [
                        {
                            code: "0x030028",
                            message: "The request could not be processed.",
                        },
                    ],
                },
            },
        });

        render(<MappersCreate />);
        await user.click(screen.getByRole("button", { name: "Submit mapper" }));

        await waitFor(() => {
            expect(testState.setErrors).toHaveBeenCalledWith({});
            expect(testState.setStatus).toHaveBeenCalledWith(
                "Complete the mapper name and REST flow, and complete every field in each added mapping rule.",
            );
        });
    });
});
