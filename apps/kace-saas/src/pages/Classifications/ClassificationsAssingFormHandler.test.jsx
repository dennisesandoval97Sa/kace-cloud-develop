import { render } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { PUBLIC_ERROR_CODES } from "@kace/error-codes";
import ClassificationsAssingFormHandler from "./ClassificationsAssingFormHandler";

const mocks = vi.hoisted(() => ({
    cancelQueries: vi.fn(),
    getQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
    mutate: vi.fn(),
    navigate: vi.fn(),
    toastError: vi.fn(),
    mutationOptions: undefined,
}));

vi.mock("@tanstack/react-query", () => ({
    useQueryClient: () => ({
        cancelQueries: mocks.cancelQueries,
        getQueryData: mocks.getQueryData,
        invalidateQueries: mocks.invalidateQueries,
        setQueryData: mocks.setQueryData,
    }),
    useQuery: () => ({
        data: null,
        isLoading: false,
    }),
    useMutation: (options) => {
        mocks.mutationOptions = options;

        return {
            mutate: mocks.mutate,
            isLoading: false,
            isPending: false,
        };
    },
}));

vi.mock("react-router-dom", () => ({
    useNavigate: () => mocks.navigate,
    useParams: () => ({ id: "classification-1" }),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) => key,
    }),
}));

vi.mock("sonner", () => ({
    toast: {
        error: mocks.toastError,
        success: vi.fn(),
    },
}));

vi.mock("@kace/utils", () => ({
    CLASSIFICATIONS_SERVICE: "classifications",
    formatClassifications: vi.fn(),
}));

vi.mock("@kace/ui-shared", () => ({
    GeneralLoader: () => <div data-testid="loader" />,
}));

vi.mock("./components/AssignViewForm", () => ({
    default: () => <div data-testid="assign-view-form" />,
}));

vi.mock("../../components/core/Cards/DashboardSectionCard", () => ({
    DashboardSectionCard: ({ children }) => <section>{children}</section>,
}));

vi.mock("../../services/genericView", () => ({
    genericView: vi.fn(),
}));

vi.mock("../../services/generic-send-information", () => ({
    sendInformation: vi.fn(),
}));

describe("ClassificationsAssingFormHandler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mutationOptions = undefined;
        mocks.cancelQueries.mockResolvedValue();
    });

    it("restores the previous classification assignment data when create fails", async () => {
        const previousClassifications = { data: [{ group_id: "group-1" }] };
        const dataPost = { group_id: "group-2" };
        mocks.getQueryData.mockReturnValue(previousClassifications);
        render(<ClassificationsAssingFormHandler />);

        const context = await mocks.mutationOptions.onMutate({ dataPost });
        const optimisticUpdater = mocks.setQueryData.mock.calls[0][1];
        mocks.mutationOptions.onError(
            {
                response: {
                    data: {
                        data: { code: PUBLIC_ERROR_CODES.CLASSIFICATION_GROUP_RELATION_NOT_FOUND },
                        errors: [{ message: "backend detail" }],
                    },
                },
            },
            null,
            context,
        );

        expect(mocks.cancelQueries).toHaveBeenCalledWith(["classificationAssignData"]);
        expect(context).toEqual({ previousClassifications });
        expect(optimisticUpdater(previousClassifications)).toEqual({
            data: [{ group_id: "group-1" }, { group_id: "group-2" }],
        });
        expect(mocks.setQueryData).toHaveBeenLastCalledWith(["classificationAssignData"], previousClassifications);
        expect(mocks.toastError).toHaveBeenCalledWith("app.alerts.relationclassificationGroup");
    });

    it("does not throw when React Query has no rollback context", () => {
        render(<ClassificationsAssingFormHandler />);

        expect(() => {
            mocks.mutationOptions.onError(
                {
                    response: {
                        data: {
                            errors: "Create failed",
                        },
                    },
                },
                null,
                undefined,
            );
        }).not.toThrow();
        expect(mocks.setQueryData).not.toHaveBeenCalled();
        expect(mocks.toastError).toHaveBeenCalledWith("app.errors.generic");
    });

    it("does not throw when the create request fails before receiving a response", () => {
        render(<ClassificationsAssingFormHandler />);

        expect(() => {
            mocks.mutationOptions.onError(new Error("Network Error"), null, undefined);
        }).not.toThrow();
        expect(mocks.toastError).toHaveBeenCalledWith("Network Error");
    });
});
