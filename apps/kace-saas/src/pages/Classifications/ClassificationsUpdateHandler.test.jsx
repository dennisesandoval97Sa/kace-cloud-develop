import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_ERROR_CODES } from "@kace/error-codes";
import ClassificationsUpdateHandler from "./ClassificationsUpdateHandler";

const translations = {
    "app.errors.public.CLASSIFICATION_CREATE_TEMPLATES_NOT_FOUND": "One or more selected templates no longer exist.",
    "classification.alerts.errorTemplatesAssociate": "Cannot associate templates with the classification",
};

const mocks = vi.hoisted(() => ({
    apiPost: vi.fn(),
    formProps: undefined,
    mutate: vi.fn(),
    mutationOptions: undefined,
    navigate: vi.fn(),
    params: {},
    queryClient: {
        getQueryData: vi.fn(),
        invalidateQueries: vi.fn(),
        refetchQueries: vi.fn(),
        setQueryData: vi.fn(),
    },
    templateRelations: [],
    templateSeed: [],
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
    useNavigate: () => mocks.navigate,
    useParams: () => mocks.params,
}));

vi.mock("@tanstack/react-query", () => ({
    useQueryClient: () => mocks.queryClient,
    useQuery: ({ queryKey }) => {
        if (queryKey[0] === "classificationsForm") {
            return {
                data: mocks.params.id
                    ? {
                          id: mocks.params.id,
                          nivel1: "Support",
                          flujo_id: "flow-id",
                          ans_id: "ans-id",
                      }
                    : undefined,
                isFetchedAfterMount: Boolean(mocks.params.id),
                isRefetchError: false,
                isSuccess: Boolean(mocks.params.id),
            };
        }
        if (queryKey[0] === "classificationsTemplatesForm") {
            return {
                data: { data: mocks.templateRelations },
                isFetchedAfterMount: Boolean(mocks.params.id),
                isRefetchError: false,
                isSuccess: Boolean(mocks.params.id),
            };
        }
        if (queryKey[0] === "templatesClassificationSeed") {
            return {
                data: { data: mocks.templateSeed },
                isFetchedAfterMount: Boolean(mocks.params.id),
                isRefetchError: false,
                isSuccess: Boolean(mocks.params.id),
            };
        }
        return {
            data: { data: [] },
            isFetchedAfterMount: true,
            isRefetchError: false,
            isSuccess: true,
        };
    },
    useMutation: (options) => {
        mocks.mutationOptions = options;
        return {
            mutate: mocks.mutate,
            isLoading: false,
            isPending: false,
        };
    },
}));

vi.mock("./components/ClassificationsForm", () => ({
    default: (props) => {
        mocks.formProps = props;
        return null;
    },
}));

vi.mock("@kace/plugins", () => ({
    Uuid: () => "client-generated-classification-id",
}));

vi.mock("@kace/ui-shared", () => ({ GeneralLoader: () => null }));
vi.mock("./data/constants", () => ({ INITIAL_DATA_CLASSIFICATION: {} }));
vi.mock("sonner", () => ({
    toast: {
        error: mocks.toastError,
        success: mocks.toastSuccess,
    },
}));
vi.mock("../../services/generic-send-information", () => ({ sendInformation: vi.fn() }));
vi.mock("../../components/core/Cards/DashboardSectionCard", () => ({
    DashboardSectionCard: ({ children }) => children,
}));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key, options) => translations[key] ?? options?.defaultValue ?? key,
    }),
}));
vi.mock("../../utils/main", () => ({
    apiService: { post: mocks.apiPost },
    CLASSIFICATIONS_SERVICE: "/classifications",
    TEMPLATES_SERVICE: "/templates",
    removeKey: (data, keys) => Object.fromEntries(Object.entries(data).filter(([key]) => !keys.includes(key))),
}));
vi.mock("../../utils/URL", () => ({
    CLASSIFICATION_TEMPLATE_RELATIONS_SERVICE: "/classification-template-relations",
}));
vi.mock("../../services/genericSearch", () => ({ genericSearch: vi.fn() }));
vi.mock("../../services/genericView.js", () => ({ genericView: vi.fn() }));
vi.mock("@/hooks/useConfigAgentData", () => ({
    default: () => ({ cases: { case_enable_subcases: false } }),
}));

const TEMPLATE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TEMPLATE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CLASSIFICATION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("ClassificationsUpdateHandler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.formProps = undefined;
        mocks.mutationOptions = undefined;
        mocks.params = {};
        mocks.templateRelations = [];
        mocks.templateSeed = [];
        mocks.apiPost.mockResolvedValue({ status: 201 });
    });

    it("includes selected template ids in create and does not call the relationship API afterwards", async () => {
        render(<ClassificationsUpdateHandler />);

        await waitFor(() => expect(mocks.formProps).toBeDefined());
        await act(async () => {
            await mocks.formProps.dataHandler(
                {
                    nivel1: "Support",
                    flujo_id: "flow-id",
                    ans_id: "ans-id",
                },
                [{ id: TEMPLATE_A }, { id: TEMPLATE_A }, { id: TEMPLATE_B }],
            );
        });

        const request = mocks.mutate.mock.calls[0][0];
        expect(request.classificationRequest.url).toBe("/classifications");
        expect(request.classificationRequest.dataPost.id).toBeUndefined();
        expect(request.classificationRequest.dataPost.template_ids).toEqual([TEMPLATE_A, TEMPLATE_B]);
        expect(request.shouldReconcileTemplates).toBe(false);
        expect(mocks.apiPost).not.toHaveBeenCalled();
    });

    it("preserves the relationship API follow-up when editing a classification", async () => {
        mocks.params = { id: CLASSIFICATION_ID };
        render(<ClassificationsUpdateHandler />);

        await waitFor(() => expect(mocks.formProps).toBeDefined());
        await act(async () => {
            await mocks.formProps.dataHandler(
                {
                    id: CLASSIFICATION_ID,
                    nivel1: "Support",
                    flujo_id: "flow-id",
                    ans_id: "ans-id",
                },
                [{ id: TEMPLATE_A }],
            );
        });

        const request = mocks.mutate.mock.calls[0][0];
        expect(request.classificationRequest.url).toBe(`/classifications/${CLASSIFICATION_ID}`);
        expect(request.classificationRequest.dataPost.template_ids).toBeUndefined();
        expect(request.shouldReconcileTemplates).toBe(true);

        await act(async () => mocks.mutationOptions.mutationFn(request));

        expect(mocks.apiPost).toHaveBeenCalledWith("/classification-template-relations", [
            {
                classification_id: CLASSIFICATION_ID,
                template_id: TEMPLATE_A,
            },
        ]);
    });

    it("passes the persisted template seed and deletes a deselected seeded relation", async () => {
        mocks.params = { id: CLASSIFICATION_ID };
        mocks.templateRelations = [{ classification_id: CLASSIFICATION_ID, template_id: TEMPLATE_B }];
        mocks.templateSeed = [{ id: TEMPLATE_B, descripcion: "Template B" }];
        render(<ClassificationsUpdateHandler />);

        await waitFor(() => expect(mocks.formProps).toBeDefined());
        expect(mocks.formProps.templateSeed).toEqual(mocks.templateSeed);
        await act(async () => {
            await mocks.formProps.dataHandler(
                {
                    id: CLASSIFICATION_ID,
                    nivel1: "Support",
                    flujo_id: "flow-id",
                    ans_id: "ans-id",
                },
                [],
            );
        });

        const request = mocks.mutate.mock.calls[0][0];
        await act(async () => mocks.mutationOptions.mutationFn(request));

        expect(mocks.apiPost).toHaveBeenCalledWith("/classification-template-relations/delete", [
            {
                classification_id: CLASSIFICATION_ID,
                template_id: TEMPLATE_B,
            },
        ]);
    });

    it("shows the translated template validation error without requiring rollback context", () => {
        render(<ClassificationsUpdateHandler />);
        const error = {
            response: {
                data: {
                    data: { code: PUBLIC_ERROR_CODES.CLASSIFICATION_CREATE_TEMPLATES_NOT_FOUND },
                },
            },
        };

        expect(() => mocks.mutationOptions.onError(error, undefined, undefined)).not.toThrow();
        expect(mocks.toastError).toHaveBeenCalledWith("One or more selected templates no longer exist.");
    });

    it("shows a localized error when template association fails during edit", async () => {
        mocks.params = { id: CLASSIFICATION_ID };
        mocks.apiPost.mockRejectedValue(new Error("relation failed"));
        render(<ClassificationsUpdateHandler />);

        await waitFor(() => expect(mocks.formProps).toBeDefined());
        await act(async () => {
            await mocks.formProps.dataHandler(
                {
                    id: CLASSIFICATION_ID,
                    nivel1: "Support",
                    flujo_id: "flow-id",
                    ans_id: "ans-id",
                },
                [{ id: TEMPLATE_A }],
            );
        });

        const request = mocks.mutate.mock.calls[0][0];
        let error;
        await act(async () => {
            try {
                await mocks.mutationOptions.mutationFn(request);
            } catch (caughtError) {
                error = caughtError;
            }
            await mocks.mutationOptions.onError(error);
        });

        expect(mocks.toastError).toHaveBeenCalledWith("classification.alerts.partialTemplateUpdate");
    });
});
