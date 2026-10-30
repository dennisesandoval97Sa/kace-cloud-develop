import PropTypes from "prop-types";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import {
    Badge,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Input,
} from "@/components/ui-shared";
import { useInteractionCaseSearch } from "./hooks/useInteractionCaseSearch";
import { useAssociateInteractionCases } from "./hooks/useAssociateInteractionCases";
import { CLASSIFICATION_LEVELS } from "./interactionCaseConstants";

const PAGE_SIZE = 20;

const formatReference = (reference) => {
    if (reference === null || reference === undefined || reference === "") return "—";

    return `#${reference}`;
};

const formatDisplayValue = (value) => {
    if (value === null || value === undefined || value === "") return "—";

    return String(value);
};

const getClassificationSummary = (caseItem) => {
    const classification = CLASSIFICATION_LEVELS.map((level) => caseItem[level])
        .filter((value) => value !== null && value !== undefined && String(value).trim() !== "")
        .map((value) => String(value).trim())
        .join(" / ");

    return classification || "—";
};

const getResponsibleName = (caseItem) =>
    caseItem.responsible_name ?? caseItem.responsible_login ?? caseItem.nombres ?? caseItem.login;

const AssociateInteractionCaseModal = ({
    open,
    onOpenChange,
    interactionId,
    clientId,
    linkedCaseIds = [],
    canCreateCase = false,
    onCreateCase,
    onAssociated,
}) => {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(1);
    const [selectedCaseId, setSelectedCaseId] = useState(null);
    const [stateClientId, setStateClientId] = useState(clientId);

    const shouldResetStateForContext = !open || stateClientId !== clientId;
    const effectiveSearchTerm = shouldResetStateForContext ? "" : searchTerm;
    const effectivePage = shouldResetStateForContext ? 1 : page;
    const effectiveSelectedCaseId = shouldResetStateForContext ? null : selectedCaseId;

    useEffect(() => {
        if (!shouldResetStateForContext) return;

        setSearchTerm("");
        setPage(1);
        setSelectedCaseId(null);
        setStateClientId(clientId);
    }, [clientId, shouldResetStateForContext]);

    const { data, isLoading, isFetching } = useInteractionCaseSearch({
        clientId,
        searchTerm: effectiveSearchTerm,
        page: effectivePage,
        pageSize: PAGE_SIZE,
        excludedCaseIds: linkedCaseIds,
        enabled: open && Boolean(clientId),
    });
    const { associateInteractionCases, isPending } = useAssociateInteractionCases(interactionId, {
        onSuccessToast: false,
        path: null,
    });

    const cases = data?.items ?? [];
    const totalCases = Number(data?.total ?? 0);
    const totalPages = Math.max(Math.ceil(totalCases / PAGE_SIZE), 1);
    const isLoadingCases = isLoading || isFetching;
    const hasCases = cases.length > 0;
    const selectedCase = cases.find((caseItem) => caseItem.id === effectiveSelectedCaseId);
    const canConfirm = Boolean(selectedCase) && !isPending;
    const hasPreviousPage = effectivePage > 1;
    const hasNextPage = effectivePage < totalPages;

    const handleSearchChange = (event) => {
        setSearchTerm(event.target.value);
        setPage(1);
        setSelectedCaseId(null);
    };

    const handlePageChange = (nextPage) => {
        setPage(nextPage);
        setSelectedCaseId(null);
    };

    const handleConfirm = () => {
        if (!selectedCase || isPending) return;

        associateInteractionCases(
            { caso_id: selectedCase.id },
            {
                onSuccess: () => onAssociated?.(selectedCase.id),
            },
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] max-w-3xl grid-rows-[auto,minmax(0,1fr),auto] overflow-hidden">
                <DialogHeader>
                    <DialogTitle>{t("interactions.cases.associateCase")}</DialogTitle>
                    <DialogDescription>
                        {t("interactions.cases.associateCaseDescription", {
                            defaultValue: "Search open Cases for the selected Client.",
                        })}
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 space-y-4 overflow-hidden">
                    <div className="relative">
                        <Search
                            aria-hidden="true"
                            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                        />
                        <Input
                            name="associate_case_search"
                            value={effectiveSearchTerm}
                            onChange={handleSearchChange}
                            aria-label={t("interactions.cases.searchCasesLabel", {
                                defaultValue: "Search Cases",
                            })}
                            placeholder={t("interactions.cases.searchPlaceholder", {
                                defaultValue: "Search by reference, classification, or responsible",
                            })}
                            className="pl-9"
                        />
                    </div>

                    <div className="min-h-0 space-y-2" aria-busy={isLoadingCases}>
                        {isLoadingCases ? (
                            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                                {t("app.text.loading", { defaultValue: "Loading..." })}
                            </div>
                        ) : null}

                        {!isLoadingCases && hasCases ? (
                            <div
                                role="list"
                                aria-label={t("interactions.cases.searchResults", {
                                    defaultValue: "Case search results",
                                })}
                                className="max-h-[min(28rem,60vh)] space-y-2 overflow-y-auto pr-1"
                            >
                                {cases.map((caseItem) => {
                                    const caseReference = formatReference(caseItem.reference);
                                    const isSelected = effectiveSelectedCaseId === caseItem.id;

                                    return (
                                        <div role="listitem" key={caseItem.id}>
                                            <button
                                                type="button"
                                                className={`w-full rounded-md border p-4 text-left transition ${
                                                    isSelected
                                                        ? "border-primary bg-primary/5"
                                                        : "border-input bg-background hover:bg-accent"
                                                }`}
                                                aria-pressed={isSelected}
                                                onClick={() => setSelectedCaseId(caseItem.id)}
                                            >
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                    <div className="space-y-2">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="font-medium">{caseReference}</span>
                                                            {caseItem.parent_id ? (
                                                                <Badge variant="outline">
                                                                    {t("interactions.cases.subcase", {
                                                                        defaultValue: "Subcase",
                                                                    })}
                                                                </Badge>
                                                            ) : null}
                                                        </div>
                                                        <div className="text-sm text-foreground">
                                                            {getClassificationSummary(caseItem)}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1 text-sm text-muted-foreground sm:text-right">
                                                        <div>{formatDisplayValue(caseItem.estadoActual)}</div>
                                                        <div>{formatDisplayValue(getResponsibleName(caseItem))}</div>
                                                    </div>
                                                </div>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : null}

                        {!isLoadingCases && !hasCases ? (
                            <div className="rounded-md border border-dashed p-6 text-center">
                                <p className="text-sm text-muted-foreground">
                                    {t("interactions.cases.noOpenCases", {
                                        defaultValue: "No open Cases found for this Client",
                                    })}
                                </p>
                                {canCreateCase ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="mt-4"
                                        onClick={onCreateCase}
                                    >
                                        {t("interactions.cases.createCase", { defaultValue: "Create Case" })}
                                    </Button>
                                ) : null}
                            </div>
                        ) : null}
                    </div>

                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!hasPreviousPage || isLoadingCases}
                            onClick={() => handlePageChange(effectivePage - 1)}
                        >
                            {t("button.previous", { defaultValue: "Previous" })}
                        </Button>
                        <span>
                            {t("interactions.cases.pageIndicator", {
                                defaultValue: `Page ${effectivePage} of ${totalPages}`,
                                page: effectivePage,
                                totalPages,
                            })}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!hasNextPage || isLoadingCases}
                            onClick={() => handlePageChange(effectivePage + 1)}
                        >
                            {t("button.next", { defaultValue: "Next" })}
                        </Button>
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
                        {t("button.cancel")}
                    </Button>
                    <Button type="button" disabled={!canConfirm} onClick={handleConfirm}>
                        {t("interactions.cases.confirmAssociate", {
                            defaultValue: "Associate selected Case",
                        })}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

AssociateInteractionCaseModal.propTypes = {
    open: PropTypes.bool.isRequired,
    onOpenChange: PropTypes.func.isRequired,
    interactionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    clientId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    linkedCaseIds: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.number])),
    canCreateCase: PropTypes.bool,
    onCreateCase: PropTypes.func,
    onAssociated: PropTypes.func,
};

export default AssociateInteractionCaseModal;
