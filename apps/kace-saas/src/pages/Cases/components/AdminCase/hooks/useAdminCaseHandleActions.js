import { useCallback, useRef } from "react";
import useConfigAgentData from "@kace/hooks/useConfigAgentData";
import { URL_AND_KEYS } from "../../../../../utils/urlAndKeys";
import { genericHandleSendInformation } from "../../../../../services/genericHandleSendInformation";
import useAdminCaseParams from "./useAdminCaseParams";
import useGeneralMutation from "@kace/hooks/useGeneralMutation";
import useUserInformation from "@kace/hooks/useUserInformation";
import useGeolocation from "@kace/hooks/useGeolocation";
import useAdminCaseCacheData from "./useAdminCaseCacheData";
import { GeolocationTypes } from "../../../../../enums/GeolocationTypes";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import useAdminCaseDescription from "./useAdminCaseDescription";
import { Uuid } from "@kace/plugins";
import { apiService } from "@kace/utils";

export const getServerResponseId = (response) => response?.data?.data?.id ?? response?.data?.id ?? response?.id;

const useAdminCaseHandleActions = () => {
    const { t } = useTranslation();
    const { userId, navigateToPath, extraParam, parentId, interactionId } = useAdminCaseParams();
    const { user } = useUserInformation();
    const { caseCacheData, handleCacheData } = useAdminCaseCacheData();
    const { cases: configCases } = useConfigAgentData();
    const { handleGeolocation } = useGeolocation();
    const { handleCreateDescription } = useAdminCaseDescription();
    const isNewDescriptionRef = useRef(extraParam === "create");
    const isNewCaseRef = useRef(extraParam === "create");
    const isNewTempCaseRef = useRef(extraParam === "create");
    const draftCaseIdRef = useRef(null);

    const { mutateAsync, isPending } = useGeneralMutation({
        setOpen: false,
        invalidateQueries: false,
        onSuccessToast: false,
    });

    const isEmptyContent = useCallback((text) => {
        return /^(\s*<p[^>]*>\s*(<br\s*\/?>)?\s*<\/p>\s*)+$/i.test(text);
    }, []);

    const defaultDescription = '<p class="mb-1" dir="ltr"><span></span></p>';

    const linkCaseToInteraction = useCallback(
        async (caseId) => {
            if (!interactionId || !caseId) return;

            try {
                await apiService.post(URL_AND_KEYS.interactions.associate, {
                    interaction_id: interactionId,
                    caso_id: caseId,
                });
            } catch {
                toast.warning(t("app.alerts.interactionCaseLinkFailed"));
            }
        },
        [interactionId, t],
    );

    const isValidDataForm = useCallback(
        (values) => {
            if (values.clasificacion_id === "") {
                toast.error(t("app.alerts.selectClassification"));
                return false;
            }

            if (values.transicion_id === "") {
                toast.error(t("app.alerts.selectState"));
                return false;
            }

            if (
                !configCases?.allow_description_empty &&
                (values.descripcion_caso === "" || isEmptyContent(values.descripcion_caso))
            ) {
                toast.error(t("app.alerts.inputDescription"));
                return false;
            }

            return true;
        },
        [configCases, isEmptyContent, t],
    );

    const handleSaveTempCase = async (values) => {
        if (isPending || !values) return;
        await handleCreateDescription(
            values.descripcion_caso_id,
            values.descripcion_caso || defaultDescription,
            isNewDescriptionRef.current,
        );
        isNewDescriptionRef.current = false;

        const draftCaseId = isNewTempCaseRef.current ? draftCaseIdRef.current : (draftCaseIdRef.current ?? values.id);
        const dataPost = {
            ...(draftCaseId ? { id: draftCaseId } : {}),
            cliente_id: userId || caseCacheData.cliente_id,
            transicion_id: values.transicion_id,
            clasificacion_id: values.clasificacion_id,
            responsable_id: caseCacheData.responsable_id ?? user.id,
            descripcion_caso_id: values.descripcion_caso_id,
            grupo_id: caseCacheData.grupo_id ?? user.selectedGroup,
        };

        const data = genericHandleSendInformation({
            values: dataPost,
            urlService: URL_AND_KEYS.cases.urlTempCases,
            pending: isPending,
            options: {
                isCreate: !draftCaseId,
                serverGeneratedId: !draftCaseId,
            },
        });

        const response = await mutateAsync(data);
        const responseId = getServerResponseId(response);
        if (!draftCaseIdRef.current && responseId) {
            draftCaseIdRef.current = responseId;
        }
        isNewTempCaseRef.current = false;
    };

    const handleSaveCase = async (values) => {
        if (!isValidDataForm(values) || isPending) return;

        const behavior = isNewCaseRef.current ? GeolocationTypes.CASE_CREATION : GeolocationTypes.CASE_UPDATE;

        await handleCreateDescription(
            values.descripcion_caso_id,
            values.descripcion_caso || defaultDescription,
            isNewDescriptionRef.current,
        );
        isNewDescriptionRef.current = false;

        const data = genericHandleSendInformation({
            values: isNewCaseRef.current ? {} : { id: values.id },
            urlService: URL_AND_KEYS.cases.urlCasesAux,
            pending: isPending,
            options: {
                isCreate: isNewCaseRef.current,
                serverGeneratedId: isNewCaseRef.current,
            },
        });

        const caseData = {
            cliente_id: userId || caseCacheData.cliente_id,
            transicion_id: values.transicion_id,
            clasificacion_id: values.clasificacion_id,
            responsable_id: caseCacheData.responsable_id ?? user.id,
            descripcion_caso_id: values.descripcion_caso_id,
            grupo_id: caseCacheData.grupo_id ?? user.selectedGroup,
            parent_id: parentId,
        };

        const auxCase = {
            id: Uuid(),
            data: {},
        };

        data.dataPost = {
            case: caseData,
            aux_cases: isNewCaseRef.current ? auxCase : {},
        };

        try {
            handleGeolocation(behavior.value);
            const response = await mutateAsync(data);
            const caseId = getServerResponseId(response) ?? values.id;
            isNewCaseRef.current = false;
            await linkCaseToInteraction(caseId);

            navigateToPath(caseCacheData?.cliente_id);
            setTimeout(() => {
                handleCacheData();
            }, 2000);
        } catch (error) {
            toast.error(`${t("app.alerts.unrealized")}: ${error.message}`);
        }
    };

    return { handleSaveTempCase, handleSaveCase, isValidDataForm, isPending };
};

export default useAdminCaseHandleActions;
