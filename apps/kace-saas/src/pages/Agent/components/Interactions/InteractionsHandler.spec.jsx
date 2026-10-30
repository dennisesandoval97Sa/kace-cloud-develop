/* eslint-disable react/prop-types */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiService } from "@kace/utils";
import useGenericSearchQuery from "@/hooks/useGenericSearchQuery";
import { useInteractionEmail } from "@/pages/Interactions/hooks/useInteractionEmail";
import { toast } from "sonner";
import { useLinkedInteractionCases } from "./cases/hooks/useLinkedInteractionCases";
import InteractionsHandler from "./InteractionsHandler";
import InteractionsFilters from "./InteractionsFilters";
import InteractionsWorkspaceSelect from "./InteractionsWorkspaceTabs";
import InteractionWorkspaceMove from "./workSpace/InteractionWorkspaceMove";
import { agentMoveWorkspaceDestinationsKey } from "./hooks/useAgentMoveWorkspaceDestinations";
import { SYSTEM_INBOX_WORKSPACE_ID } from "@/utils/systemInboxWorkspace";

const mocks = vi.hoisted(() => {
    const interaction = {
        id: "interaction-1",
        email_id: "email-1",
        description: "Solicitud agente",
        client_identifier: "cliente@demo.com",
        created_at: "2026-05-27T12:00:00.000Z",
        in_review: false,
        is_closed: false,
    };

    return {
        baseInteraction: interaction,
        interactionsData: [interaction],
        totalInteractions: 1,
        closePending: false,
        dispatch: vi.fn(),
        navigate: vi.fn(),
        clearSelectedClient: vi.fn(),
        createCaseAction: vi.fn(),
        openCaseAction: vi.fn(),
        user: { id: "current-user" },
        activeGroupId: "group-1",
        permissionsAdmin: [],
        permissionsAgent: [{ module_id: "interactions", name: "InteractionsCreate", granted: true }],
        configAgent: {
            cases: {
                case_enable_subcases: true,
            },
        },
        agentContext: {
            clientId: "",
            dataUserSelected: {},
            isNewClient: true,
        },
        linkedCases: [],
        linkedCaseIds: [],
        linkedCasesRefetch: vi.fn(),
        refetch: vi.fn(),
        closeMutate: vi.fn(),
        searchSuggestedClientsByEmail: vi.fn(),
        location: {
            pathname: "/agent",
            search: "",
        },
    };
});

vi.mock("@kace/utils", () => ({
    apiService: {
        get: vi.fn(),
        post: vi.fn(),
    },
    removeKey: vi.fn((data, keys = []) =>
        Object.fromEntries(Object.entries(data ?? {}).filter(([key]) => !keys.includes(key))),
    ),
}));

vi.mock("@/hooks/useGenericSearchQuery", () => ({
    default: vi.fn(({ url, select, filter, enabled }) => {
        if (url === "/interactions/agent/search") {
            const queryData = {
                data: mocks.interactionsData,
                count: mocks.interactionsData.length,
                total: mocks.totalInteractions,
                metadata: {
                    count: mocks.totalInteractions,
                },
            };

            return {
                data: enabled === false ? undefined : select ? select(queryData) : queryData,
                isLoading: false,
                isFetching: false,
                refetch: mocks.refetch,
            };
        }

        if (url === "/literals/search") {
            const hasFilter = (field, value) =>
                Array.isArray(filter) &&
                filter.some((item) => item?.field === field && String(item?.value) === String(value));
            let data = [];

            if (hasFilter("nombre", "interactions")) {
                data = [{ id: "literal-model", nombre: "interactions" }];
            } else if (hasFilter("nombre", "closed_observation")) {
                data = [{ id: "literal-field", nombre: "closed_observation" }];
            } else if (hasFilter("tipo_literal", "literal-field")) {
                data = [{ id: "motive-1", nombre: "Cliente no responde", descripcion: "Cliente no responde" }];
            }

            const queryData = { data };

            return {
                data: select ? select(queryData) : queryData,
                isLoading: false,
                isFetching: false,
                refetch: vi.fn(),
            };
        }

        return {
            data: [],
            isLoading: false,
            isFetching: false,
            refetch: vi.fn(),
        };
    }),
}));

vi.mock("@/hooks/useGeneralMutation", () => ({
    default: vi.fn(() => ({
        mutate: mocks.closeMutate,
        isPending: mocks.closePending,
    })),
}));

vi.mock("react-redux", () => ({
    useDispatch: () => mocks.dispatch,
}));

vi.mock("react-router-dom", () => ({
    useNavigate: () => mocks.navigate,
    useLocation: () => mocks.location,
}));

vi.mock("@/pages/Interactions/hooks/useInteractionEmail", () => ({
    useInteractionEmail: vi.fn(() => ({
        email: {
            sender: "cliente@demo.com",
            attachments: [],
        },
        isLoading: false,
    })),
}));

vi.mock("@/hooks/useUserInformation", () => ({
    default: vi.fn(() => ({
        user: mocks.user,
        permissionsAdmin: mocks.permissionsAdmin,
        permissionsAgent: mocks.permissionsAgent,
        active_group_id: mocks.activeGroupId,
    })),
}));

vi.mock("@/hooks/useConfigAgentData", () => ({
    default: vi.fn(() => mocks.configAgent),
}));

vi.mock("../../context/AgentContext", () => ({
    useAgentContext: () => mocks.agentContext,
}));

vi.mock("./utils/openCaseAction", () => ({
    createCaseAction: (args) => mocks.createCaseAction(args),
    openCaseAction: (args) => mocks.openCaseAction(args),
}));

vi.mock("./cases/hooks/useLinkedInteractionCases", () => ({
    useLinkedInteractionCases: vi.fn(() => ({
        items: mocks.linkedCases,
        caseIds: mocks.linkedCaseIds,
        refetch: mocks.linkedCasesRefetch,
    })),
}));

vi.mock("./cases/AssociateInteractionCaseModal", () => ({
    default: ({ open, onAssociated, canCreateCase }) =>
        open ? (
            <button
                type="button"
                data-testid="associate-modal"
                data-can-create-case={String(canCreateCase)}
                onClick={() => onAssociated?.("case-1")}
            >
                modal open
            </button>
        ) : null,
}));

vi.mock("./client/suggestedInteractionClients", () => ({
    searchSuggestedClientsByEmail: (...args) => mocks.searchSuggestedClientsByEmail(...args),
}));

vi.mock("./client/SuggestedInteractionClientModal", () => ({
    default: ({ open, senderEmail, clients, onConfirm, onOpenChange, hasCurrentClient }) =>
        open ? (
            <div
                data-testid="suggested-client-modal"
                data-sender-email={senderEmail}
                data-has-current-client={String(hasCurrentClient)}
            >
                <span>{clients[0]?.nombres}</span>
                <button type="button" onClick={() => onConfirm?.(clients[0])}>
                    confirm suggested client
                </button>
                <button type="button" onClick={() => onOpenChange?.(false)}>
                    dismiss suggested client
                </button>
            </div>
        ) : null,
}));

vi.mock("./client/PreserveSelectedClientModal", () => ({
    default: ({ open, senderEmail, onConfirm, onReject }) =>
        open ? (
            <div data-testid="preserve-selected-client-modal" data-sender-email={senderEmail}>
                <button type="button" onClick={onConfirm}>
                    keep selected client
                </button>
                <button type="button" onClick={onReject}>
                    discard selected client
                </button>
            </div>
        ) : null,
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key, options) => {
            const translations = {
                "interactions.title.list": "Interacciones",
                "interactions.list.date": "Fecha",
                "interactions.list.subject": "Asunto",
                "interactions.detail.selectInteraction": "Seleccione una interacción",
                "interactions.detail.received": "Recibido",
                "interactions.detail.reviewed": "Revisado",
                "interactions.detail.notReviewed": "Sin revisar",
                "interactions.detail.from": "De",
                "interactions.detail.priority": "Prioridad",
                "interactions.detail.normal": "Normal",
                "interactions.detail.viewEmail": "Ver correo",
                "interactions.detail.downloadEmail": "Download email",
                "interactions.detail.downloadEmailError": "No se pudo descargar el correo",
                "interactions.detail.release": "Gestionar",
                "interactions.detail.close": "Cerrar",
                "interactions.detail.modal.manage": "Gestionar",
                "interactions.detail.modal.release": "Liberar",
                "interactions.detail.actions.cancel": "Cancelar",
                "interactions.detail.actions.close": "Cerrar interacción",
                "interactions.detail.actions.closeDescription": "Confirma el cierre de esta interacción.",
                "interactions.detail.actions.closeMotive": "Motivo de cierre",
                "interactions.detail.actions.closeNotice":
                    "La interacción quedará marcada como Cerrada y saldrá del flujo activo.",
                "interactions.detail.actions.closeTitle": "Cerrar interacción",
                "interactions.detail.actions.motivePlaceholder": "Selecciona un motivo",
                "interactions.bulk.loadingOptions": "Cargando opciones...",
                "interactions.bulk.motiveModal.closeSending": "Cerrando...",
                "interactions.detail.underReview": "En gestión",
                "interactions.client.manage": "Gestionar cliente",
                "interactions.review.claimSuccess": "Interacción reclamada",
                "interactions.review.releaseSuccess": "Interacción liberada",
                "interactions.review.conflict": "Conflicto",
                "interactions.review.manageForbidden": "Sin permiso",
                "interactions.review.forbidden": "Sin permiso",
                "interactions.review.tooltipNoPermission": "Sin permiso",
                "interactions.review.tooltipReviewer": `En revisión por ${options?.reviewer}`,
                "interactions.review.tooltipOther": "En revisión por otro usuario",
                "interactions.pagination.pageOf": `Página ${options?.page} de ${options?.totalPages}`,
                "interactions.pagination.total": `${options?.totalRecords} interacciones`,
                "interactions.cases.associateCase": "Associate Case",
                "interactions.cases.selectClientFirst": "Select or create a Client before associating a Case",
                "interactions.cases.associateSuccess": "Case associated to interaction",
                "interactions.cases.linkedCases": "Linked Cases",
                "interactions.cases.viewCase": "View Case",
                "interactions.cases.noLinkedCases": "No linked Cases yet",
                "interactions.cases.subcase": "Subcase",
                "button.newCase": "Create Case",
                "button.previous": "Anterior",
                "button.next": "Siguiente",
            };

            return translations[key] ?? options?.defaultValue ?? key;
        },
    }),
}));

vi.mock("./InteractionsWorkspaceTabs", () => ({
    default: vi.fn(({ onAvailabilityResolved }) => {
        useEffect(() => {
            onAvailabilityResolved?.({ activeGroupId: mocks.activeGroupId, workspaceIds: ["workspace-2"] });
        }, [onAvailabilityResolved]);

        return <div data-testid="workspace-tabs" />;
    }),
}));

vi.mock("./InteractionsFilters", () => ({
    default: vi.fn(({ selectedType, onTypeChange, myReviewsOnly, onSearchChange }) => (
        <div
            data-testid="interactions-filters"
            data-selected-type={selectedType}
            data-my-reviews-only={String(myReviewsOnly)}
        >
            <button type="button" onClick={() => onTypeChange("closed")}>
                filter closed
            </button>
            <button type="button" onClick={() => onSearchChange("pagos")}>
                search pagos
            </button>
        </div>
    )),
    MyReviewsFilter: vi.fn(({ myReviewsOnly, onMyReviewsOnlyChange, className }) => (
        <button
            type="button"
            className={className}
            data-my-reviews-only={String(myReviewsOnly)}
            onClick={() => onMyReviewsOnlyChange(!myReviewsOnly)}
        >
            toggle my reviews
        </button>
    )),
}));

vi.mock("./workSpace/InteractionWorkspaceMove", () => ({
    default: vi.fn(() => <div data-testid="workspace-move" />),
}));

vi.mock("./client/InteractionsClientBox", () => ({
    default: vi.fn(({ isSearchingSuggestedClient }) => (
        <div data-testid="client-box" data-searching-suggested-client={String(isSearchingSuggestedClient)}>
            {isSearchingSuggestedClient ? "searching suggested client" : null}
        </div>
    )),
}));

vi.mock("@/components/ui-shared", () => ({
    Button: ({ children, ...props }) => <button {...props}>{children}</button>,
    Badge: ({ children, ...props }) => <span {...props}>{children}</span>,
    GeneralLoader: () => <div data-testid="general-loader" />,
}));

vi.mock("sonner", () => ({
    toast: {
        error: vi.fn(),
        info: vi.fn(),
        success: vi.fn(),
    },
}));

const renderHandler = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    });
    const renderUi = () => (
        <QueryClientProvider client={queryClient}>
            <InteractionsHandler />
        </QueryClientProvider>
    );
    const result = render(renderUi());

    return {
        ...result,
        queryClient,
        rerenderHandler: () => result.rerender(renderUi()),
    };
};

const getInteractionsSearchCall = () =>
    [...useGenericSearchQuery.mock.calls].reverse().find(([args]) => args.url === "/interactions/agent/search")?.[0];

const getLinkedCasesCallForInteraction = (interactionId) =>
    [...useLinkedInteractionCases.mock.calls].reverse().find(([calledInteractionId]) => {
        if (calledInteractionId === undefined || calledInteractionId === null) return false;

        return String(calledInteractionId) === String(interactionId);
    });

const getLastReplaceNavigationSearchParams = () => {
    const [navigation] =
        [...mocks.navigate.mock.calls].reverse().find(([, options]) => options?.replace === true) ?? [];

    return new URLSearchParams(navigation?.search ?? "");
};

describe("Agent InteractionsHandler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.interactionsData = [mocks.baseInteraction];
        mocks.totalInteractions = 1;
        mocks.closePending = false;
        mocks.dispatch.mockClear();
        mocks.navigate.mockClear();
        mocks.clearSelectedClient.mockClear();
        mocks.createCaseAction.mockClear();
        mocks.openCaseAction.mockClear();
        mocks.user = { id: "current-user" };
        mocks.activeGroupId = "group-1";
        mocks.permissionsAdmin = [];
        mocks.permissionsAgent = [{ module_id: "interactions", name: "InteractionsCreate", granted: true }];
        mocks.configAgent = {
            cases: {
                case_enable_subcases: true,
            },
        };
        mocks.agentContext = {
            clientId: "",
            dataUserSelected: {},
            isNewClient: true,
            clearSelectedClient: mocks.clearSelectedClient,
        };
        mocks.linkedCases = [];
        mocks.linkedCaseIds = [];
        mocks.linkedCasesRefetch.mockReset();
        mocks.linkedCasesRefetch.mockResolvedValue({ data: { items: [], caseIds: [] } });
        mocks.refetch.mockResolvedValue({ data: mocks.interactionsData });
        mocks.searchSuggestedClientsByEmail.mockReset();
        mocks.searchSuggestedClientsByEmail.mockResolvedValue({ senderEmail: "cliente@demo.com", clients: [] });
        mocks.location = {
            pathname: "/agent",
            search: "",
        };
        useInteractionEmail.mockReturnValue({
            email: {
                sender: "cliente@demo.com",
                attachments: [],
            },
            isLoading: false,
        });
        mocks.closeMutate.mockImplementation((payload) => apiService.post(payload.url, payload.dataPost));
        apiService.post.mockImplementation((url) => {
            if (url === "/interactions-bulk/agent/close") {
                return Promise.resolve({ data: { updated: 1 } });
            }

            if (url === "/interactions/agent/interaction-1/review/claim") {
                const updatedInteraction = {
                    ...mocks.baseInteraction,
                    in_review: true,
                    start_review_by: "current-user",
                };
                mocks.interactionsData = [updatedInteraction];
                mocks.refetch.mockResolvedValue({ data: mocks.interactionsData });

                return Promise.resolve({ data: { data: updatedInteraction } });
            }

            if (url === "/interactions/agent/interaction-1/review/release") {
                const updatedInteraction = {
                    ...mocks.baseInteraction,
                    in_review: false,
                    start_review_by: null,
                };
                mocks.interactionsData = [updatedInteraction];
                mocks.refetch.mockResolvedValue({ data: mocks.interactionsData });

                return Promise.resolve({ data: { data: updatedInteraction } });
            }

            return Promise.resolve({ data: {} });
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("requests the first Open interactions page from the server by default", () => {
        renderHandler();

        expect(getInteractionsSearchCall()).toEqual(
            expect.objectContaining({
                filter: expect.arrayContaining([
                    expect.objectContaining({
                        field: "in_review",
                        operator: "eq",
                        value: "false",
                    }),
                    expect.objectContaining({
                        field: "is_closed",
                        operator: "eq",
                        value: "false",
                    }),
                ]),
                pagination: {
                    limit: 25,
                    offset: 0,
                },
            }),
        );
        expect(InteractionsFilters.mock.calls.at(-1)?.[0]).toEqual(
            expect.objectContaining({
                selectedType: "open",
                myReviewsOnly: false,
            }),
        );
    });

    it("places the review-only checkbox directly next to the workspace selector", () => {
        renderHandler();

        const workspaceSelector = screen.getByTestId("workspace-tabs");
        const reviewFilter = screen.getByRole("button", { name: "toggle my reviews" });

        expect(workspaceSelector.parentElement).toBe(reviewFilter.parentElement);
        expect(workspaceSelector.parentElement).toHaveClass("items-start", "lg:flex-row", "lg:items-center");
    });

    it("uses an AND search group with OR text fields for interaction search", async () => {
        const user = userEvent.setup();
        renderHandler();

        await user.click(screen.getByRole("button", { name: "search pagos" }));

        await waitFor(() => {
            expect(getInteractionsSearchCall()).toEqual(
                expect.objectContaining({
                    filter: expect.arrayContaining([
                        expect.objectContaining({
                            groupType: "AND",
                            filters: expect.arrayContaining([
                                expect.objectContaining({
                                    field: "description",
                                    operator: "ilike",
                                    value: "pagos",
                                    type: "OR",
                                }),
                                expect.objectContaining({
                                    field: "client_identifier",
                                    operator: "ilike",
                                    value: "pagos",
                                    type: "OR",
                                }),
                            ]),
                        }),
                    ]),
                }),
            );
        });
    });

    it("filters Closed interactions when the agent switches the status selector to Closed", async () => {
        const user = userEvent.setup();
        renderHandler();

        await user.click(screen.getByRole("button", { name: "filter closed" }));

        await waitFor(() => {
            expect(getInteractionsSearchCall()).toEqual(
                expect.objectContaining({
                    filter: expect.arrayContaining([
                        expect.objectContaining({
                            field: "is_closed",
                            operator: "eq",
                            value: "true",
                        }),
                    ]),
                }),
            );
        });
    });

    it("overrides the preserved status with reviews owned by the current agent and restores it when cleared", async () => {
        const user = userEvent.setup();
        mocks.location.search = "?all_workspaces=true&type=closed&page=1";

        renderHandler();

        await user.click(screen.getByRole("button", { name: "toggle my reviews" }));

        await waitFor(() => {
            expect(getInteractionsSearchCall()).toEqual(
                expect.objectContaining({
                    enabled: true,
                    filter: expect.arrayContaining([
                        expect.objectContaining({ field: "in_review", operator: "eq", value: "true" }),
                        expect.objectContaining({ field: "is_closed", operator: "eq", value: "false" }),
                        expect.objectContaining({
                            field: "start_review_by",
                            operator: "eq",
                            value: "current-user",
                        }),
                    ]),
                }),
            );
        });
        expect(InteractionsFilters.mock.calls.at(-1)?.[0]).toEqual(
            expect.objectContaining({
                selectedType: "closed",
                myReviewsOnly: true,
            }),
        );

        let params = getLastReplaceNavigationSearchParams();
        expect(params.get("type")).toBe("closed");
        expect(params.get("my_reviews")).toBe("true");

        await user.click(screen.getByRole("button", { name: "toggle my reviews" }));

        await waitFor(() => {
            expect(getInteractionsSearchCall()).toEqual(
                expect.objectContaining({
                    filter: expect.arrayContaining([
                        expect.objectContaining({ field: "is_closed", operator: "eq", value: "true" }),
                    ]),
                }),
            );
        });
        expect(getInteractionsSearchCall().filter).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ field: "start_review_by" })]),
        );
        expect(InteractionsFilters.mock.calls.at(-1)?.[0]).toEqual(
            expect.objectContaining({
                selectedType: "closed",
                myReviewsOnly: false,
            }),
        );

        params = getLastReplaceNavigationSearchParams();
        expect(params.get("type")).toBe("closed");
        expect(params.has("my_reviews")).toBe(false);
    });

    it("preserves a review-only deep-link selection while waiting for the current user ID", async () => {
        mocks.location.search =
            "?all_workspaces=true&type=open&my_reviews=true&page=1&interaction_id=interaction-1&suggested_client_dismissed=true&client_panel=open";
        mocks.user = {};
        const view = renderHandler();

        expect(getInteractionsSearchCall()).toEqual(
            expect.objectContaining({
                enabled: false,
            }),
        );
        expect(getInteractionsSearchCall().filter).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ field: "start_review_by" })]),
        );
        expect(mocks.navigate).not.toHaveBeenCalled();

        mocks.user = { id: "loaded-user" };
        view.rerenderHandler();

        await waitFor(() => {
            expect(getInteractionsSearchCall()).toEqual(
                expect.objectContaining({
                    enabled: true,
                    filter: expect.arrayContaining([
                        expect.objectContaining({
                            field: "start_review_by",
                            operator: "eq",
                            value: "loaded-user",
                        }),
                    ]),
                }),
            );
        });
        expect(await screen.findByText("RE: Solicitud agente")).toBeInTheDocument();
        expect(screen.getByTestId("client-box")).toBeInTheDocument();
        expect(mocks.navigate).not.toHaveBeenCalled();
    });

    it("loads a review-only deep link without a selection after the current user ID resolves", async () => {
        mocks.location.search = "?all_workspaces=true&my_reviews=true&page=1";
        mocks.user = {};
        const view = renderHandler();

        expect(getInteractionsSearchCall()).toEqual(
            expect.objectContaining({
                enabled: false,
            }),
        );
        expect(getInteractionsSearchCall().filter).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ field: "start_review_by" })]),
        );
        expect(screen.queryByText("Solicitud agente")).not.toBeInTheDocument();
        expect(mocks.navigate).not.toHaveBeenCalled();

        mocks.user = { id: "loaded-user" };
        view.rerenderHandler();

        await waitFor(() => {
            expect(getInteractionsSearchCall()).toEqual(
                expect.objectContaining({
                    enabled: true,
                    filter: expect.arrayContaining([
                        expect.objectContaining({ field: "in_review", operator: "eq", value: "true" }),
                        expect.objectContaining({ field: "is_closed", operator: "eq", value: "false" }),
                        expect.objectContaining({
                            field: "start_review_by",
                            operator: "eq",
                            value: "loaded-user",
                        }),
                    ]),
                }),
            );
        });
        expect(await screen.findByText("Solicitud agente")).toBeInTheDocument();
        expect(mocks.navigate).not.toHaveBeenCalled();
    });

    it.each(["", "all", "under_review", "unexpected"])(
        "normalizes the legacy or invalid %s type to Open",
        async (type) => {
            mocks.location.search = `?all_workspaces=true&type=${type}&page=1`;

            renderHandler();

            expect(InteractionsFilters.mock.calls.at(-1)?.[0]).toEqual(
                expect.objectContaining({
                    selectedType: "open",
                }),
            );
            expect(getInteractionsSearchCall()).toEqual(
                expect.objectContaining({
                    filter: expect.arrayContaining([
                        expect.objectContaining({ field: "in_review", operator: "eq", value: "false" }),
                        expect.objectContaining({ field: "is_closed", operator: "eq", value: "false" }),
                    ]),
                }),
            );

            await waitFor(() => {
                expect(getLastReplaceNavigationSearchParams().get("type")).toBe("open");
            });
        },
    );

    it("requests the next interactions page from the server pagination controls", async () => {
        const user = userEvent.setup();
        mocks.totalInteractions = 60;

        renderHandler();

        expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Siguiente" }));

        await waitFor(() => {
            expect(getInteractionsSearchCall()).toEqual(
                expect.objectContaining({
                    pagination: {
                        limit: 25,
                        offset: 25,
                    },
                }),
            );
        });
        expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();
    });

    it("restores the interaction search context and selected interaction from the URL", async () => {
        mocks.location.search =
            "?workspace_id=workspace-2&all_workspaces=false&type=open&search=pagos&page=2&interaction_id=interaction-2";
        mocks.totalInteractions = 60;
        mocks.interactionsData = [
            {
                ...mocks.baseInteraction,
                id: "interaction-2",
                email_id: "email-2",
                description: "Solicitud restaurada",
                workspace_id: "workspace-2",
            },
        ];

        renderHandler();

        expect(getInteractionsSearchCall()).toEqual(
            expect.objectContaining({
                pagination: {
                    limit: 25,
                    offset: 25,
                },
                filter: expect.arrayContaining([
                    expect.objectContaining({
                        field: "workspace_id",
                        operator: "eq",
                        value: "workspace-2",
                    }),
                    expect.objectContaining({
                        field: "in_review",
                        operator: "eq",
                        value: "false",
                    }),
                    expect.objectContaining({
                        field: "is_closed",
                        operator: "eq",
                        value: "false",
                    }),
                    expect.objectContaining({
                        groupType: "AND",
                        filters: expect.arrayContaining([
                            expect.objectContaining({ field: "description", value: "pagos" }),
                        ]),
                    }),
                ]),
            }),
        );
        expect(await screen.findByText("RE: Solicitud restaurada")).toBeInTheDocument();
    });

    it("normalizes a canonical Inbox workspace deep link to the all-workspaces scope", async () => {
        mocks.location.search = `?workspace_id=${SYSTEM_INBOX_WORKSPACE_ID}&all_workspaces=false&type=pending&search=pagos&page=2&interaction_id=interaction-1&client_panel=open`;

        renderHandler();

        await waitFor(() => {
            expect(mocks.navigate).toHaveBeenCalledWith(expect.objectContaining({ pathname: "/agent" }), {
                replace: true,
            });
        });

        const params = getLastReplaceNavigationSearchParams();
        expect(params.get("all_workspaces")).toBe("true");
        expect(params.has("workspace_id")).toBe(false);
        expect(params.get("type")).toBe("open");
        expect(params.get("search")).toBe("pagos");
        expect(params.get("page")).toBe("1");
        expect(params.has("interaction_id")).toBe(false);
        expect(params.has("client_panel")).toBe(false);
        expect(InteractionsWorkspaceSelect.mock.calls.at(-1)?.[0]).toEqual(
            expect.objectContaining({
                allWorkspaces: true,
                selectedWorkspace: null,
            }),
        );
    });

    it("silently normalizes an unavailable workspace to scoped All and clears interaction/client URL context", async () => {
        mocks.location = {
            pathname: "/agent/client-1",
            search: "?workspace_id=workspace-hidden&all_workspaces=false&type=open&page=2&interaction_id=interaction-1&suggested_client_dismissed=true&client_panel=open",
        };
        mocks.agentContext = {
            clientId: "client-1",
            dataUserSelected: {},
            isNewClient: false,
            clearSelectedClient: mocks.clearSelectedClient,
        };

        renderHandler();

        await waitFor(() => {
            expect(mocks.navigate).toHaveBeenCalledWith(expect.objectContaining({ pathname: "/agent" }), {
                replace: true,
            });
        });
        const params = getLastReplaceNavigationSearchParams();
        expect(params.get("all_workspaces")).toBe("true");
        expect(params.get("page")).toBe("1");
        expect(params.has("workspace_id")).toBe(false);
        expect(params.has("interaction_id")).toBe(false);
        expect(params.has("suggested_client_dismissed")).toBe(false);
        expect(params.has("client_panel")).toBe(false);
        expect(mocks.clearSelectedClient).toHaveBeenCalled();
    });

    it("returns no interaction results while there is no valid active group", () => {
        mocks.activeGroupId = null;

        renderHandler();

        expect(getInteractionsSearchCall()).toEqual(
            expect.objectContaining({
                enabled: false,
                keyQuery: expect.arrayContaining(["agent-interactions", null]),
            }),
        );
        expect(screen.queryByText("Solicitud agente")).not.toBeInTheDocument();
    });

    it("always excludes canonical Inbox interactions from aggregate results", () => {
        renderHandler();

        expect(getInteractionsSearchCall()).toEqual(
            expect.objectContaining({
                filter: expect.arrayContaining([
                    {
                        groupType: "AND",
                        filters: [
                            {
                                field: "workspace_id",
                                operator: "neq",
                                value: SYSTEM_INBOX_WORKSPACE_ID,
                                type: "AND",
                            },
                            {
                                field: "workspace_id",
                                operator: "null",
                                value: "null",
                                type: "OR",
                            },
                        ],
                    },
                ]),
            }),
        );
    });

    it("persists the selected workspace when leaving the all workspaces state", async () => {
        renderHandler();

        await act(async () => {
            InteractionsWorkspaceSelect.mock.calls.at(-1)?.[0].onSelectWorkspace("workspace-2");
        });

        const params = getLastReplaceNavigationSearchParams();
        expect(params.get("all_workspaces")).toBe("false");
        expect(params.get("workspace_id")).toBe("workspace-2");
        expect(InteractionsWorkspaceSelect.mock.calls.at(-1)?.[0]).toEqual(
            expect.objectContaining({
                allWorkspaces: false,
                selectedWorkspace: "workspace-2",
            }),
        );
    });

    it("keeps restored filters but clears a restored interaction that is no longer in the result page", async () => {
        mocks.location.search =
            "?all_workspaces=true&type=open&search=pagos&page=2&interaction_id=missing-interaction&suggested_client_dismissed=true";
        mocks.totalInteractions = 60;

        renderHandler();

        await waitFor(() => {
            expect(mocks.navigate).toHaveBeenCalledWith(expect.objectContaining({ pathname: "/agent" }), {
                replace: true,
            });
        });

        const params = getLastReplaceNavigationSearchParams();
        expect(params.get("all_workspaces")).toBe("true");
        expect(params.get("type")).toBe("open");
        expect(params.get("search")).toBe("pagos");
        expect(params.get("page")).toBe("2");
        expect(params.has("interaction_id")).toBe(false);
        expect(params.has("suggested_client_dismissed")).toBe(false);
        expect(screen.getByText("Seleccione una interacción")).toBeInTheDocument();
    });

    it("claims the selected interaction for agent review", async () => {
        const user = userEvent.setup();

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));
        await user.click(screen.getByRole("button", { name: "Gestionar" }));

        await waitFor(() => {
            expect(apiService.post).toHaveBeenCalledWith("/interactions/agent/interaction-1/review/claim", {});
        });
    });

    it("shows the release action after the agent claims the interaction", async () => {
        const user = userEvent.setup();

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));
        await user.click(screen.getByRole("button", { name: "Gestionar" }));

        expect(await screen.findByRole("button", { name: "Liberar" })).toBeEnabled();
        expect(screen.queryByRole("button", { name: "Gestionar" })).not.toBeInTheDocument();
    });

    it("keeps the release action when the post-claim refetch returns stale review data", async () => {
        const user = userEvent.setup();
        const claimedInteraction = {
            ...mocks.baseInteraction,
            in_review: true,
            start_review_by: "current-user",
        };

        mocks.refetch.mockResolvedValue({ data: [mocks.baseInteraction] });
        apiService.post.mockResolvedValueOnce({ data: { data: claimedInteraction } });

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));
        await user.click(screen.getByRole("button", { name: "Gestionar" }));

        await waitFor(() => {
            expect(screen.getByRole("button", { name: "Liberar" })).toBeEnabled();
        });
        expect(screen.queryByRole("button", { name: "Gestionar" })).not.toBeInTheDocument();
    });

    it("shows the create case action only after the current agent claims the interaction", async () => {
        const user = userEvent.setup();
        mocks.permissionsAgent = [
            { module_id: "interactions", name: "InteractionsCreate", granted: true },
            { module_id: "cases", name: "CasesCreate", granted: true },
        ];

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));

        expect(screen.queryByRole("button", { name: "Create Case" })).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Gestionar" }));

        const createCaseButton = await screen.findByRole("button", { name: "Create Case" });

        await user.click(createCaseButton);

        expect(screen.getByTestId("client-box")).toBeInTheDocument();
    });

    it("discovers a Suggested Client after managing the Interaction and presents it on Create Case", async () => {
        const user = userEvent.setup();
        mocks.permissionsAgent = [
            { module_id: "interactions", name: "InteractionsCreate", granted: true },
            { module_id: "cases", name: "CasesCreate", granted: true },
        ];
        mocks.searchSuggestedClientsByEmail.mockResolvedValue({
            senderEmail: "cliente@demo.com",
            clients: [
                {
                    id: "client-from-email",
                    nombres: "Cliente por correo",
                    email: "cliente@demo.com",
                    suggestedClientMatchedFields: [{ key: "email", value: "cliente@demo.com" }],
                },
            ],
        });

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));
        await user.click(screen.getByRole("button", { name: "Gestionar" }));
        await waitFor(() => {
            expect(mocks.searchSuggestedClientsByEmail).toHaveBeenCalledWith("cliente@demo.com");
        });
        expect(screen.queryByTestId("suggested-client-modal")).not.toBeInTheDocument();
        expect(screen.queryByTestId("client-box")).not.toBeInTheDocument();

        await user.click(await screen.findByRole("button", { name: "Create Case" }));

        expect(screen.getByTestId("client-box")).toBeInTheDocument();

        const modal = await screen.findByTestId("suggested-client-modal");
        expect(modal).toHaveAttribute("data-sender-email", "cliente@demo.com");
        expect(screen.getByText("Cliente por correo")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "confirm suggested client" }));

        expect(mocks.navigate).toHaveBeenCalledWith(
            "/agent/client-from-email?all_workspaces=true&type=open&page=1&interaction_id=interaction-1",
        );
        expect(mocks.createCaseAction).not.toHaveBeenCalled();
        expect(mocks.searchSuggestedClientsByEmail).toHaveBeenCalledTimes(1);
    });

    it("shows a right-panel loading state while searching for Suggested Clients", async () => {
        const user = userEvent.setup();
        let resolveSearch;

        mocks.permissionsAgent = [
            { module_id: "interactions", name: "InteractionsCreate", granted: true },
            { module_id: "cases", name: "CasesCreate", granted: true },
        ];
        mocks.searchSuggestedClientsByEmail.mockReturnValue(
            new Promise((resolve) => {
                resolveSearch = resolve;
            }),
        );

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));
        await user.click(screen.getByRole("button", { name: "Gestionar" }));
        await user.click(await screen.findByRole("button", { name: "Create Case" }));

        expect(await screen.findByText("searching suggested client")).toBeInTheDocument();
        expect(screen.getByTestId("client-box")).toHaveAttribute("data-searching-suggested-client", "true");

        await act(async () => {
            resolveSearch({ senderEmail: "cliente@demo.com", clients: [] });
        });

        await waitFor(() => {
            expect(screen.getByTestId("client-box")).toHaveAttribute("data-searching-suggested-client", "false");
        });
    });

    it("keeps background discovery failures silent and retries on Create Case", async () => {
        const user = userEvent.setup();
        let rejectBackgroundSearch;

        mocks.permissionsAgent = [
            { module_id: "interactions", name: "InteractionsCreate", granted: true },
            { module_id: "cases", name: "CasesCreate", granted: true },
        ];
        mocks.searchSuggestedClientsByEmail
            .mockImplementationOnce(
                () =>
                    new Promise((_resolve, reject) => {
                        rejectBackgroundSearch = reject;
                    }),
            )
            .mockRejectedValueOnce(new Error("retry failed"));

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));
        await user.click(screen.getByRole("button", { name: "Gestionar" }));

        await waitFor(() => {
            expect(mocks.searchSuggestedClientsByEmail).toHaveBeenCalledTimes(1);
        });
        await act(async () => {
            rejectBackgroundSearch(new Error("background failed"));
        });

        expect(toast.error).not.toHaveBeenCalled();

        await user.click(await screen.findByRole("button", { name: "Create Case" }));

        await waitFor(() => {
            expect(mocks.searchSuggestedClientsByEmail).toHaveBeenCalledTimes(2);
            expect(toast.error).toHaveBeenCalledWith("Could not search Suggested Clients for this Interaction");
        });
        expect(screen.getByTestId("client-box")).toBeInTheDocument();
    });

    it("asks again for a dismissed Suggested Client when Create Case is retried", async () => {
        const user = userEvent.setup();
        mocks.permissionsAgent = [
            { module_id: "interactions", name: "InteractionsCreate", granted: true },
            { module_id: "cases", name: "CasesCreate", granted: true },
        ];
        mocks.searchSuggestedClientsByEmail.mockResolvedValue({
            senderEmail: "cliente@demo.com",
            clients: [
                {
                    id: "client-from-email",
                    nombres: "Cliente por correo",
                    email: "cliente@demo.com",
                    suggestedClientMatchedFields: [{ key: "email", value: "cliente@demo.com" }],
                },
            ],
        });

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));
        await user.click(screen.getByRole("button", { name: "Gestionar" }));
        const createCaseButton = await screen.findByRole("button", { name: "Create Case" });
        await user.click(createCaseButton);
        await screen.findByTestId("suggested-client-modal");

        await user.click(screen.getByRole("button", { name: "dismiss suggested client" }));
        const params = getLastReplaceNavigationSearchParams();
        expect(params.get("interaction_id")).toBe("interaction-1");
        expect(params.get("suggested_client_dismissed")).toBe("true");
        expect(params.get("client_panel")).toBe("open");

        await user.click(createCaseButton);

        await screen.findByTestId("suggested-client-modal");
        expect(mocks.searchSuggestedClientsByEmail).toHaveBeenCalledTimes(1);

        const retryParams = getLastReplaceNavigationSearchParams();
        expect(retryParams.has("suggested_client_dismissed")).toBe(false);
    });

    it("reopens a dismissed Suggested Client prompt restored from the URL on an explicit Create Case retry", async () => {
        const user = userEvent.setup();
        mocks.location.search =
            "?all_workspaces=true&type=open&page=1&interaction_id=interaction-1&suggested_client_dismissed=true";
        mocks.permissionsAgent = [
            { module_id: "interactions", name: "InteractionsCreate", granted: true },
            { module_id: "cases", name: "CasesCreate", granted: true },
        ];
        mocks.interactionsData = [
            {
                ...mocks.baseInteraction,
                in_review: true,
                start_review_by: "current-user",
            },
        ];
        mocks.searchSuggestedClientsByEmail.mockResolvedValue({
            senderEmail: "cliente@demo.com",
            clients: [
                {
                    id: "client-from-email",
                    nombres: "Cliente por correo",
                    email: "cliente@demo.com",
                },
            ],
        });

        renderHandler();

        await user.click(await screen.findByRole("button", { name: "Create Case" }));

        expect(screen.getByTestId("client-box")).toBeInTheDocument();
        await screen.findByTestId("suggested-client-modal");
        expect(mocks.searchSuggestedClientsByEmail).toHaveBeenCalledWith("cliente@demo.com");

        const params = getLastReplaceNavigationSearchParams();
        expect(params.has("suggested_client_dismissed")).toBe(false);
    });

    it("asks again for a dismissed Suggested Client when Associate Case is retried", async () => {
        const user = userEvent.setup();
        mocks.interactionsData = [
            {
                ...mocks.baseInteraction,
                in_review: true,
                start_review_by: "current-user",
            },
        ];
        mocks.searchSuggestedClientsByEmail.mockResolvedValue({
            senderEmail: "cliente@demo.com",
            clients: [
                {
                    id: "client-from-email",
                    nombres: "Cliente por correo",
                    email: "cliente@demo.com",
                    suggestedClientMatchedFields: [{ key: "email", value: "cliente@demo.com" }],
                },
            ],
        });

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));
        const associateCaseButton = await screen.findByRole("button", { name: "Associate Case" });
        await user.click(associateCaseButton);
        await screen.findByTestId("suggested-client-modal");

        await user.click(screen.getByRole("button", { name: "dismiss suggested client" }));
        await user.click(associateCaseButton);

        await screen.findByTestId("suggested-client-modal");
        expect(mocks.searchSuggestedClientsByEmail).toHaveBeenCalledTimes(1);
    });

    it("asks whether to keep the selected client before creating a case when no Suggested Client matches", async () => {
        const user = userEvent.setup();
        mocks.permissionsAgent = [
            { module_id: "interactions", name: "InteractionsCreate", granted: true },
            { module_id: "cases", name: "CasesCreate", granted: true },
        ];
        mocks.agentContext = {
            clientId: "selected-client-1",
            dataUserSelected: {
                id: "selected-client-1",
                nombres: "Cliente Seleccionado",
            },
            isNewClient: false,
        };

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));
        await user.click(screen.getByRole("button", { name: "Gestionar" }));

        const preserveModal = await screen.findByTestId("preserve-selected-client-modal");
        expect(preserveModal).toHaveAttribute("data-sender-email", "cliente@demo.com");
        expect(mocks.searchSuggestedClientsByEmail).toHaveBeenCalledWith("cliente@demo.com");
        expect(mocks.createCaseAction).not.toHaveBeenCalled();

        await user.click(screen.getByRole("button", { name: "keep selected client" }));
        await user.click(await screen.findByRole("button", { name: "Create Case" }));

        expect(mocks.createCaseAction).toHaveBeenCalledWith({
            dispatch: mocks.dispatch,
            navigate: mocks.navigate,
            clientId: "selected-client-1",
            canCreateSubcases: true,
            interactionId: "interaction-1",
        });
        expect(mocks.searchSuggestedClientsByEmail).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId("client-box")).not.toBeInTheDocument();
    });

    it("shows the sender-matching Suggested Client after changing to a different selected Client", async () => {
        const user = userEvent.setup();
        mocks.permissionsAgent = [
            { module_id: "interactions", name: "InteractionsCreate", granted: true },
            { module_id: "cases", name: "CasesCreate", granted: true },
        ];
        mocks.agentContext = {
            clientId: "client-matching-sender",
            dataUserSelected: {
                id: "client-matching-sender",
                nombres: "Client matching sender",
                email: "cliente@demo.com",
            },
            isNewClient: false,
        };
        mocks.searchSuggestedClientsByEmail.mockResolvedValue({
            senderEmail: "cliente@demo.com",
            clients: [
                {
                    id: "client-matching-sender",
                    nombres: "Client matching sender",
                    email: "cliente@demo.com",
                },
            ],
        });

        const view = renderHandler();

        await user.click(screen.getByText("Solicitud agente"));
        await user.click(screen.getByRole("button", { name: "Gestionar" }));

        await waitFor(() => {
            expect(mocks.searchSuggestedClientsByEmail).toHaveBeenCalledTimes(1);
        });
        expect(screen.queryByTestId("preserve-selected-client-modal")).not.toBeInTheDocument();

        mocks.agentContext = {
            clientId: "selected-client-with-another-email",
            dataUserSelected: {
                id: "selected-client-with-another-email",
                nombres: "Different selected client",
                email: "another@demo.com",
            },
            isNewClient: false,
        };
        view.rerenderHandler();

        const suggestedModal = await screen.findByTestId("suggested-client-modal");
        expect(suggestedModal).toHaveAttribute("data-sender-email", "cliente@demo.com");
        expect(suggestedModal).toHaveAttribute("data-has-current-client", "true");
        expect(screen.getByText("Client matching sender")).toBeInTheDocument();
        expect(screen.queryByTestId("preserve-selected-client-modal")).not.toBeInTheDocument();
        expect(mocks.searchSuggestedClientsByEmail).toHaveBeenCalledTimes(1);
    });

    it("revalidates selected client preservation when the Interaction email loads after the fallback sender", async () => {
        const user = userEvent.setup();
        let interactionEmailResult = {
            email: null,
            isLoading: true,
        };

        mocks.permissionsAgent = [
            { module_id: "interactions", name: "InteractionsCreate", granted: true },
            { module_id: "cases", name: "CasesCreate", granted: true },
        ];
        mocks.agentContext = {
            clientId: "selected-client-1",
            dataUserSelected: {
                id: "selected-client-1",
                nombres: "Cliente Seleccionado",
            },
            isNewClient: false,
            clearSelectedClient: mocks.clearSelectedClient,
        };
        useInteractionEmail.mockImplementation(() => interactionEmailResult);
        mocks.searchSuggestedClientsByEmail.mockImplementation((senderEmail) =>
            Promise.resolve({ senderEmail, clients: [] }),
        );

        const view = renderHandler();

        await user.click(screen.getByText("Solicitud agente"));
        await user.click(screen.getByRole("button", { name: "Gestionar" }));

        await waitFor(() => {
            expect(mocks.searchSuggestedClientsByEmail).toHaveBeenCalledWith("cliente@demo.com");
        });

        interactionEmailResult = {
            email: {
                sender: "sender-real@demo.com",
                attachments: [],
            },
            isLoading: false,
        };
        view.rerenderHandler();

        await waitFor(() => {
            expect(mocks.searchSuggestedClientsByEmail).toHaveBeenCalledWith("sender-real@demo.com");
        });

        const preserveModal = await screen.findByTestId("preserve-selected-client-modal");
        expect(preserveModal).toHaveAttribute("data-sender-email", "sender-real@demo.com");
        expect(mocks.searchSuggestedClientsByEmail).toHaveBeenCalledTimes(2);
    });

    it("clears the selected client and returns to the agent root with interaction context when discarding the selected client", async () => {
        const user = userEvent.setup();
        mocks.permissionsAgent = [
            { module_id: "interactions", name: "InteractionsCreate", granted: true },
            { module_id: "cases", name: "CasesCreate", granted: true },
        ];
        mocks.agentContext = {
            clientId: "selected-client-1",
            dataUserSelected: {
                id: "selected-client-1",
                nombres: "Cliente Seleccionado",
            },
            isNewClient: false,
            clearSelectedClient: mocks.clearSelectedClient,
        };

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));
        await user.click(screen.getByRole("button", { name: "Gestionar" }));

        await screen.findByTestId("preserve-selected-client-modal");
        await user.click(screen.getByRole("button", { name: "discard selected client" }));

        expect(mocks.clearSelectedClient).toHaveBeenCalledTimes(1);
        expect(mocks.navigate).toHaveBeenCalledWith(
            "/agent?all_workspaces=true&type=open&page=1&interaction_id=interaction-1&client_panel=open",
        );
        expect(mocks.createCaseAction).not.toHaveBeenCalled();
    });

    it("disables create and associate case while validating whether the selected client can be kept", async () => {
        const user = userEvent.setup();
        let resolveSearch;
        mocks.permissionsAgent = [
            { module_id: "interactions", name: "InteractionsCreate", granted: true },
            { module_id: "cases", name: "CasesCreate", granted: true },
        ];
        mocks.agentContext = {
            clientId: "selected-client-1",
            dataUserSelected: {
                id: "selected-client-1",
                nombres: "Cliente Seleccionado",
            },
            isNewClient: false,
        };
        mocks.searchSuggestedClientsByEmail.mockReturnValue(
            new Promise((resolve) => {
                resolveSearch = resolve;
            }),
        );

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));
        await user.click(screen.getByRole("button", { name: "Gestionar" }));

        const createCaseButton = await screen.findByRole("button", { name: "Create Case" });
        const associateCaseButton = await screen.findByRole("button", { name: "Associate Case" });

        expect(createCaseButton).toBeDisabled();
        expect(associateCaseButton).toBeDisabled();

        await act(async () => {
            resolveSearch({ senderEmail: "cliente@demo.com", clients: [] });
        });

        await screen.findByTestId("preserve-selected-client-modal");
        expect(createCaseButton).toBeDisabled();
        expect(associateCaseButton).toBeDisabled();

        await user.click(screen.getByRole("button", { name: "keep selected client" }));

        await waitFor(() => {
            expect(createCaseButton).toBeEnabled();
            expect(associateCaseButton).toBeEnabled();
        });
    });

    it("shows linked interaction cases in the interaction detail without opening the client panel", async () => {
        const user = userEvent.setup();
        mocks.linkedCases = [
            {
                id: "case-404",
                reference: 404,
                nivel1: "Transport",
                estadoActual: "Open",
            },
        ];

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));

        const linkedCasesHeading = screen.getByText("Linked Cases");
        const downloadEmailButton = screen.getByRole("button", { name: "Download email" });

        expect(linkedCasesHeading).toBeInTheDocument();
        expect(downloadEmailButton.compareDocumentPosition(linkedCasesHeading)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        expect(screen.getByText("#404")).toBeInTheDocument();
        expect(screen.getByText("Transport")).toBeInTheDocument();
        expect(screen.queryByTestId("client-box")).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /view case #404/i }));

        expect(mocks.openCaseAction).toHaveBeenCalledWith({
            dispatch: mocks.dispatch,
            navigate: mocks.navigate,
            id: "case-404",
            reference: 404,
        });
    });

    it("opens the client panel and shows a hint instead of the header associate modal when no client is selected", async () => {
        const user = userEvent.setup();
        mocks.interactionsData = [
            {
                ...mocks.baseInteraction,
                in_review: true,
                start_review_by: "current-user",
            },
        ];

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));
        await user.click(screen.getByRole("button", { name: "Associate Case" }));

        expect(screen.getByTestId("client-box")).toBeInTheDocument();
        expect(screen.queryByTestId("associate-modal")).not.toBeInTheDocument();
        expect(toast.info).toHaveBeenCalledWith("Select or create a Client before associating a Case");
    });

    it("opens the header associate modal when a client is selected", async () => {
        const user = userEvent.setup();
        mocks.interactionsData = [
            {
                ...mocks.baseInteraction,
                in_review: true,
                start_review_by: "current-user",
            },
        ];
        mocks.agentContext = {
            clientId: "selected-client-1",
            dataUserSelected: {
                id: "selected-client-1",
                nombres: "Cliente Seleccionado",
            },
            isNewClient: false,
        };

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));
        await screen.findByTestId("preserve-selected-client-modal");
        await user.click(screen.getByRole("button", { name: "keep selected client" }));
        await user.click(await screen.findByRole("button", { name: "Associate Case" }));

        expect(screen.getByTestId("associate-modal")).toBeInTheDocument();
        expect(screen.queryByTestId("client-box")).not.toBeInTheDocument();
    });

    it("keeps interaction context and refreshes linked cases after a successful header association", async () => {
        const user = userEvent.setup();
        mocks.interactionsData = [
            {
                ...mocks.baseInteraction,
                in_review: true,
                start_review_by: "current-user",
            },
        ];
        mocks.agentContext = {
            clientId: "selected-client-1",
            dataUserSelected: {
                id: "selected-client-1",
                nombres: "Cliente Seleccionado",
            },
            isNewClient: false,
        };

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));
        await screen.findByTestId("preserve-selected-client-modal");
        await user.click(screen.getByRole("button", { name: "keep selected client" }));
        await user.click(await screen.findByRole("button", { name: "Associate Case" }));
        await user.click(screen.getByTestId("associate-modal"));

        await waitFor(() => {
            expect(mocks.linkedCasesRefetch).toHaveBeenCalled();
        });
        expect(toast.success).toHaveBeenCalledWith("Case associated to interaction");
        expect(screen.queryByTestId("client-box")).not.toBeInTheDocument();
        expect(screen.queryByTestId("associate-modal")).not.toBeInTheDocument();
    });

    it.each([
        ["not reviewed by the current user", { in_review: true, start_review_by: "another-user" }, undefined],
        ["closed", { in_review: true, is_closed: true, start_review_by: "current-user" }, undefined],
        ["missing InteractionsCreate", { in_review: true, start_review_by: "current-user" }, []],
        [
            "InteractionsCreate is granted under the wrong module",
            { in_review: true, start_review_by: "current-user" },
            [{ module_id: "cases", name: "InteractionsCreate", granted: true }],
        ],
    ])("hides the header associate case action when %s", async (_label, interactionOverrides, permissionsAgent) => {
        const user = userEvent.setup();
        mocks.permissionsAgent = permissionsAgent ?? [
            { module_id: "interactions", name: "InteractionsCreate", granted: true },
        ];
        mocks.interactionsData = [
            {
                ...mocks.baseInteraction,
                ...interactionOverrides,
            },
        ];

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));

        expect(screen.queryByRole("button", { name: "Associate Case" })).not.toBeInTheDocument();
    });

    it("does not show the header create case action when CasesCreate is granted under the wrong module", async () => {
        const user = userEvent.setup();
        mocks.permissionsAgent = [
            { module_id: "interactions", name: "InteractionsCreate", granted: true },
            { module_id: "interactions", name: "CasesCreate", granted: true },
        ];
        mocks.interactionsData = [
            {
                ...mocks.baseInteraction,
                in_review: true,
                start_review_by: "current-user",
            },
        ];

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));

        expect(screen.queryByRole("button", { name: "Create Case" })).not.toBeInTheDocument();
    });

    it("does not grant the modal create-case shortcut when CasesCreate is granted under the wrong module", async () => {
        const user = userEvent.setup();
        mocks.permissionsAgent = [
            { module_id: "interactions", name: "InteractionsCreate", granted: true },
            { module_id: "interactions", name: "CasesCreate", granted: true },
        ];
        mocks.agentContext = {
            clientId: "selected-client-1",
            dataUserSelected: {
                id: "selected-client-1",
                nombres: "Cliente Seleccionado",
            },
            isNewClient: false,
        };
        mocks.interactionsData = [
            {
                ...mocks.baseInteraction,
                in_review: true,
                start_review_by: "current-user",
            },
        ];

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));
        await screen.findByTestId("preserve-selected-client-modal");
        await user.click(screen.getByRole("button", { name: "keep selected client" }));
        await user.click(await screen.findByRole("button", { name: "Associate Case" }));

        expect(screen.getByTestId("associate-modal")).toHaveAttribute("data-can-create-case", "false");
    });

    it("disables linked case lookup when linked-case read permissions are granted under wrong modules", async () => {
        const user = userEvent.setup();
        mocks.permissionsAgent = [{ module_id: "cases", name: "InteractionsCreate", granted: true }];
        mocks.permissionsAdmin = [{ module_id: "cases", name: "InteractionsRead", granted: true }];
        mocks.interactionsData = [
            {
                ...mocks.baseInteraction,
                in_review: true,
                start_review_by: "current-user",
            },
        ];

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));

        expect(getLinkedCasesCallForInteraction("interaction-1")).toEqual([
            "interaction-1",
            { enabled: false, activeGroupId: "group-1" },
        ]);
    });

    it("enables linked case lookup for admin interactions read permission", async () => {
        const user = userEvent.setup();
        mocks.permissionsAgent = [];
        mocks.permissionsAdmin = [{ module_id: "interactions", name: "InteractionsRead", granted: true }];
        mocks.interactionsData = [
            {
                ...mocks.baseInteraction,
                in_review: true,
                start_review_by: "current-user",
            },
        ];

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));

        expect(getLinkedCasesCallForInteraction("interaction-1")).toEqual([
            "interaction-1",
            { enabled: true, activeGroupId: "group-1" },
        ]);
    });

    it("downloads the selected source Email ZIP from the interaction detail action", async () => {
        const user = userEvent.setup();
        const open = vi.spyOn(window, "open").mockImplementation(() => null);
        apiService.get.mockResolvedValueOnce({
            data: {
                data: {
                    download_url: "https://signed.example/email-1.zip",
                },
            },
        });

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));
        await user.click(screen.getByRole("button", { name: "Download email" }));

        await waitFor(() => {
            expect(apiService.get).toHaveBeenCalledWith("/emails/email-1/download");
        });
        expect(open).toHaveBeenCalledWith("https://signed.example/email-1.zip", "_blank", "noopener,noreferrer");
    });

    it("closes the selected interaction through the bulk close endpoint with a motive", async () => {
        const user = userEvent.setup();
        mocks.permissionsAdmin = [{ module_id: "interactions", name: "InteractionsBulkClose", granted: true }];

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));
        await user.click(screen.getByRole("button", { name: "Cerrar" }));

        expect(screen.getByRole("heading", { name: "Cerrar interacción" })).toBeInTheDocument();

        await user.selectOptions(screen.getByLabelText("Motivo de cierre"), "Cliente no responde");
        await user.click(screen.getByRole("button", { name: "Cerrar interacción" }));

        await waitFor(() => {
            expect(apiService.post).toHaveBeenCalledWith("/interactions-bulk/agent/close", {
                interaction_ids: ["interaction-1"],
                motive: "Cliente no responde",
            });
        });
        expect(mocks.refetch).toHaveBeenCalled();
        expect(screen.queryByText("Solicitud agente")).not.toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Cerrar interacción" })).not.toBeInTheDocument();

        const params = getLastReplaceNavigationSearchParams();
        expect(params.has("interaction_id")).toBe(false);
        expect(params.has("suggested_client_dismissed")).toBe(false);
        expect(params.has("client_panel")).toBe(false);
    });

    it("preserves the selected interaction and close dialog when the close request fails", async () => {
        const user = userEvent.setup();
        mocks.permissionsAdmin = [{ module_id: "interactions", name: "InteractionsBulkClose", granted: true }];
        mocks.closeMutate.mockRejectedValueOnce(new Error("close failed"));

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));
        await user.click(screen.getByRole("button", { name: "Cerrar" }));
        await user.selectOptions(screen.getByLabelText("Motivo de cierre"), "Cliente no responde");
        mocks.refetch.mockClear();
        const navigationCountBeforeSubmit = mocks.navigate.mock.calls.length;

        await user.click(screen.getByRole("button", { name: "Cerrar interacción" }));

        expect(screen.getByText("Solicitud agente")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Cerrar interacción" })).toBeInTheDocument();
        expect(mocks.refetch).not.toHaveBeenCalled();
        expect(mocks.navigate).toHaveBeenCalledTimes(navigationCountBeforeSubmit);
    });

    it("clamps the page before loading again when close removes the last row on the last page", async () => {
        const user = userEvent.setup();
        mocks.permissionsAdmin = [{ module_id: "interactions", name: "InteractionsBulkClose", granted: true }];
        mocks.totalInteractions = 26;
        mocks.location.search = "?all_workspaces=true&type=open&page=2";

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));
        await user.click(screen.getByRole("button", { name: "Cerrar" }));
        await user.selectOptions(screen.getByLabelText("Motivo de cierre"), "Cliente no responde");
        mocks.refetch.mockClear();
        await user.click(screen.getByRole("button", { name: "Cerrar interacción" }));

        await waitFor(() => {
            expect(getInteractionsSearchCall()?.pagination).toEqual({ limit: 25, offset: 0 });
        });
        expect(getLastReplaceNavigationSearchParams().get("page")).toBe("1");
        expect(screen.queryByText("Solicitud agente")).not.toBeInTheDocument();
        expect(mocks.refetch).not.toHaveBeenCalled();
    });

    it("hides close and move workspace actions when InteractionsUpdate is missing", async () => {
        const user = userEvent.setup();
        mocks.permissionsAdmin = [];

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));

        expect(screen.queryByRole("button", { name: "Cerrar" })).not.toBeInTheDocument();
        expect(InteractionWorkspaceMove.mock.calls.at(-1)?.[0]).toEqual(
            expect.objectContaining({ canMoveWorkspace: false }),
        );
    });

    it("enables move workspace action when InteractionsUpdate is granted", async () => {
        const user = userEvent.setup();
        mocks.permissionsAdmin = [{ module_id: "interactions", name: "InteractionsUpdate", granted: true }];

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));

        expect(screen.queryByRole("button", { name: "Cerrar" })).not.toBeInTheDocument();
        expect(InteractionWorkspaceMove.mock.calls.at(-1)?.[0]).toEqual(
            expect.objectContaining({ canMoveWorkspace: true }),
        );
    });

    it("removes an interaction from Agent list, detail, URL, and source-bound cache after an out-of-group move", async () => {
        const user = userEvent.setup();
        mocks.permissionsAdmin = [{ module_id: "interactions", name: "InteractionsUpdate", granted: true }];
        const { queryClient } = renderHandler();
        const destinationQueryKey = [agentMoveWorkspaceDestinationsKey("current-user", "group-1", "interaction-1")];
        const listQueryKey = [["agent-interactions", "group-1"], [], { limit: 25, offset: 0 }];
        queryClient.setQueryData(destinationQueryKey, [{ id: "workspace-other", description: "Other group" }]);
        queryClient.setQueryData(listQueryKey, { data: [mocks.baseInteraction], total: 1 });

        await user.click(screen.getByText("Solicitud agente"));
        mocks.refetch.mockClear();

        await act(async () => {
            await InteractionWorkspaceMove.mock.calls
                .at(-1)?.[0]
                .onInteractionMoved("interaction-1", "workspace-other");
        });

        expect(screen.queryByText("Solicitud agente")).not.toBeInTheDocument();
        expect(screen.queryByText("RE: Solicitud agente")).not.toBeInTheDocument();
        expect(queryClient.getQueryData(destinationQueryKey)).toBeUndefined();
        expect(queryClient.getQueryState(listQueryKey)?.isInvalidated).toBe(true);
        expect(mocks.refetch).toHaveBeenCalledTimes(1);

        const params = getLastReplaceNavigationSearchParams();
        expect(params.has("interaction_id")).toBe(false);
        expect(params.has("suggested_client_dismissed")).toBe(false);
        expect(params.has("client_panel")).toBe(false);
    });

    it("keeps an in-group moved interaction in All Workspaces while clearing its selected detail", async () => {
        const user = userEvent.setup();
        mocks.permissionsAdmin = [{ module_id: "interactions", name: "InteractionsUpdate", granted: true }];

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));

        await act(async () => {
            await InteractionWorkspaceMove.mock.calls.at(-1)?.[0].onInteractionMoved("interaction-1", "workspace-2");
        });

        expect(screen.getByText("Solicitud agente")).toBeInTheDocument();
        expect(screen.queryByText("RE: Solicitud agente")).not.toBeInTheDocument();
        expect(mocks.refetch).toHaveBeenCalled();
    });

    it("shows close without enabling move workspace when only InteractionsBulkClose is granted", async () => {
        const user = userEvent.setup();
        mocks.permissionsAdmin = [{ module_id: "interactions", name: "InteractionsBulkClose", granted: true }];

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));

        expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
        expect(InteractionWorkspaceMove.mock.calls.at(-1)?.[0]).toEqual(
            expect.objectContaining({ canMoveWorkspace: false }),
        );
    });

    it("does not show the create case action for an interaction reviewed by another user", async () => {
        const user = userEvent.setup();
        mocks.permissionsAgent = [
            { module_id: "interactions", name: "InteractionsCreate", granted: true },
            { module_id: "cases", name: "CasesCreate", granted: true },
        ];
        mocks.interactionsData = [
            {
                ...mocks.baseInteraction,
                in_review: true,
                start_review_by: "another-user",
            },
        ];

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));

        expect(screen.queryByRole("button", { name: "Create Case" })).not.toBeInTheDocument();
    });

    it("keeps a newer selected interaction after a previous review claim refresh resolves", async () => {
        const user = userEvent.setup();
        const secondInteraction = {
            ...mocks.baseInteraction,
            id: "interaction-2",
            description: "Segunda solicitud",
            client_identifier: "segundo@demo.com",
        };
        let resolveClaim;
        let resolveRefetch;
        const claimPromise = new Promise((resolve) => {
            resolveClaim = resolve;
        });
        const refetchPromise = new Promise((resolve) => {
            resolveRefetch = resolve;
        });
        const claimedInteraction = {
            ...mocks.baseInteraction,
            in_review: true,
            start_review_by: "current-user",
        };

        mocks.interactionsData = [mocks.baseInteraction, secondInteraction];
        mocks.refetch.mockReturnValue(refetchPromise);
        apiService.post.mockImplementation((url) => {
            if (url === "/interactions/agent/interaction-1/review/claim") {
                return claimPromise;
            }

            return Promise.resolve({ data: {} });
        });

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));
        await user.click(screen.getByRole("button", { name: "Gestionar" }));
        await user.click(screen.getByText("Segunda solicitud"));

        expect(screen.getByText("RE: Segunda solicitud")).toBeInTheDocument();

        await act(async () => {
            resolveClaim({ data: { data: claimedInteraction } });
        });
        await act(async () => {
            resolveRefetch({ data: [claimedInteraction, secondInteraction] });
        });

        await waitFor(() => {
            expect(screen.getByText("RE: Segunda solicitud")).toBeInTheDocument();
        });
        expect(screen.queryByText("RE: Solicitud agente")).not.toBeInTheDocument();
    });

    it("disables the review action while the close mutation is pending", async () => {
        const user = userEvent.setup();
        mocks.closePending = true;

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));

        expect(screen.getByRole("button", { name: "Gestionar" })).toBeDisabled();
    });

    it("allows releasing a closed interaction that is still locked by the current reviewer", async () => {
        const user = userEvent.setup();
        mocks.interactionsData = [
            {
                ...mocks.baseInteraction,
                in_review: true,
                is_closed: true,
                start_review_by: "current-user",
            },
        ];

        renderHandler();

        await user.click(screen.getByText("Solicitud agente"));
        const releaseButton = screen.getByRole("button", { name: "Liberar" });

        expect(releaseButton).toBeEnabled();

        await user.click(releaseButton);

        await waitFor(() => {
            expect(apiService.post).toHaveBeenCalledWith("/interactions/agent/interaction-1/review/release", {});
        });
    });
});
