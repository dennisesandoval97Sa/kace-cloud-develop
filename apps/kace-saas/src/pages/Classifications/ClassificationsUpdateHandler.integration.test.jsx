import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ClassificationsUpdateHandler from "./ClassificationsUpdateHandler";
import { sendInformation } from "../../services/generic-send-information";
import { genericSearch } from "../../services/genericSearch";
import { genericView } from "../../services/genericView";
import { apiService } from "../../utils/main";
import { toast } from "sonner";

const CLASSIFICATION_ID = "11111111-1111-4111-8111-111111111111";
const TEMPLATE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TEMPLATE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TEMPLATE_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const navigate = vi.fn();
let routeParams = { id: CLASSIFICATION_ID };
let selectedTemplates = [{ id: TEMPLATE_A, label: "Template A" }];
let submittedClassification;

vi.mock("react-router-dom", () => ({
    useNavigate: () => navigate,
    useParams: () => routeParams,
}));

vi.mock("./components/ClassificationsForm", () => ({
    default: ({ dataHandler, data, dataTemplates, isSending, templateSeed }) => (
        <button
            data-testid="classification-form"
            data-level-one={data.nivel1}
            data-template-ids={dataTemplates.join(",")}
            data-template-seed-ids={templateSeed.map(({ id }) => id).join(",")}
            disabled={isSending}
            onClick={() => dataHandler(submittedClassification ?? data, selectedTemplates)}
        >
            Save
        </button>
    ),
}));

vi.mock("./helpers", () => ({
    formatDataBeforePost: (values) => values,
}));

vi.mock("../../components/core/Cards/DashboardSectionCard", () => ({
    // Test-only shell mirrors the production card contract.
    // eslint-disable-next-line react/prop-types
    DashboardSectionCard: ({ children }) => <div>{children}</div>,
}));

vi.mock("@kace/ui-shared", () => ({
    GeneralLoader: () => <div>Loading</div>,
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("../../services/generic-send-information", () => ({
    sendInformation: vi.fn(),
}));

vi.mock("../../services/genericSearch", () => ({
    genericSearch: vi.fn(),
}));

vi.mock("../../services/genericView.js", () => ({
    genericView: vi.fn(),
}));

vi.mock("../../utils/main", () => ({
    CLASSIFICATIONS_SERVICE: "/classifications",
    TEMPLATES_SERVICE: "/templates",
    apiService: {
        post: vi.fn(),
    },
}));

vi.mock("sonner", () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    },
}));

const renderHandler = ({ cachedClassification, cachedTemplateRelations, cachedTemplateSeed } = {}) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    });
    if (cachedClassification) {
        queryClient.setQueryData(["classificationsForm", CLASSIFICATION_ID], cachedClassification);
    }
    if (cachedTemplateRelations) {
        queryClient.setQueryData(["classificationsTemplatesForm", CLASSIFICATION_ID], {
            data: cachedTemplateRelations,
        });
    }
    if (cachedTemplateSeed) {
        const persistedKey = cachedTemplateRelations
            .map(({ template_id: templateId }) => templateId)
            .sort()
            .join(",");
        queryClient.setQueryData(["templatesClassificationSeed", CLASSIFICATION_ID, persistedKey], {
            data: cachedTemplateSeed,
        });
    }

    return render(
        <QueryClientProvider client={queryClient}>
            <ClassificationsUpdateHandler />
        </QueryClientProvider>,
    );
};

const setupLoadedData = () => {
    genericView.mockResolvedValue({
        id: CLASSIFICATION_ID,
        nivel1: "General",
        can_start_sub_cases_flow: false,
    });
    genericSearch.mockImplementation((url) => {
        if (url === "/classification-template-relations/search") {
            return Promise.resolve({
                data: [
                    { classification_id: CLASSIFICATION_ID, template_id: TEMPLATE_A },
                    { classification_id: CLASSIFICATION_ID, template_id: TEMPLATE_B },
                ],
            });
        }
        if (url === "/templates/search") {
            return Promise.resolve({
                data: [
                    { id: TEMPLATE_A, descripcion: "Template A" },
                    { id: TEMPLATE_B, descripcion: "Template B" },
                ],
            });
        }
        throw new Error(`Unexpected search URL: ${url}`);
    });
    sendInformation.mockResolvedValue({ status: 200 });
    apiService.post.mockResolvedValue({ status: 200 });
};

describe("ClassificationsUpdateHandler template reconciliation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        routeParams = { id: CLASSIFICATION_ID };
        selectedTemplates = [{ id: TEMPLATE_A, label: "Template A" }];
        submittedClassification = undefined;
        setupLoadedData();
    });

    it("loads persisted template labels by id without dumping every active template", async () => {
        renderHandler();

        const form = await screen.findByTestId("classification-form");

        expect(genericSearch).toHaveBeenCalledWith(
            "/classification-template-relations/search",
            expect.any(Array),
            { limit: null, offset: null },
            null,
            false,
        );
        expect(genericSearch).toHaveBeenCalledWith(
            "/templates/search",
            [
                {
                    field: "status",
                    operator: "eq",
                    value: 1,
                    type: "AND",
                },
                {
                    field: "id",
                    operator: "in",
                    value: [TEMPLATE_A, TEMPLATE_B].join(","),
                    type: "AND",
                },
            ],
            { limit: 2, offset: 0 },
        );
        expect(form).toHaveAttribute("data-template-seed-ids", [TEMPLATE_A, TEMPLATE_B].join(","));
        expect(genericSearch).not.toHaveBeenCalledWith("/templates/search", expect.any(Array), {
            limit: null,
            offset: null,
        });
    });

    it("does not block the form when the seed request fails, falling back to an empty seed", async () => {
        genericSearch.mockImplementation((url) => {
            if (url === "/classification-template-relations/search") {
                return Promise.resolve({
                    data: [
                        { classification_id: CLASSIFICATION_ID, template_id: TEMPLATE_A },
                        { classification_id: CLASSIFICATION_ID, template_id: TEMPLATE_B },
                    ],
                });
            }
            if (url === "/templates/search") {
                return Promise.reject(new Error("seed request failed"));
            }
            throw new Error(`Unexpected search URL: ${url}`);
        });

        renderHandler();

        const form = await screen.findByTestId("classification-form");

        expect(form).toHaveAttribute("data-template-seed-ids", "");
        expect(form).toHaveAttribute("data-template-ids", [TEMPLATE_A, TEMPLATE_B].join(","));
    });

    it("mounts the create form without fetching classifications or templates", async () => {
        routeParams = {};

        renderHandler();

        await screen.findByTestId("classification-form");
        expect(genericView).not.toHaveBeenCalled();
        expect(genericSearch).not.toHaveBeenCalled();
    });

    it("does not render cached template relations before the fresh mount response", async () => {
        let resolveClassification;
        let resolveRelations;
        let resolveTemplates;
        const classificationRequest = new Promise((resolve) => {
            resolveClassification = resolve;
        });
        const relationRequest = new Promise((resolve) => {
            resolveRelations = resolve;
        });
        const templatesRequest = new Promise((resolve) => {
            resolveTemplates = resolve;
        });
        genericView.mockImplementation(() => classificationRequest);
        genericSearch.mockImplementation((url) => {
            if (url === "/classification-template-relations/search") {
                return relationRequest;
            }
            if (url === "/templates/search") {
                return templatesRequest;
            }
            throw new Error(`Unexpected search URL: ${url}`);
        });

        renderHandler({
            cachedClassification: {
                id: CLASSIFICATION_ID,
                nivel1: "General",
                can_start_sub_cases_flow: false,
            },
            cachedTemplateRelations: [
                { classification_id: CLASSIFICATION_ID, template_id: TEMPLATE_A },
                { classification_id: CLASSIFICATION_ID, template_id: TEMPLATE_B },
            ],
            cachedTemplateSeed: [
                { id: TEMPLATE_A, descripcion: "Template A" },
                { id: TEMPLATE_B, descripcion: "Template B" },
            ],
        });

        await waitFor(() => {
            expect(genericView).toHaveBeenCalled();
            expect(genericSearch).toHaveBeenCalledWith(
                "/classification-template-relations/search",
                expect.any(Array),
                expect.any(Object),
                null,
                false,
            );
        });

        expect(screen.queryByTestId("classification-form")).not.toBeInTheDocument();
        expect(screen.getByText("Loading")).toBeInTheDocument();

        await act(async () => {
            resolveClassification({
                id: CLASSIFICATION_ID,
                nivel1: "General",
                can_start_sub_cases_flow: false,
            });
            resolveRelations({
                data: [{ classification_id: CLASSIFICATION_ID, template_id: TEMPLATE_A }],
            });
        });
        await waitFor(() =>
            expect(genericSearch).toHaveBeenCalledWith(
                "/templates/search",
                expect.arrayContaining([expect.objectContaining({ field: "id", operator: "in", value: TEMPLATE_A })]),
                expect.any(Object),
            ),
        );
        expect(screen.queryByTestId("classification-form")).not.toBeInTheDocument();

        await act(async () => {
            resolveTemplates({
                data: [{ id: TEMPLATE_A, descripcion: "Template A" }],
            });
        });
        const form = await screen.findByTestId("classification-form");
        expect(form).toHaveAttribute("data-template-ids", TEMPLATE_A);
        expect(form).toHaveAttribute("data-template-seed-ids", TEMPLATE_A);
    });

    it("does not treat cached data as fresh when the forced mount refetch fails", async () => {
        genericView.mockRejectedValue(new Error("classification refetch failed"));
        genericSearch.mockRejectedValue(new Error("search refetch failed"));

        renderHandler({
            cachedClassification: {
                id: CLASSIFICATION_ID,
                nivel1: "Cached level",
                can_start_sub_cases_flow: false,
            },
            cachedTemplateRelations: [
                { classification_id: CLASSIFICATION_ID, template_id: TEMPLATE_A },
                { classification_id: CLASSIFICATION_ID, template_id: TEMPLATE_B },
            ],
            cachedTemplateSeed: [
                { id: TEMPLATE_A, descripcion: "Template A" },
                { id: TEMPLATE_B, descripcion: "Template B" },
            ],
        });

        await waitFor(() => {
            expect(genericView).toHaveBeenCalled();
            expect(genericSearch).toHaveBeenCalled();
        });
        await act(async () => {});

        expect(screen.queryByTestId("classification-form")).not.toBeInTheDocument();
        expect(screen.getByText("Loading")).toBeInTheDocument();
    });

    it("awaits deletion of a deselected template before reporting success", async () => {
        let resolveDelete;
        apiService.post.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveDelete = resolve;
                }),
        );
        renderHandler();

        fireEvent.click(await screen.findByTestId("classification-form"));

        await waitFor(() => {
            expect(apiService.post).toHaveBeenCalledWith("/classification-template-relations/delete", [
                {
                    classification_id: CLASSIFICATION_ID,
                    template_id: TEMPLATE_B,
                },
            ]);
        });
        expect(navigate).not.toHaveBeenCalled();
        expect(toast.success).not.toHaveBeenCalled();

        resolveDelete({ status: 200 });

        await waitFor(() => {
            expect(navigate).toHaveBeenCalledWith("/clasificaciones");
        });
        expect(toast.success).toHaveBeenCalledWith("app.alerts.done");
    });

    it("deletes removed relations before adding new relations", async () => {
        selectedTemplates = [
            { id: TEMPLATE_A, label: "Template A" },
            { id: TEMPLATE_C, label: "Template C" },
        ];
        renderHandler();

        fireEvent.click(await screen.findByTestId("classification-form"));

        await waitFor(() => {
            expect(apiService.post).toHaveBeenCalledTimes(2);
        });
        expect(apiService.post.mock.calls).toEqual([
            [
                "/classification-template-relations/delete",
                [{ classification_id: CLASSIFICATION_ID, template_id: TEMPLATE_B }],
            ],
            ["/classification-template-relations", [{ classification_id: CLASSIFICATION_ID, template_id: TEMPLATE_C }]],
        ]);
    });

    it("stays on the form and reports a partial save when relation reconciliation fails", async () => {
        apiService.post.mockRejectedValue(new Error("relation failed"));
        submittedClassification = {
            id: CLASSIFICATION_ID,
            nivel1: "Updated level",
            can_start_sub_cases_flow: false,
        };
        genericView
            .mockResolvedValueOnce({
                id: CLASSIFICATION_ID,
                nivel1: "General",
                can_start_sub_cases_flow: false,
            })
            .mockResolvedValue({
                id: CLASSIFICATION_ID,
                nivel1: "Updated level",
                can_start_sub_cases_flow: false,
            });
        renderHandler();

        fireEvent.click(await screen.findByTestId("classification-form"));

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("classification.alerts.partialTemplateUpdate");
        });
        expect(navigate).not.toHaveBeenCalled();
        expect(
            genericSearch.mock.calls.filter(([url]) => url === "/classification-template-relations/search"),
        ).toHaveLength(2);
        expect(genericView).toHaveBeenCalledTimes(2);
        expect(screen.getByTestId("classification-form")).toHaveAttribute("data-level-one", "Updated level");
    });

    it("reports the partial save truthfully when persisted state cannot be reloaded", async () => {
        let relationSearchCount = 0;
        apiService.post.mockRejectedValue(new Error("relation failed"));
        genericView
            .mockResolvedValueOnce({
                id: CLASSIFICATION_ID,
                nivel1: "General",
                can_start_sub_cases_flow: false,
            })
            .mockRejectedValue(new Error("classification recovery failed"));
        genericSearch.mockImplementation((url) => {
            if (url === "/classification-template-relations/search") {
                relationSearchCount += 1;
                if (relationSearchCount > 1) {
                    return Promise.reject(new Error("relation recovery failed"));
                }
                return Promise.resolve({
                    data: [
                        { classification_id: CLASSIFICATION_ID, template_id: TEMPLATE_A },
                        { classification_id: CLASSIFICATION_ID, template_id: TEMPLATE_B },
                    ],
                });
            }
            if (url === "/templates/search") {
                return Promise.resolve({
                    data: [
                        { id: TEMPLATE_A, descripcion: "Template A" },
                        { id: TEMPLATE_B, descripcion: "Template B" },
                    ],
                });
            }
            throw new Error(`Unexpected search URL: ${url}`);
        });
        renderHandler();

        fireEvent.click(await screen.findByTestId("classification-form"));

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("classification.alerts.partialTemplateReloadFailed");
        });
        expect(toast.error).not.toHaveBeenCalledWith("classification.alerts.partialTemplateUpdate");
        expect(navigate).not.toHaveBeenCalled();
        expect(screen.getByTestId("classification-form")).toBeInTheDocument();
    });
});
