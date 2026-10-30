import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useGeneralMutation from "../../hooks/useGeneralMutation";
import { AutomationSettingsCreate } from "./AutomationSettingsCreate";

const ROUTE_ID = "11111111-1111-4111-8111-111111111111";

vi.mock("@tanstack/react-query", () => ({
    useQuery: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
    useNavigate: vi.fn(),
    useParams: vi.fn(),
    useSearchParams: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
    ...(await importOriginal()),
    useTranslation: () => ({
        t: (key, options) => options?.defaultValue ?? key,
    }),
}));

vi.mock("../../hooks/useGeneralMutation", () => ({
    default: vi.fn(),
}));

vi.mock("../../components/core/Cards/DashboardSectionCard", () => ({
    // eslint-disable-next-line react/prop-types
    DashboardSectionCard: ({ children }) => <div data-testid="dashboard-section-card">{children}</div>,
}));

vi.mock("@kace/ui-shared", () => ({
    // eslint-disable-next-line react/prop-types
    Button: ({ children, ...props }) => <button {...props}>{children}</button>,
    GeneralLoader: () => <div data-testid="general-loader">Loading</div>,
}));

vi.mock("./components/AutomationSettingsForm", () => ({
    default: ({ data, dataHandler, isSending, mode, isReadOnly }) => (
        <div
            data-testid="automation-settings-form"
            data-id={data?.id}
            data-is-sending={isSending}
            data-mode={mode}
            data-is-read-only={isReadOnly}
        >
            <button
                type="button"
                onClick={() =>
                    dataHandler({
                        ...data,
                        id: mode === "edit" ? "22222222-2222-4222-8222-222222222222" : undefined,
                        description: "Updated automation",
                        frequency: "0 * * * *",
                        start_date: new Date("2026-01-01T00:00:00.000Z"),
                        end_date: new Date("2026-12-31T00:00:00.000Z"),
                    })
                }
            >
                Submit
            </button>
        </div>
    ),
}));

describe("AutomationSettingsCreate lifecycle", () => {
    const mutate = vi.fn();
    const navigate = vi.fn();
    const refetch = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        useParams.mockReturnValue({ id: ROUTE_ID });
        useNavigate.mockReturnValue(navigate);
        useSearchParams.mockReturnValue([new URLSearchParams()]);
        useGeneralMutation.mockReturnValue({
            mutate,
            isPending: false,
        });
        useQuery.mockReturnValue({
            data: undefined,
            isError: false,
            isLoading: true,
            refetch,
        });
    });

    it("withholds the edit form while the target automation is loading", () => {
        render(<AutomationSettingsCreate />);

        expect(screen.getByTestId("general-loader")).toBeInTheDocument();
        expect(screen.queryByTestId("automation-settings-form")).not.toBeInTheDocument();
    });

    it("keeps a failed edit non-editable and offers retry and back actions", () => {
        useQuery.mockReturnValue({
            data: undefined,
            isError: true,
            isLoading: false,
            refetch,
        });

        render(<AutomationSettingsCreate />);

        expect(screen.getByRole("alert")).toHaveTextContent("Unable to load this automation.");
        expect(screen.queryByTestId("automation-settings-form")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Retry" }));
        fireEvent.click(screen.getByRole("button", { name: "Back" }));

        expect(refetch).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith(-1);
    });

    it("hydrates an explicit edit form with the route id as its identity", async () => {
        useQuery.mockReturnValue({
            data: {
                id: "22222222-2222-4222-8222-222222222222",
                description: "Fetched automation",
                frequency: "0 * * * *",
                start_date: "2026-01-01T00:00:00.000Z",
                end_date: "2026-12-31T00:00:00.000Z",
            },
            isError: false,
            isLoading: false,
            refetch,
        });

        render(<AutomationSettingsCreate />);

        await waitFor(() => {
            expect(screen.getByTestId("automation-settings-form")).toHaveAttribute("data-mode", "edit");
            expect(screen.getByTestId("automation-settings-form")).toHaveAttribute("data-id", ROUTE_ID);
        });
    });

    it("updates the route target without sending an id in the request body", () => {
        useQuery.mockReturnValue({
            data: {
                id: "22222222-2222-4222-8222-222222222222",
                description: "Fetched automation",
                frequency: "0 * * * *",
                start_date: "2026-01-01T00:00:00.000Z",
                end_date: "2026-12-31T00:00:00.000Z",
            },
            isError: false,
            isLoading: false,
            refetch,
        });

        render(<AutomationSettingsCreate />);
        fireEvent.click(screen.getByRole("button", { name: "Submit" }));

        expect(mutate).toHaveBeenCalledWith(
            expect.objectContaining({
                id: ROUTE_ID,
                url: `/automation-settings/${ROUTE_ID}`,
                dataPost: {
                    description: "Updated automation",
                    frequency: "0 * * * *",
                    start_date: "2026-01-01T00:00:00.000Z",
                    end_date: "2026-12-31T00:00:00.000Z",
                },
            }),
        );
    });

    it("derives read-only mode from action=see and blocks the mutation path", () => {
        useSearchParams.mockReturnValue([new URLSearchParams("action=see")]);
        useQuery.mockReturnValue({
            data: {
                id: "22222222-2222-4222-8222-222222222222",
                description: "Fetched automation",
                frequency: "0 * * * *",
                start_date: "2026-01-01T00:00:00.000Z",
                end_date: "2026-12-31T00:00:00.000Z",
            },
            isError: false,
            isLoading: false,
            refetch,
        });

        render(<AutomationSettingsCreate />);

        expect(screen.getByTestId("automation-settings-form")).toHaveAttribute("data-is-read-only", "true");
        fireEvent.click(screen.getByRole("button", { name: "Submit" }));

        expect(mutate).not.toHaveBeenCalled();
    });

    it("submits in edit mode when action=see is absent", () => {
        useQuery.mockReturnValue({
            data: {
                id: "22222222-2222-4222-8222-222222222222",
                description: "Fetched automation",
                frequency: "0 * * * *",
                start_date: "2026-01-01T00:00:00.000Z",
                end_date: "2026-12-31T00:00:00.000Z",
            },
            isError: false,
            isLoading: false,
            refetch,
        });

        render(<AutomationSettingsCreate />);

        expect(screen.getByTestId("automation-settings-form")).toHaveAttribute("data-is-read-only", "false");
        fireEvent.click(screen.getByRole("button", { name: "Submit" }));

        expect(mutate).toHaveBeenCalledOnce();
    });

    it("preserves create mode and submits to the collection endpoint", () => {
        useParams.mockReturnValue({});
        useQuery.mockReturnValue({
            data: undefined,
            isError: false,
            isLoading: false,
            refetch,
        });

        render(<AutomationSettingsCreate />);

        expect(screen.getByTestId("automation-settings-form")).toHaveAttribute("data-mode", "create");
        fireEvent.click(screen.getByRole("button", { name: "Submit" }));

        expect(mutate).toHaveBeenCalledWith(
            expect.objectContaining({
                id: undefined,
                url: "/automation-settings",
                dataPost: {
                    id: expect.any(String),
                    description: "Updated automation",
                    frequency: "0 * * * *",
                    start_date: "2026-01-01T00:00:00.000Z",
                    end_date: "2026-12-31T00:00:00.000Z",
                },
            }),
        );
    });
});
