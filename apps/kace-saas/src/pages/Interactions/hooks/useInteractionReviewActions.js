import { useCallback, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import useUserInformation from "@/hooks/useUserInformation";
import { getTranslatedError } from "@/utils/getTranslatedError";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { claimInteractionReview, releaseInteractionReview } from "../services/interactionReviewService";

const hasGrantedPermission = (permissions = [], permissionName) =>
    permissions.some(
        (permission) =>
            permission?.module_id === "interactions" &&
            permission?.name === permissionName &&
            permission?.granted === true,
    );

const reviewerLabel = (interaction) =>
    interaction?.start_review_by_name ||
    interaction?.reviewer_name ||
    interaction?.reviewer?.name ||
    interaction?.reviewer?.email ||
    "";

const getReviewerId = (interaction) =>
    interaction?.start_review_by ?? interaction?.reviewer_id ?? interaction?.reviewer?.id ?? null;

const getErrorStatus = (error) => error?.response?.status ?? error?.response?.data?.statusCode ?? error?.status;

const getResponseInteraction = (response) => {
    const payload = response?.data?.data ?? response?.data?.interaction ?? response?.data ?? response;

    if (!payload || typeof payload !== "object" || Array.isArray(payload) || !payload.id) {
        return null;
    }

    return payload;
};

const mergeReviewResponse = (response, fallbackInteraction) => {
    const responseInteraction = getResponseInteraction(response);

    if (!responseInteraction) {
        return fallbackInteraction;
    }

    return {
        ...fallbackInteraction,
        ...responseInteraction,
    };
};

export const useInteractionReviewActions = ({ interaction, onSuccess, agentScoped = false, activeGroupId } = {}) => {
    const queryClient = useQueryClient();
    const { t } = useTranslation();
    const { user, permissionsAdmin, permissionsAgent } = useUserInformation();
    const interactionId = interaction?.id;
    const currentUserId = user?.id;
    const canReleaseAny = hasGrantedPermission(permissionsAdmin, "InteractionsUpdate");
    const canManageReview = canReleaseAny || hasGrantedPermission(permissionsAgent, "InteractionsCreate");

    const refresh = useCallback(
        async (updatedInteraction, response) => {
            await onSuccess?.(updatedInteraction, response);
            const queryKey = agentScoped ? [["agent-interactions", activeGroupId]] : [URL_AND_KEYS.interactions.key];
            queryClient.invalidateQueries({ queryKey, exact: false }).catch(() => {});
        },
        [activeGroupId, agentScoped, onSuccess, queryClient],
    );

    const handleError = (operation) => (error) => {
        const status = getErrorStatus(error);

        if (status === 409) {
            toast.error(t("interactions.review.conflict"));
            return;
        }

        if (status === 403) {
            toast.error(
                operation === "claim" ? t("interactions.review.manageForbidden") : t("interactions.review.forbidden"),
            );
            return;
        }

        toast.error(getTranslatedError(error, t));
    };

    const claimMutation = useMutation({
        mutationFn: (id) =>
            agentScoped ? claimInteractionReview(id, { agentScoped: true }) : claimInteractionReview(id),
        onSuccess: async (response) => {
            toast.success(t("interactions.review.claimSuccess"));
            await refresh(
                mergeReviewResponse(response, {
                    ...interaction,
                    in_review: true,
                    start_review_by: currentUserId,
                }),
                response,
            );
        },
        onError: handleError("claim"),
    });

    const releaseMutation = useMutation({
        mutationFn: (id) =>
            agentScoped ? releaseInteractionReview(id, { agentScoped: true }) : releaseInteractionReview(id),
        onSuccess: async (response) => {
            toast.success(t("interactions.review.releaseSuccess"));
            await refresh(
                mergeReviewResponse(response, {
                    ...interaction,
                    in_review: false,
                    start_review_by: null,
                    start_review_by_name: null,
                    reviewer_id: null,
                    reviewer_name: null,
                    reviewer: null,
                }),
                response,
            );
        },
        onError: handleError("release"),
    });

    const isPending = claimMutation.isPending || releaseMutation.isPending;

    const claimReview = useCallback(() => {
        if (!interactionId) return;
        claimMutation.mutate(interactionId);
    }, [claimMutation, interactionId]);

    const releaseReview = useCallback(() => {
        if (!interactionId) return;
        releaseMutation.mutate(interactionId);
    }, [interactionId, releaseMutation]);

    const button = useMemo(() => {
        if (!interactionId) {
            return {
                label: t("interactions.detail.modal.manage"),
                disabled: true,
                intent: "manage",
            };
        }

        if (!interaction?.in_review) {
            if (!canManageReview) {
                return {
                    label: t("interactions.detail.modal.manage"),
                    disabled: true,
                    intent: "manage",
                    title: t("interactions.review.tooltipNoPermission"),
                };
            }

            return {
                label: t("interactions.detail.modal.manage"),
                disabled: isPending,
                intent: "manage",
                onClick: claimReview,
            };
        }

        const reviewerId = getReviewerId(interaction);
        const isCurrentReviewer = Boolean(currentUserId && reviewerId && String(currentUserId) === String(reviewerId));

        if (isCurrentReviewer) {
            return {
                label: t("interactions.detail.modal.release"),
                disabled: isPending,
                intent: "release",
                onClick: releaseReview,
            };
        }

        if (canReleaseAny) {
            return {
                label: t("interactions.detail.modal.release"),
                disabled: isPending,
                intent: "release",
                onClick: releaseReview,
            };
        }

        const reviewer = reviewerLabel(interaction);

        return {
            label: t("interactions.detail.underReview"),
            disabled: true,
            intent: "readonly",
            title: reviewer
                ? t("interactions.review.tooltipReviewer", { reviewer })
                : t("interactions.review.tooltipOther"),
        };
    }, [
        canManageReview,
        canReleaseAny,
        claimReview,
        currentUserId,
        interaction,
        interactionId,
        isPending,
        releaseReview,
        t,
    ]);

    return {
        button,
        claimReview,
        releaseReview,
        isPending,
    };
};

export default useInteractionReviewActions;
