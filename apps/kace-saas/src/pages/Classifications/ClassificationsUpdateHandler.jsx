import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ClassificationsForm from "./components/ClassificationsForm";
import { CLASSIFICATIONS_SERVICE, TEMPLATES_SERVICE } from "@kace/utils";
import { GeneralLoader } from "@kace/ui-shared";
import { INITIAL_DATA_CLASSIFICATION } from "./data/constants";
import { toast } from "sonner";
import { sendInformation } from "../../services/generic-send-information";
import { formatDataBeforePost } from "./helpers";
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard";
import { useTranslation } from "react-i18next";
import { apiService } from "../../utils/main";
import { CLASSIFICATION_TEMPLATE_RELATIONS_SERVICE } from "../../utils/URL";
import { genericSearch } from "../../services/genericSearch";
import { genericView } from "../../services/genericView.js";
import useConfigAgentData from "@/hooks/useConfigAgentData";
import { getTranslatedError } from "@/utils/getTranslatedError";
import {
    buildAvailableTemplateIds,
    getTemplateRelationChanges,
    toTemplateRelationPayload,
} from "./helpers/templateRelations";

class TemplateRelationsPartialSaveError extends Error {}

const isSuccessfulMountFetch = (isFetchedAfterMount, isSuccess, isRefetchError) =>
    isFetchedAfterMount && isSuccess && !isRefetchError;

const ClassificationsUpdateHandler = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { cases: configCases } = useConfigAgentData();
    const [formSnapshot, setFormSnapshot] = useState(null);
    const navigate = useNavigate();
    const { id } = useParams();
    const routeKey = id ?? "create";
    const {
        data,
        isFetchedAfterMount: isClassificationFetchedAfterMount,
        isRefetchError: isClassificationRefetchError,
        isSuccess: isClassificationSuccess,
    } = useQuery({
        queryKey: ["classificationsForm", id],
        queryFn: async () => genericView(`${CLASSIFICATIONS_SERVICE}/${id}`),
        enabled: !!id,
        staleTime: 0,
        refetchOnMount: "always",
    });
    const {
        data: templateRelations,
        isFetchedAfterMount: areTemplateRelationsFetchedAfterMount,
        isRefetchError: areTemplateRelationsRefetchError,
        isSuccess: areTemplateRelationsSuccessful,
    } = useQuery({
        queryKey: ["classificationsTemplatesForm", id],
        queryFn: async () =>
            genericSearch(
                `${CLASSIFICATION_TEMPLATE_RELATIONS_SERVICE}/search`,
                [
                    {
                        field: "classification_id",
                        operator: "eq",
                        value: id,
                        type: "AND",
                    },
                ],
                { limit: null, offset: null },
                null,
                false,
            ),
        enabled: !!id,
        staleTime: 0,
        refetchOnMount: "always",
    });
    const isClassificationFresh = isSuccessfulMountFetch(
        isClassificationFetchedAfterMount,
        isClassificationSuccess,
        isClassificationRefetchError,
    );
    const areTemplateRelationsFresh = isSuccessfulMountFetch(
        areTemplateRelationsFetchedAfterMount,
        areTemplateRelationsSuccessful,
        areTemplateRelationsRefetchError,
    );
    const persistedTemplateIds = templateRelations?.data?.map((item) => item.template_id) ?? [];
    const persistedKey = persistedTemplateIds.slice().sort().join(",");
    const {
        data: templateSeedResult,
        isFetchedAfterMount: isSeedFetchedAfterMount,
        isRefetchError: isSeedRefetchError,
        isSuccess: isSeedSuccess,
        isError: isSeedError,
    } = useQuery({
        queryKey: ["templatesClassificationSeed", id, persistedKey],
        queryFn: async () =>
            genericSearch(
                `${TEMPLATES_SERVICE}/search`,
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
                        value: persistedKey,
                        type: "AND",
                    },
                ],
                { limit: persistedTemplateIds.length || 1, offset: 0 },
            ),
        enabled: !!id && areTemplateRelationsFresh && persistedTemplateIds.length > 0,
        staleTime: 0,
        refetchOnMount: "always",
    });

    const isSeedFresh =
        persistedTemplateIds.length === 0 ||
        isSuccessfulMountFetch(isSeedFetchedAfterMount, isSeedSuccess, isSeedRefetchError);
    const canRenderWithDegradedSeed = isSeedFresh || isSeedError;
    const hasFreshFormData = !id || (isClassificationFresh && areTemplateRelationsFresh && canRenderWithDegradedSeed);

    useEffect(() => {
        if (!hasFreshFormData) return;

        setFormSnapshot((current) => {
            if (current?.routeKey === routeKey) return current;

            return {
                routeKey,
                revision: 0,
                classification: data ?? INITIAL_DATA_CLASSIFICATION,
                persistedTemplateIds: id ? persistedTemplateIds : [],
                templateSeed: id ? (templateSeedResult?.data ?? []) : [],
            };
        });
    }, [data, hasFreshFormData, id, routeKey, templateRelations, templateSeedResult]);

    const reconcileTemplateRelations = async (classificationId, selectedTemplates) => {
        const availableTemplateIds = buildAvailableTemplateIds(
            (formSnapshot?.templateSeed ?? []).map(({ id }) => id),
            selectedTemplates,
        );
        const { templateIdsToAdd, templateIdsToRemove } = getTemplateRelationChanges({
            persistedTemplateIds: formSnapshot?.persistedTemplateIds ?? [],
            selectedTemplates,
            availableTemplateIds,
        });

        if (templateIdsToRemove.length > 0) {
            await apiService.post(
                `${CLASSIFICATION_TEMPLATE_RELATIONS_SERVICE}/delete`,
                toTemplateRelationPayload(classificationId, templateIdsToRemove),
            );
        }
        if (templateIdsToAdd.length > 0) {
            await apiService.post(
                CLASSIFICATION_TEMPLATE_RELATIONS_SERVICE,
                toTemplateRelationPayload(classificationId, templateIdsToAdd),
            );
        }
    };

    const { mutate, isPending } = useMutation({
        mutationFn: async ({
            classificationRequest,
            classificationId,
            selectedTemplates,
            shouldReconcileTemplates,
        }) => {
            await sendInformation(classificationRequest);
            if (!shouldReconcileTemplates) return;

            try {
                await reconcileTemplateRelations(classificationId, selectedTemplates);
            } catch (error) {
                throw new TemplateRelationsPartialSaveError("Template relation reconciliation failed", {
                    cause: error,
                });
            }
        },
        onError: async (error) => {
            if (error instanceof TemplateRelationsPartialSaveError) {
                try {
                    await Promise.all([
                        queryClient.refetchQueries(
                            {
                                queryKey: ["classificationsForm", id],
                                exact: true,
                            },
                            { throwOnError: true },
                        ),
                        queryClient.refetchQueries(
                            {
                                queryKey: ["classificationsTemplatesForm", id],
                                exact: true,
                            },
                            { throwOnError: true },
                        ),
                    ]);
                } catch {
                    toast.error(t("classification.alerts.partialTemplateReloadFailed"));
                    return;
                }
                const refreshedClassification = queryClient.getQueryData(["classificationsForm", id]);
                const refreshedRelations = queryClient.getQueryData(["classificationsTemplatesForm", id]);
                const refreshedPersistedIds = refreshedRelations?.data?.map((item) => item.template_id) ?? [];
                const refreshedPersistedKey = refreshedPersistedIds.slice().sort().join(",");

                let refreshedTemplateSeed = [];
                if (refreshedPersistedIds.length > 0) {
                    try {
                        refreshedTemplateSeed =
                            (
                                await queryClient.fetchQuery({
                                    queryKey: ["templatesClassificationSeed", id, refreshedPersistedKey],
                                    queryFn: async () =>
                                        genericSearch(
                                            `${TEMPLATES_SERVICE}/search`,
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
                                                    value: refreshedPersistedKey,
                                                    type: "AND",
                                                },
                                            ],
                                            { limit: refreshedPersistedIds.length || 1, offset: 0 },
                                        ),
                                })
                            )?.data ?? [];
                    } catch {
                        refreshedTemplateSeed = [];
                    }
                }

                setFormSnapshot((current) => {
                    if (current?.routeKey !== routeKey) {
                        return current;
                    }

                    return {
                        ...current,
                        revision: current.revision + 1,
                        classification: refreshedClassification ?? current.classification,
                        persistedTemplateIds: refreshedPersistedIds,
                        templateSeed: refreshedTemplateSeed,
                    };
                });
                toast.error(t("classification.alerts.partialTemplateUpdate"));
                return;
            }
            toast.error(getTranslatedError(error, t));
        },
        onSuccess: () => {
            toast.success(t("app.alerts.done"));
            navigate("/clasificaciones");
        },
        onSettled: () =>
            queryClient.invalidateQueries({
                queryKey: ["classificationData"],
            }),
    });

    const handleClassification = async (values, templatesList) => {
        if (!configCases?.case_enable_subcases) {
            values.can_start_sub_cases_flow = true;
        } else if (values.can_start_sub_cases_flow === "") {
            values.can_start_sub_cases_flow = false;
        }
        if (isPending) return;

        const { id } = values;
        const isCreate = !id;
        const url = id ? `${CLASSIFICATIONS_SERVICE}/${id}` : `${CLASSIFICATIONS_SERVICE}`;
        const { relations, json_flujo, ...dataPost } = formatDataBeforePost(values, id);
        if (isCreate) {
            dataPost.template_ids = [...new Set(templatesList.map((template) => template.id).filter(Boolean))];
        }
        const classificationRequest = { id, url, dataPost };

        if (json_flujo) {
            classificationRequest.dataPost.json_flujo = json_flujo;
        }

        mutate({
            classificationRequest,
            classificationId: id ?? dataPost.id,
            selectedTemplates: templatesList,
            shouldReconcileTemplates: !isCreate,
        });
    };

    const isFormLoading = !formSnapshot || formSnapshot.routeKey !== routeKey;

    return (
        <DashboardSectionCard title={"app.title.classifications"} data-testid="dashboardCardClassificationUpdate">
            {isFormLoading ? (
                <GeneralLoader />
            ) : (
                <ClassificationsForm
                    key={`${routeKey}:${formSnapshot.revision}`}
                    dataHandler={handleClassification}
                    data={formSnapshot.classification}
                    isSending={isPending}
                    dataTemplates={formSnapshot.persistedTemplateIds}
                    templateSeed={formSnapshot.templateSeed}
                />
            )}
        </DashboardSectionCard>
    );
};

export default ClassificationsUpdateHandler;
