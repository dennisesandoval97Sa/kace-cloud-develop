import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { DEFAULT_INTERACTIONS_PAGE_SIZE, useInteractions } from "./hooks/useInteractions";
import { useInteractionEmail } from "@/pages/Interactions/hooks/useInteractionEmail";
import { useInteractionActions } from "./hooks/useInteractionActions";
import { agentMoveWorkspaceDestinationsKey } from "./hooks/useAgentMoveWorkspaceDestinations";
import useInteractionBulkOptions from "@/pages/Interactions/hooks/useInteractionBulkOptions";
import InteractionsWorkspaceSelect from "./InteractionsWorkspaceTabs";
import InteractionsFilters, { MyReviewsFilter } from "./InteractionsFilters";
import InteractionsList from "./InteractionsList";
import InteractionDetail from "./InteractionDetail";
import EmailDetail from "./emails/EmailDetail";
import { GeneralLoader } from "@/components/ui-shared";
import InteractionsClientBox from "./client/InteractionsClientBox";
import AssociateInteractionCaseModal from "./cases/AssociateInteractionCaseModal";
import { useLinkedInteractionCases } from "./cases/hooks/useLinkedInteractionCases";
import { createCaseAction, openCaseAction } from "./utils/openCaseAction";
import { InteractionMotiveDialog } from "@/pages/Interactions/components/InteractionDetailActionDialogs";
import { INTERACTION_TYPE_FILTERS } from "./interactionTypeFilters";
import useUserInformation from "@/hooks/useUserInformation";
import useConfigAgentData from "@/hooks/useConfigAgentData";
import { useAgentContext } from "../../context/AgentContext";
import SuggestedInteractionClientModal from "./client/SuggestedInteractionClientModal";
import PreserveSelectedClientModal from "./client/PreserveSelectedClientModal";
import { searchSuggestedClientsByEmail } from "./client/suggestedInteractionClients";
import { isSystemInboxWorkspaceId } from "@/utils/systemInboxWorkspace";

const isSameInteractionId = (leftId, rightId) =>
    leftId !== null &&
    leftId !== undefined &&
    rightId !== null &&
    rightId !== undefined &&
    String(leftId) === String(rightId);

const hasSameReviewState = (leftInteraction, rightInteraction) =>
    leftInteraction?.in_review === rightInteraction?.in_review &&
    String(leftInteraction?.start_review_by ?? "") === String(rightInteraction?.start_review_by ?? "");

const getReviewerId = (interaction) =>
    interaction?.start_review_by ?? interaction?.reviewer_id ?? interaction?.reviewer?.id ?? null;

const isCurrentPreservationLookup = (interactionIdRef, lookupKeyRef, interactionId, lookupKey) =>
    isSameInteractionId(interactionIdRef.current, interactionId) && lookupKeyRef.current === lookupKey;

const buildSuggestedClientDiscoveryKey = (interactionId, senderEmail) => {
    const normalizedSenderEmail = String(senderEmail ?? "")
        .trim()
        .toLowerCase();

    if (interactionId === null || interactionId === undefined || !normalizedSenderEmail) return "";

    return `${String(interactionId)}|${normalizedSenderEmail}`;
};

const hasPermission = (permissions = [], moduleId, permissionName) =>
    permissions.some(
        (permission) =>
            permission?.module_id === moduleId && permission?.name === permissionName && permission?.granted === true,
    );

const INTERACTION_SEARCH_QUERY_PARAMS = {
    workspaceId: "workspace_id",
    allWorkspaces: "all_workspaces",
    type: "type",
    myReviewsOnly: "my_reviews",
    search: "search",
    page: "page",
    interactionId: "interaction_id",
    suggestedClientDismissed: "suggested_client_dismissed",
    clientPanel: "client_panel",
};

const parsePositivePage = (value) => {
    const parsed = Number(value);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

const normalizeAgentInteractionType = (value) =>
    value === INTERACTION_TYPE_FILTERS.CLOSED ? INTERACTION_TYPE_FILTERS.CLOSED : INTERACTION_TYPE_FILTERS.OPEN;

const parseInteractionSearchContext = (search) => {
    const params = new URLSearchParams(search);
    const requestedType = params.get(INTERACTION_SEARCH_QUERY_PARAMS.type);
    const requestedWorkspaceId = params.get(INTERACTION_SEARCH_QUERY_PARAMS.workspaceId);
    const shouldNormalizeWorkspace = isSystemInboxWorkspaceId(requestedWorkspaceId);
    const allWorkspaces = params.has(INTERACTION_SEARCH_QUERY_PARAMS.allWorkspaces)
        ? params.get(INTERACTION_SEARCH_QUERY_PARAMS.allWorkspaces) !== "false"
        : !requestedWorkspaceId;
    const normalizedAllWorkspaces = shouldNormalizeWorkspace || allWorkspaces;

    return {
        selectedWorkspace: normalizedAllWorkspaces ? null : requestedWorkspaceId,
        allWorkspaces: normalizedAllWorkspaces,
        shouldNormalizeWorkspace,
        selectedType: normalizeAgentInteractionType(requestedType),
        shouldNormalizeType:
            params.has(INTERACTION_SEARCH_QUERY_PARAMS.type) &&
            requestedType !== normalizeAgentInteractionType(requestedType),
        myReviewsOnly: params.get(INTERACTION_SEARCH_QUERY_PARAMS.myReviewsOnly) === "true",
        searchTerm: params.get(INTERACTION_SEARCH_QUERY_PARAMS.search) || "",
        page: shouldNormalizeWorkspace ? 1 : parsePositivePage(params.get(INTERACTION_SEARCH_QUERY_PARAMS.page)),
        selectedInteractionId: shouldNormalizeWorkspace
            ? null
            : params.get(INTERACTION_SEARCH_QUERY_PARAMS.interactionId),
        suggestedClientDismissed:
            !shouldNormalizeWorkspace &&
            params.get(INTERACTION_SEARCH_QUERY_PARAMS.suggestedClientDismissed) === "true",
        clientPanelOpen:
            !shouldNormalizeWorkspace && params.get(INTERACTION_SEARCH_QUERY_PARAMS.clientPanel) === "open",
    };
};

const setSearchParam = (params, key, value) => {
    if (value === null || value === undefined || value === "") {
        params.delete(key);
        return;
    }

    params.set(key, String(value));
};

export const InteractionsHandler = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const initialInteractionSearchContextRef = useRef(null);

    if (!initialInteractionSearchContextRef.current) {
        initialInteractionSearchContextRef.current = parseInteractionSearchContext(location.search);
    }

    const initialInteractionSearchContext = initialInteractionSearchContextRef.current;
    const { user, permissionsAdmin, permissionsAgent, active_group_id: activeGroupId } = useUserInformation();
    const { cases: configCases } = useConfigAgentData();
    const { clientId: selectedClientId, isNewClient, clearSelectedClient = () => {} } = useAgentContext();
    const [selectedWorkspace, setSelectedWorkspace] = useState(initialInteractionSearchContext.selectedWorkspace);
    const [selectedInteraction, setSelectedInteraction] = useState(null);
    const [selectedInteractionIdFromContext, setSelectedInteractionIdFromContext] = useState(
        initialInteractionSearchContext.selectedInteractionId,
    );
    const [selectedType, setSelectedType] = useState(initialInteractionSearchContext.selectedType);
    const [myReviewsOnly, setMyReviewsOnly] = useState(initialInteractionSearchContext.myReviewsOnly);
    const [searchTerm, setSearchTerm] = useState(initialInteractionSearchContext.searchTerm);
    const [page, setPage] = useState(initialInteractionSearchContext.page);
    const [allWorkspaces, setAllWorkspaces] = useState(initialInteractionSearchContext.allWorkspaces);
    const [showEmail, setShowEmail] = useState(false);
    const [openManagerClient, setOpenManagerClient] = useState(initialInteractionSearchContext.clientPanelOpen);
    const [closeDialogOpen, setCloseDialogOpen] = useState(false);
    const [associateCaseModalOpen, setAssociateCaseModalOpen] = useState(false);
    const [suggestedClientModalOpen, setSuggestedClientModalOpen] = useState(false);
    const [suggestedClients, setSuggestedClients] = useState([]);
    const [suggestedClientSenderEmail, setSuggestedClientSenderEmail] = useState("");
    const [dismissedSuggestedClientInteractionId, setDismissedSuggestedClientInteractionId] = useState(
        initialInteractionSearchContext.suggestedClientDismissed
            ? initialInteractionSearchContext.selectedInteractionId
            : null,
    );
    const [preserveSelectedClientModalOpen, setPreserveSelectedClientModalOpen] = useState(false);
    const [preserveSelectedClientSenderEmail, setPreserveSelectedClientSenderEmail] = useState("");
    const [hasCheckedSelectedClientPreservation, setHasCheckedSelectedClientPreservation] = useState(false);
    const [requiresSelectedClientPreservationConfirmation, setRequiresSelectedClientPreservationConfirmation] =
        useState(false);
    const [hasConfirmedSelectedClientPreservation, setHasConfirmedSelectedClientPreservation] = useState(false);
    const [isSearchingSuggestedClient, setIsSearchingSuggestedClient] = useState(false);
    const [isValidatingSelectedClient, setIsValidatingSelectedClient] = useState(false);
    const [availabilityScope, setAvailabilityScope] = useState({
        activeGroupId: null,
        workspaceIds: [],
    });
    const [locallyHiddenInteractionIds, setLocallyHiddenInteractionIds] = useState([]);
    const selectedInteractionIdRef = useRef(null);
    const selectedClientPreservationLookupKeyRef = useRef("");
    const suggestedClientDiscoveryRef = useRef({ key: "", promise: null });
    const hasMountedSearchContextRef = useRef(false);
    const isApplyingSearchContextRef = useRef(false);
    const clientPanelContextRef = useRef({
        open: initialInteractionSearchContext.clientPanelOpen,
        interactionId: initialInteractionSearchContext.selectedInteractionId,
    });
    const activeGroupIdRef = useRef(activeGroupId);
    const selectedInteractionId = selectedInteraction?.id ?? null;
    const hasDismissedSuggestedClientModal = isSameInteractionId(
        dismissedSuggestedClientInteractionId,
        selectedInteractionId,
    );

    const buildInteractionSearch = (updates = {}) => {
        const nextContext = {
            selectedWorkspace,
            allWorkspaces,
            selectedType,
            myReviewsOnly,
            searchTerm,
            page,
            selectedInteractionId,
            suggestedClientDismissed: hasDismissedSuggestedClientModal,
            clientPanelOpen: openManagerClient,
            ...updates,
        };
        const params = new URLSearchParams(location.search);

        setSearchParam(
            params,
            INTERACTION_SEARCH_QUERY_PARAMS.workspaceId,
            nextContext.allWorkspaces ? null : nextContext.selectedWorkspace,
        );
        setSearchParam(params, INTERACTION_SEARCH_QUERY_PARAMS.allWorkspaces, Boolean(nextContext.allWorkspaces));
        setSearchParam(
            params,
            INTERACTION_SEARCH_QUERY_PARAMS.type,
            normalizeAgentInteractionType(nextContext.selectedType),
        );
        setSearchParam(
            params,
            INTERACTION_SEARCH_QUERY_PARAMS.myReviewsOnly,
            nextContext.myReviewsOnly ? "true" : null,
        );
        setSearchParam(params, INTERACTION_SEARCH_QUERY_PARAMS.search, nextContext.searchTerm?.trim() || null);
        setSearchParam(params, INTERACTION_SEARCH_QUERY_PARAMS.page, nextContext.page || 1);
        setSearchParam(params, INTERACTION_SEARCH_QUERY_PARAMS.interactionId, nextContext.selectedInteractionId);
        setSearchParam(
            params,
            INTERACTION_SEARCH_QUERY_PARAMS.suggestedClientDismissed,
            nextContext.suggestedClientDismissed ? "true" : null,
        );
        setSearchParam(
            params,
            INTERACTION_SEARCH_QUERY_PARAMS.clientPanel,
            nextContext.clientPanelOpen ? "open" : null,
        );

        return params.toString();
    };

    const replaceInteractionSearchContext = (updates = {}) => {
        const nextSearch = buildInteractionSearch(updates);

        navigate(
            {
                pathname: location.pathname,
                search: nextSearch ? `?${nextSearch}` : "",
            },
            { replace: true },
        );
    };

    const hasActiveIdentityScope = Boolean(user?.id && activeGroupId);
    const isAvailabilityResolved =
        hasActiveIdentityScope && String(availabilityScope.activeGroupId) === String(activeGroupId);
    const isSelectedWorkspaceAvailable =
        allWorkspaces ||
        (isAvailabilityResolved &&
            availabilityScope.workspaceIds.some((workspaceId) => String(workspaceId) === String(selectedWorkspace)));
    const isInteractionScopeReady = hasActiveIdentityScope && isSelectedWorkspaceAvailable;
    const isReviewIdentityPending = myReviewsOnly && !user?.id;
    const {
        data: interactionsResult = { interactions: [], totalRecords: 0 },
        isLoading,
        isFetching,
        refetch,
    } = useInteractions({
        selectedWorkspace,
        allWorkspaces,
        selectedType,
        myReviewsOnly,
        currentUserId: user?.id,
        activeGroupId,
        scopeReady: isInteractionScopeReady,
        searchTerm,
        page,
        pageSize: DEFAULT_INTERACTIONS_PAGE_SIZE,
    });
    const interactions = interactionsResult?.interactions ?? [];
    const totalRecords = interactionsResult?.totalRecords ?? interactions.length;
    const locallyHiddenInteractionCount = interactions.filter((interaction) =>
        locallyHiddenInteractionIds.some((interactionId) => isSameInteractionId(interaction.id, interactionId)),
    ).length;
    const visibleInteractions = interactions.filter(
        (interaction) =>
            !locallyHiddenInteractionIds.some((interactionId) => isSameInteractionId(interaction.id, interactionId)),
    );
    const visibleTotalRecords = Math.max(0, totalRecords - locallyHiddenInteractionCount);
    const totalPages = Math.max(1, Math.ceil(visibleTotalRecords / DEFAULT_INTERACTIONS_PAGE_SIZE));

    useEffect(() => {
        if (isFetching || locallyHiddenInteractionIds.length === 0) return;

        setLocallyHiddenInteractionIds((currentIds) => {
            const remainingIds = currentIds.filter((interactionId) =>
                interactions.some((interaction) => isSameInteractionId(interaction.id, interactionId)),
            );

            return remainingIds.length === currentIds.length ? currentIds : remainingIds;
        });
    }, [interactions, isFetching, locallyHiddenInteractionIds.length]);

    useEffect(() => {
        setLocallyHiddenInteractionIds((currentIds) => (currentIds.length === 0 ? currentIds : []));
    }, [activeGroupId, selectedWorkspace, allWorkspaces, selectedType, myReviewsOnly, searchTerm]);

    const { email, isLoading: loadingEmail } = useInteractionEmail(selectedInteraction?.email_id);

    const { closeInteraction, isUpdatingInteractions } = useInteractionActions(selectedInteraction?.id, activeGroupId);
    const { motiveOptions, isLoadingMotiveOptions } = useInteractionBulkOptions();
    const selectedRouteClientId = !isNewClient && selectedClientId ? selectedClientId : null;
    const selectedInteractionSenderEmail = email?.sender ?? selectedInteraction?.client_identifier ?? "";
    const reviewerId = getReviewerId(selectedInteraction);
    const isCurrentReviewer = Boolean(user?.id && reviewerId && String(user.id) === String(reviewerId));
    const hasAgentPermission = (moduleId, permissionName) => hasPermission(permissionsAgent, moduleId, permissionName);
    const canUpdateInteraction = hasPermission(permissionsAdmin, "interactions", "InteractionsUpdate");
    const canBulkCloseInteraction = hasPermission(permissionsAdmin, "interactions", "InteractionsBulkClose");
    const canReadLinkedCases =
        hasActiveIdentityScope &&
        selectedInteraction?.id &&
        (hasPermission(permissionsAdmin, "interactions", "InteractionsRead") ||
            hasAgentPermission("interactions", "InteractionsCreate"));
    const linkedCasesQuery = useLinkedInteractionCases(selectedInteraction?.id, {
        enabled: canReadLinkedCases && hasActiveIdentityScope,
        activeGroupId,
    });
    const canAssociateCase =
        hasActiveIdentityScope &&
        selectedInteraction?.id &&
        selectedInteraction?.in_review &&
        isCurrentReviewer &&
        !selectedInteraction?.is_closed &&
        hasAgentPermission("interactions", "InteractionsCreate");
    const canCreateCase = hasAgentPermission("cases", "CasesCreate");
    const canCloseInteraction = Boolean(hasActiveIdentityScope && selectedInteraction?.id && canBulkCloseInteraction);
    const canMoveWorkspace = Boolean(hasActiveIdentityScope && selectedInteraction?.id && canUpdateInteraction);
    const showClientManager = Boolean(selectedInteraction && openManagerClient);
    const detailColumnClassName = showClientManager ? "min-w-0 xl:col-span-4" : "min-w-0 xl:col-span-7";
    const shouldCheckSelectedClientPreservation =
        selectedRouteClientId &&
        selectedInteraction?.id &&
        selectedInteraction?.in_review &&
        isCurrentReviewer &&
        Boolean(selectedInteractionSenderEmail);
    const selectedClientPreservationLookupKey = shouldCheckSelectedClientPreservation
        ? [selectedRouteClientId, selectedInteraction.id, selectedInteractionSenderEmail].join("|")
        : "";
    const shouldDiscoverSuggestedClients =
        selectedInteraction?.id &&
        selectedInteraction?.in_review &&
        isCurrentReviewer &&
        Boolean(selectedInteractionSenderEmail);
    const discoverSuggestedClients = useCallback((interactionId, senderEmail) => {
        const discoveryKey = buildSuggestedClientDiscoveryKey(interactionId, senderEmail);

        if (!discoveryKey) {
            return Promise.resolve({ senderEmail: "", clients: [] });
        }

        const currentDiscovery = suggestedClientDiscoveryRef.current;

        if (currentDiscovery.key === discoveryKey && currentDiscovery.promise) {
            return currentDiscovery.promise;
        }

        const promise = searchSuggestedClientsByEmail(senderEmail).catch((error) => {
            if (suggestedClientDiscoveryRef.current.promise === promise) {
                suggestedClientDiscoveryRef.current = { key: "", promise: null };
            }

            throw error;
        });

        suggestedClientDiscoveryRef.current = { key: discoveryKey, promise };

        return promise;
    }, []);

    useEffect(() => {
        const shouldRestoreClientPanel =
            clientPanelContextRef.current.open &&
            isSameInteractionId(clientPanelContextRef.current.interactionId, selectedInteractionId);

        setOpenManagerClient(shouldRestoreClientPanel);
        setCloseDialogOpen(false);
        setAssociateCaseModalOpen(false);
    }, [selectedInteractionId]);

    useEffect(() => {
        selectedInteractionIdRef.current = selectedInteractionId;
        setSuggestedClientModalOpen(false);
        setSuggestedClients([]);
        setSuggestedClientSenderEmail("");
        setPreserveSelectedClientModalOpen(false);
        setPreserveSelectedClientSenderEmail("");
        setHasCheckedSelectedClientPreservation(false);
        setRequiresSelectedClientPreservationConfirmation(false);
        setHasConfirmedSelectedClientPreservation(false);
        selectedClientPreservationLookupKeyRef.current = "";
        suggestedClientDiscoveryRef.current = { key: "", promise: null };
        setIsSearchingSuggestedClient(false);
        setIsValidatingSelectedClient(false);
    }, [selectedInteractionId]);

    useEffect(() => {
        const nextContext = parseInteractionSearchContext(location.search);

        if (nextContext.shouldNormalizeWorkspace) {
            const params = new URLSearchParams(location.search);
            params.delete(INTERACTION_SEARCH_QUERY_PARAMS.workspaceId);
            params.set(INTERACTION_SEARCH_QUERY_PARAMS.allWorkspaces, "true");
            params.set(INTERACTION_SEARCH_QUERY_PARAMS.page, "1");
            params.delete(INTERACTION_SEARCH_QUERY_PARAMS.interactionId);
            params.delete(INTERACTION_SEARCH_QUERY_PARAMS.suggestedClientDismissed);
            params.delete(INTERACTION_SEARCH_QUERY_PARAMS.clientPanel);
            if (nextContext.shouldNormalizeType) {
                params.set(INTERACTION_SEARCH_QUERY_PARAMS.type, nextContext.selectedType);
            }
            const nextSearch = params.toString();

            navigate(
                {
                    pathname: location.pathname,
                    search: nextSearch ? `?${nextSearch}` : "",
                },
                { replace: true },
            );
        }

        if (!nextContext.shouldNormalizeWorkspace && nextContext.shouldNormalizeType) {
            const params = new URLSearchParams(location.search);
            params.set(INTERACTION_SEARCH_QUERY_PARAMS.type, nextContext.selectedType);
            const nextSearch = params.toString();

            navigate(
                {
                    pathname: location.pathname,
                    search: nextSearch ? `?${nextSearch}` : "",
                },
                { replace: true },
            );
        }

        isApplyingSearchContextRef.current = true;
        setSelectedWorkspace(nextContext.selectedWorkspace);
        setAllWorkspaces(nextContext.allWorkspaces);
        setSelectedType(nextContext.selectedType);
        setMyReviewsOnly(nextContext.myReviewsOnly);
        setSearchTerm(nextContext.searchTerm);
        setPage(nextContext.page);
        setSelectedInteractionIdFromContext(nextContext.selectedInteractionId);
        setDismissedSuggestedClientInteractionId(
            nextContext.suggestedClientDismissed ? nextContext.selectedInteractionId : null,
        );
        setOpenManagerClient(nextContext.clientPanelOpen);
        clientPanelContextRef.current = {
            open: nextContext.clientPanelOpen,
            interactionId: nextContext.selectedInteractionId,
        };

        if (!nextContext.selectedInteractionId) {
            setSelectedInteraction(null);
        }
    }, [location.pathname, location.search, navigate]);

    useEffect(() => {
        if (!hasMountedSearchContextRef.current) {
            hasMountedSearchContextRef.current = true;
            isApplyingSearchContextRef.current = false;
            return;
        }

        if (isApplyingSearchContextRef.current) {
            isApplyingSearchContextRef.current = false;
            return;
        }

        setPage(1);
        setSelectedInteraction(null);
        setSelectedInteractionIdFromContext(null);
        setDismissedSuggestedClientInteractionId(null);
        setShowEmail(false);
    }, [selectedWorkspace, allWorkspaces, selectedType, myReviewsOnly, searchTerm]);

    useEffect(() => {
        if (!selectedInteractionIdFromContext || !isInteractionScopeReady || isLoading || isReviewIdentityPending) {
            return;
        }

        const restoredInteraction = interactions.find((interaction) =>
            isSameInteractionId(interaction.id, selectedInteractionIdFromContext),
        );

        if (restoredInteraction) {
            setSelectedInteraction((currentInteraction) =>
                isSameInteractionId(currentInteraction?.id, restoredInteraction.id)
                    ? currentInteraction
                    : restoredInteraction,
            );
            return;
        }

        setSelectedInteraction(null);
        setSelectedInteractionIdFromContext(null);
        setDismissedSuggestedClientInteractionId(null);
        replaceInteractionSearchContext({
            selectedInteractionId: null,
            suggestedClientDismissed: false,
            clientPanelOpen: false,
        });
    }, [interactions, isInteractionScopeReady, isLoading, isReviewIdentityPending, selectedInteractionIdFromContext]);

    useEffect(() => {
        if (selectedRouteClientId) return;

        selectedClientPreservationLookupKeyRef.current = "";
        setPreserveSelectedClientModalOpen(false);
        setPreserveSelectedClientSenderEmail("");
        setHasCheckedSelectedClientPreservation(false);
        setRequiresSelectedClientPreservationConfirmation(false);
        setHasConfirmedSelectedClientPreservation(false);
        setIsValidatingSelectedClient(false);
    }, [selectedRouteClientId]);

    useEffect(() => {
        if (!shouldDiscoverSuggestedClients || selectedRouteClientId) return;

        discoverSuggestedClients(selectedInteraction.id, selectedInteractionSenderEmail).catch(() => undefined);
    }, [
        discoverSuggestedClients,
        selectedInteraction?.id,
        selectedInteractionSenderEmail,
        selectedRouteClientId,
        shouldDiscoverSuggestedClients,
    ]);

    useEffect(() => {
        if (!shouldCheckSelectedClientPreservation) return;

        const interactionId = selectedInteraction.id;
        const lookupKey = selectedClientPreservationLookupKey;

        if (selectedClientPreservationLookupKeyRef.current === lookupKey) return;

        selectedClientPreservationLookupKeyRef.current = lookupKey;
        setHasCheckedSelectedClientPreservation(false);
        setRequiresSelectedClientPreservationConfirmation(false);
        setHasConfirmedSelectedClientPreservation(false);
        setPreserveSelectedClientModalOpen(false);
        setPreserveSelectedClientSenderEmail("");
        setSuggestedClientModalOpen(false);
        setSuggestedClients([]);
        setSuggestedClientSenderEmail("");
        setIsValidatingSelectedClient(true);

        discoverSuggestedClients(interactionId, selectedInteractionSenderEmail)
            .then((result) => {
                if (
                    !isCurrentPreservationLookup(
                        selectedInteractionIdRef,
                        selectedClientPreservationLookupKeyRef,
                        interactionId,
                        lookupKey,
                    )
                ) {
                    return;
                }

                const clients = Array.isArray(result?.clients) ? result.clients : [];
                const selectedClientMatchesSender = clients.some((client) =>
                    isSameInteractionId(client?.id, selectedRouteClientId),
                );

                if (selectedClientMatchesSender) {
                    setRequiresSelectedClientPreservationConfirmation(false);
                    return;
                }

                if (clients.length > 0) {
                    setRequiresSelectedClientPreservationConfirmation(false);
                    setDismissedSuggestedClientInteractionId(null);
                    setSuggestedClients(clients);
                    setSuggestedClientSenderEmail(result?.senderEmail || selectedInteractionSenderEmail);
                    setSuggestedClientModalOpen(true);
                    return;
                }

                setRequiresSelectedClientPreservationConfirmation(true);
                setPreserveSelectedClientSenderEmail(result?.senderEmail || selectedInteractionSenderEmail);
                setPreserveSelectedClientModalOpen(true);
            })
            .catch(() => {
                if (
                    !isCurrentPreservationLookup(
                        selectedInteractionIdRef,
                        selectedClientPreservationLookupKeyRef,
                        interactionId,
                        lookupKey,
                    )
                ) {
                    return;
                }

                toast.error(
                    t("interactions.client.suggestedClientSearchError", {
                        defaultValue: "Could not search Suggested Clients for this Interaction",
                    }),
                );
            })
            .finally(() => {
                if (
                    isCurrentPreservationLookup(
                        selectedInteractionIdRef,
                        selectedClientPreservationLookupKeyRef,
                        interactionId,
                        lookupKey,
                    )
                ) {
                    setHasCheckedSelectedClientPreservation(true);
                    setIsValidatingSelectedClient(false);
                }
            });
    }, [
        selectedClientPreservationLookupKey,
        selectedInteraction?.id,
        selectedInteractionSenderEmail,
        shouldCheckSelectedClientPreservation,
        discoverSuggestedClients,
        t,
    ]);

    const isSelectedClientPreservationPending =
        shouldCheckSelectedClientPreservation &&
        (isValidatingSelectedClient ||
            !hasCheckedSelectedClientPreservation ||
            selectedClientPreservationLookupKeyRef.current !== selectedClientPreservationLookupKey ||
            (requiresSelectedClientPreservationConfirmation && !hasConfirmedSelectedClientPreservation));

    const handlePageChange = (nextPage) => {
        setPage(nextPage);
        setSelectedInteraction(null);
        setSelectedInteractionIdFromContext(null);
        setDismissedSuggestedClientInteractionId(null);
        setShowEmail(false);
        replaceInteractionSearchContext({
            page: nextPage,
            selectedInteractionId: null,
            suggestedClientDismissed: false,
            clientPanelOpen: false,
        });
    };

    const resetInteractionSelection = () => {
        setSelectedInteraction(null);
        setSelectedInteractionIdFromContext(null);
        setDismissedSuggestedClientInteractionId(null);
        setShowEmail(false);
    };

    const normalizeInteractionDeparture = (interactionId, { leavesCurrentList = true } = {}) => {
        if (leavesCurrentList && interactionId !== null && interactionId !== undefined) {
            setLocallyHiddenInteractionIds((currentIds) =>
                currentIds.some((currentId) => isSameInteractionId(currentId, interactionId))
                    ? currentIds
                    : [...currentIds, interactionId],
            );
        }

        const nextTotalRecords = leavesCurrentList ? Math.max(0, totalRecords - 1) : totalRecords;
        const nextTotalPages = Math.max(1, Math.ceil(nextTotalRecords / DEFAULT_INTERACTIONS_PAGE_SIZE));
        const nextPage = Math.min(page, nextTotalPages);

        setPage(nextPage);
        setOpenManagerClient(false);
        setAssociateCaseModalOpen(false);
        setSuggestedClientModalOpen(false);
        setPreserveSelectedClientModalOpen(false);
        resetInteractionSelection();
        replaceInteractionSearchContext({
            page: nextPage,
            selectedInteractionId: null,
            suggestedClientDismissed: false,
            clientPanelOpen: false,
        });

        return nextPage !== page;
    };

    const refreshAgentInteractionsAfterMutation = async ({ pageChanged = false } = {}) => {
        await queryClient.invalidateQueries({
            queryKey: [["agent-interactions", activeGroupId]],
            exact: false,
            refetchType: "none",
        });

        if (!pageChanged) {
            await refetch?.();
        }
    };

    const handleAvailabilityResolved = useCallback(({ activeGroupId: resolvedGroupId, workspaceIds }) => {
        setAvailabilityScope({
            activeGroupId: resolvedGroupId,
            workspaceIds,
        });
    }, []);

    useEffect(() => {
        if (!isAvailabilityResolved || allWorkspaces || !selectedWorkspace || isSelectedWorkspaceAvailable) return;

        setSelectedWorkspace(null);
        setAllWorkspaces(true);
        setPage(1);
        setOpenManagerClient(false);
        resetInteractionSelection();
        clearSelectedClient();
        const nextSearch = buildInteractionSearch({
            selectedWorkspace: null,
            allWorkspaces: true,
            page: 1,
            selectedInteractionId: null,
            suggestedClientDismissed: false,
            clientPanelOpen: false,
        });
        navigate(
            {
                pathname: "/agent",
                search: nextSearch ? `?${nextSearch}` : "",
            },
            { replace: true },
        );
    }, [
        allWorkspaces,
        clearSelectedClient,
        isAvailabilityResolved,
        isSelectedWorkspaceAvailable,
        navigate,
        selectedWorkspace,
    ]);

    useEffect(() => {
        if (String(activeGroupIdRef.current ?? "") === String(activeGroupId ?? "")) return;

        activeGroupIdRef.current = activeGroupId;
        setOpenManagerClient(false);
        resetInteractionSelection();
        clearSelectedClient();
        replaceInteractionSearchContext({
            selectedInteractionId: null,
            suggestedClientDismissed: false,
            clientPanelOpen: false,
        });
    }, [activeGroupId, clearSelectedClient]);

    const handleSelectWorkspace = (workspaceId) => {
        if (!workspaceId) {
            setSelectedWorkspace(null);
            return;
        }

        setSelectedWorkspace(workspaceId);
        setAllWorkspaces(false);
        setPage(1);
        setOpenManagerClient(false);
        resetInteractionSelection();
        replaceInteractionSearchContext({
            selectedWorkspace: workspaceId,
            allWorkspaces: false,
            page: 1,
            selectedInteractionId: null,
            suggestedClientDismissed: false,
            clientPanelOpen: false,
        });
    };

    const handleAllWorkspacesChange = (checked) => {
        setAllWorkspaces(checked);
        if (checked) {
            setSelectedWorkspace(null);
        }
        setPage(1);
        setOpenManagerClient(false);
        resetInteractionSelection();
        replaceInteractionSearchContext({
            selectedWorkspace: checked ? null : selectedWorkspace,
            allWorkspaces: checked,
            page: 1,
            selectedInteractionId: null,
            suggestedClientDismissed: false,
            clientPanelOpen: false,
        });
    };

    const handleTypeChange = (nextType) => {
        const normalizedType = normalizeAgentInteractionType(nextType);

        if (myReviewsOnly || normalizedType === selectedType) return;

        setSelectedType(normalizedType);
        setPage(1);
        setOpenManagerClient(false);
        resetInteractionSelection();
        replaceInteractionSearchContext({
            selectedType: normalizedType,
            page: 1,
            selectedInteractionId: null,
            suggestedClientDismissed: false,
            clientPanelOpen: false,
        });
    };

    const handleMyReviewsOnlyChange = (checked) => {
        if (checked === myReviewsOnly) return;

        setMyReviewsOnly(checked);
        setPage(1);
        setOpenManagerClient(false);
        resetInteractionSelection();
        replaceInteractionSearchContext({
            myReviewsOnly: checked,
            page: 1,
            selectedInteractionId: null,
            suggestedClientDismissed: false,
            clientPanelOpen: false,
        });
    };

    const handleSearchChange = (nextSearchTerm) => {
        if (nextSearchTerm === searchTerm) return;

        setSearchTerm(nextSearchTerm);
        setPage(1);
        setOpenManagerClient(false);
        resetInteractionSelection();
        replaceInteractionSearchContext({
            searchTerm: nextSearchTerm,
            page: 1,
            selectedInteractionId: null,
            suggestedClientDismissed: false,
            clientPanelOpen: false,
        });
    };

    const handleSelectInteraction = (interaction) => {
        setSelectedInteraction(interaction);
        setSelectedInteractionIdFromContext(interaction?.id ?? null);
        setDismissedSuggestedClientInteractionId(null);
        setShowEmail(false);
        setOpenManagerClient(false);
        replaceInteractionSearchContext({
            selectedInteractionId: interaction?.id ?? null,
            suggestedClientDismissed: false,
            clientPanelOpen: false,
        });
    };

    const handleReviewChange = async (updatedInteraction) => {
        const selectedInteractionId = updatedInteraction?.id ?? selectedInteraction?.id;

        if (updatedInteraction) {
            setSelectedInteraction((currentInteraction) =>
                isSameInteractionId(currentInteraction?.id, updatedInteraction.id)
                    ? { ...currentInteraction, ...updatedInteraction }
                    : currentInteraction,
            );
        }

        const result = await refetch?.();
        const refreshedInteractions = Array.isArray(result?.data)
            ? result.data
            : (result?.data?.interactions ?? result?.data?.data ?? []);
        const refreshedInteraction = refreshedInteractions.find(
            (interaction) => String(interaction.id) === String(selectedInteractionId),
        );

        if (
            refreshedInteraction &&
            (!updatedInteraction || hasSameReviewState(refreshedInteraction, updatedInteraction))
        ) {
            setSelectedInteraction((currentInteraction) =>
                isSameInteractionId(currentInteraction?.id, selectedInteractionId)
                    ? refreshedInteraction
                    : currentInteraction,
            );
        }
    };

    const handleInteractionMoved = async (interactionId, workspaceId) => {
        const destinationRemainsInActiveGroup =
            isAvailabilityResolved &&
            availabilityScope.workspaceIds.some(
                (availableWorkspaceId) => String(availableWorkspaceId) === String(workspaceId),
            );
        const leavesCurrentList = !allWorkspaces || !destinationRemainsInActiveGroup;
        const pageChanged = normalizeInteractionDeparture(interactionId, { leavesCurrentList });

        queryClient.removeQueries({
            queryKey: [agentMoveWorkspaceDestinationsKey(user?.id, activeGroupId, interactionId)],
            exact: true,
        });
        await refreshAgentInteractionsAfterMutation({ pageChanged });
    };

    const handleCloseSubmit = async ({ motive }) => {
        try {
            await closeInteraction({ motive });
        } catch {
            return;
        }

        setCloseDialogOpen(false);
        const pageChanged = normalizeInteractionDeparture(selectedInteraction?.id);
        await refreshAgentInteractionsAfterMutation({ pageChanged });
    };

    const openClientManagerWithSuggestedClientLookup = async () => {
        setOpenManagerClient(true);
        setDismissedSuggestedClientInteractionId(null);
        replaceInteractionSearchContext({
            clientPanelOpen: true,
            selectedInteractionId: selectedInteraction?.id ?? selectedInteractionId,
            suggestedClientDismissed: false,
        });

        if (!selectedInteraction?.id || isSearchingSuggestedClient) return;

        const interactionId = selectedInteraction.id;
        const senderEmail = email?.sender ?? selectedInteraction?.client_identifier ?? "";

        setIsSearchingSuggestedClient(true);

        try {
            const result = await discoverSuggestedClients(interactionId, senderEmail);

            if (!isSameInteractionId(selectedInteractionIdRef.current, interactionId)) return;

            if (!result?.clients?.length) return;

            setSuggestedClients(result.clients);
            setSuggestedClientSenderEmail(result.senderEmail);
            setSuggestedClientModalOpen(true);
        } catch {
            toast.error(
                t("interactions.client.suggestedClientSearchError", {
                    defaultValue: "Could not search Suggested Clients for this Interaction",
                }),
            );
        } finally {
            if (isSameInteractionId(selectedInteractionIdRef.current, interactionId)) {
                setIsSearchingSuggestedClient(false);
            }
        }
    };

    const handleSuggestedClientModalOpenChange = (open) => {
        setSuggestedClientModalOpen(open);

        if (!open) {
            setDismissedSuggestedClientInteractionId(selectedInteraction?.id ?? null);
            replaceInteractionSearchContext({
                selectedInteractionId: selectedInteraction?.id ?? selectedInteractionId,
                suggestedClientDismissed: Boolean(selectedInteraction?.id ?? selectedInteractionId),
            });
        }
    };

    const handleConfirmSuggestedClient = (client) => {
        if (client?.id === null || client?.id === undefined) return;

        setSuggestedClientModalOpen(false);
        setDismissedSuggestedClientInteractionId(null);

        const nextSearch = buildInteractionSearch({
            selectedInteractionId: selectedInteraction?.id ?? selectedInteractionId,
            suggestedClientDismissed: false,
            clientPanelOpen: false,
        });

        navigate(`/agent/${encodeURIComponent(String(client.id))}${nextSearch ? `?${nextSearch}` : ""}`);
    };

    const handleKeepSelectedClient = () => {
        setHasConfirmedSelectedClientPreservation(true);
        setPreserveSelectedClientModalOpen(false);
    };

    const handleDiscardSelectedClient = () => {
        setPreserveSelectedClientModalOpen(false);
        selectedClientPreservationLookupKeyRef.current = "";
        setRequiresSelectedClientPreservationConfirmation(false);
        setHasConfirmedSelectedClientPreservation(false);
        setHasCheckedSelectedClientPreservation(false);
        setIsValidatingSelectedClient(false);
        clearSelectedClient();
        setOpenManagerClient(true);

        const nextSearch = buildInteractionSearch({
            selectedInteractionId: selectedInteraction?.id ?? selectedInteractionId,
            suggestedClientDismissed: false,
            clientPanelOpen: true,
        });

        navigate(`/agent${nextSearch ? `?${nextSearch}` : ""}`);
    };

    const handleSetOpenManagerClient = (open) => {
        setOpenManagerClient(open);
        replaceInteractionSearchContext({ clientPanelOpen: open });
    };

    const handleAssociateCaseClick = () => {
        if (isSelectedClientPreservationPending) return;

        if (!selectedRouteClientId) {
            openClientManagerWithSuggestedClientLookup();
            toast.info(
                t("interactions.cases.selectClientFirst", {
                    defaultValue: "Select or create a Client before associating a Case",
                }),
            );
            return;
        }

        setAssociateCaseModalOpen(true);
    };

    const handleCreateCaseFromModal = () => {
        if (isSelectedClientPreservationPending || !selectedRouteClientId || !selectedInteraction?.id) return;

        createCaseAction({
            dispatch,
            navigate,
            clientId: selectedRouteClientId,
            canCreateSubcases: Boolean(configCases?.case_enable_subcases),
            interactionId: selectedInteraction.id,
        });
    };

    const handleViewLinkedCase = (kase) => {
        openCaseAction({
            dispatch,
            navigate,
            id: kase.id,
            reference: kase.reference,
        });
    };

    const handleHeaderAssociateSuccess = async () => {
        setAssociateCaseModalOpen(false);
        toast.success(
            t("interactions.cases.associateSuccess", {
                defaultValue: "Case associated to interaction",
            }),
        );

        await linkedCasesQuery.refetch?.();
    };

    return (
        <div className="flex flex-col gap-2 w-full">
            <div className="flex justify-center">
                <div className="flex flex-col items-start gap-2 lg:flex-row lg:items-center lg:gap-4">
                    <InteractionsWorkspaceSelect
                        selectedWorkspace={selectedWorkspace}
                        onSelectWorkspace={handleSelectWorkspace}
                        allWorkspaces={allWorkspaces}
                        onAllWorkspacesChange={handleAllWorkspacesChange}
                        onAvailabilityResolved={handleAvailabilityResolved}
                    />
                    <MyReviewsFilter myReviewsOnly={myReviewsOnly} onMyReviewsOnlyChange={handleMyReviewsOnlyChange} />
                </div>
            </div>

            <InteractionsFilters
                selectedType={selectedType}
                onTypeChange={handleTypeChange}
                myReviewsOnly={myReviewsOnly}
                searchTerm={searchTerm}
                onSearchChange={handleSearchChange}
            />
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                <div className="min-w-0 xl:col-span-5">
                    <InteractionsList
                        workspaceId={allWorkspaces ? "all" : selectedWorkspace}
                        interactions={visibleInteractions}
                        isLoading={isLoading}
                        isFetching={isFetching}
                        totalRecords={visibleTotalRecords}
                        pagination={{
                            page,
                            totalPages,
                            onPreviousPage: () => handlePageChange(Math.max(page - 1, 1)),
                            canPreviousPage: page > 1,
                            onNextPage: () => handlePageChange(Math.min(page + 1, totalPages)),
                            canNextPage: page < totalPages,
                            onJumpBackward: () => handlePageChange(Math.max(page - 10, 1)),
                            onJumpForward: () => handlePageChange(Math.min(page + 10, totalPages)),
                        }}
                        selectedInteraction={selectedInteraction}
                        onSelectInteraction={handleSelectInteraction}
                    />
                </div>
                <div className={detailColumnClassName}>
                    {!showEmail && (
                        <InteractionDetail
                            interaction={selectedInteraction}
                            senderEmail={email?.sender}
                            isUpdating={isUpdatingInteractions}
                            onClose={canCloseInteraction ? () => setCloseDialogOpen(true) : undefined}
                            onReviewChange={handleReviewChange}
                            onViewEmail={() => setShowEmail(true)}
                            email={email}
                            openManagerClient={openManagerClient}
                            setOpenManagerClient={handleSetOpenManagerClient}
                            onMissingClientSelection={openClientManagerWithSuggestedClientLookup}
                            isInteractionCaseActionDisabled={isSelectedClientPreservationPending}
                            canOpenAssociateCase={canAssociateCase}
                            onAssociateCase={handleAssociateCaseClick}
                            canViewLinkedCases={canReadLinkedCases}
                            linkedCases={linkedCasesQuery.items}
                            onViewLinkedCase={handleViewLinkedCase}
                            canCloseInteraction={canCloseInteraction}
                            canMoveWorkspace={canMoveWorkspace}
                            onInteractionMoved={handleInteractionMoved}
                            activeGroupId={activeGroupId}
                        />
                    )}

                    {showEmail && loadingEmail && (
                        <div className="flex items-center gap-2 justify-center py-8">
                            <GeneralLoader />
                        </div>
                    )}

                    {showEmail && email && <EmailDetail email={email} onBack={() => setShowEmail(false)} />}
                </div>
                {showClientManager && (
                    <div className="min-w-0 xl:col-span-3">
                        <InteractionsClientBox
                            interactionEmail={email?.sender}
                            interaction={selectedInteraction}
                            isSearchingSuggestedClient={isSearchingSuggestedClient}
                        />
                    </div>
                )}
            </div>
            {selectedInteraction?.id !== undefined && selectedInteraction?.id !== null && (
                <AssociateInteractionCaseModal
                    open={associateCaseModalOpen}
                    onOpenChange={setAssociateCaseModalOpen}
                    interactionId={selectedInteraction.id}
                    clientId={selectedRouteClientId}
                    linkedCaseIds={linkedCasesQuery.caseIds}
                    canCreateCase={canCreateCase}
                    onCreateCase={handleCreateCaseFromModal}
                    onAssociated={handleHeaderAssociateSuccess}
                />
            )}
            <SuggestedInteractionClientModal
                open={suggestedClientModalOpen}
                onOpenChange={handleSuggestedClientModalOpenChange}
                senderEmail={suggestedClientSenderEmail}
                clients={suggestedClients}
                onConfirm={handleConfirmSuggestedClient}
                hasCurrentClient={Boolean(selectedRouteClientId)}
            />
            <PreserveSelectedClientModal
                open={preserveSelectedClientModalOpen}
                onOpenChange={(open) => {
                    if (open || hasConfirmedSelectedClientPreservation) {
                        setPreserveSelectedClientModalOpen(open);
                    }
                }}
                senderEmail={preserveSelectedClientSenderEmail}
                onConfirm={handleKeepSelectedClient}
                onReject={handleDiscardSelectedClient}
            />
            <InteractionMotiveDialog
                open={closeDialogOpen}
                onOpenChange={setCloseDialogOpen}
                interaction={selectedInteraction}
                motiveOptions={motiveOptions}
                isLoadingOptions={isLoadingMotiveOptions}
                isPending={isUpdatingInteractions}
                onSubmit={handleCloseSubmit}
                mode="close"
                t={t}
            />
        </div>
    );
};
export default InteractionsHandler;
