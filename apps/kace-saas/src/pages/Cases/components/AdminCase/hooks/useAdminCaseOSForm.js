import useGenericSearchQuery from "@kace/hooks/useGenericSearchQuery";
import useGenericViewQuery from "@kace/hooks/useGenericViewQuery";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { useCallback, useMemo, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/cognito-auth/AuthContext";
import useAdminCaseParams from "./useAdminCaseParams";
import useAdminCaseCacheData from "./useAdminCaseCacheData";

const useAdminCaseOSForm = (selectedClassificationId = "", caseId = null) => {
    const queryClient = useQueryClient();
    const { fingerprint } = useAuth();
    const { userId: clientIdParam, caseId: caseIdParam, parentId, urlQueryParams } = useAdminCaseParams();
    const [creatingUrl, setCreatingUrl] = useState(false);

    const case_id = useMemo(() => caseId || caseIdParam || null, [caseId, caseIdParam]);

    const cacheConfig = useMemo(
        () => ({
            staleTime: 0,
            gcTime: 0,
        }),
        [],
    );

    const { caseCacheData } = useAdminCaseCacheData();

    const classificationId = useMemo(
        () => selectedClassificationId || caseCacheData?.clasificacion_id,
        [caseCacheData?.clasificacion_id, selectedClassificationId],
    );

    const clientId = useMemo(
        () => caseCacheData?.cliente_id || clientIdParam || null,
        [caseCacheData?.cliente_id, clientIdParam],
    );

    const buildUrlWithParams = useCallback((baseUrl, params) => {
        const url = new URL(baseUrl);
        Object.keys(params).forEach((key) => {
            url.searchParams.append(key, params[key]);
        });
        return url.toString();
    }, []);

    const userInformation = queryClient.getQueryData([URL_AND_KEYS.users.userInformation]) || {};
    const { user = {} } = userInformation;

    const selectedGroupId = useMemo(
        () => user?.grupo_activo || user?.selectedGroup || null,
        [user?.grupo_activo, user?.selectedGroup],
    );

    const userId = useMemo(() => user?.id || null, [user?.id]);

    const {
        data: relationsData,
        isLoading: isLoadingRelationsData,
        isFetching: isFetchingRelationsData,
    } = useGenericSearchQuery({
        url: `${URL_AND_KEYS.classification.relationshipUrl}/search`,
        keyQuery: URL_AND_KEYS.classification.keyAdminCaseFormRelationship,
        select: (data) => data.data,
        filter: [
            {
                field: "classification_id",
                operator: "eq",
                value: classificationId,
                type: "AND",
            },
            {
                field: "group_id",
                operator: "eq",
                value: selectedGroupId,
                type: "AND",
            },
        ],
        pagination: {
            limit: 1,
            offset: 0,
        },
        table: "classifications-groups-relationships",
        useDefault: false,
        enabled: !!classificationId && !!selectedGroupId,
        ...cacheConfig,
    });

    const formId = useMemo(() => {
        if (!relationsData) {
            return null;
        }
        const hasValidClassification = Array.isArray(relationsData) && relationsData.length > 0;

        if (!hasValidClassification) {
            return null;
        }

        const formId = relationsData[0].form;
        if (!formId) {
            return null;
        }

        return formId;
    }, [relationsData]);

    const {
        data: oneScriptData,
        isError: isOneScriptDataError,
        isLoading: isLoadingOneScriptData,
        isFetching: isFetchingOneScriptData,
    } = useGenericViewQuery({
        keyQuery: URL_AND_KEYS.oneScript.key,
        searchById: [formId],
        url: `${URL_AND_KEYS.oneScript.url}/${formId}`,
        enabled: !!formId,
        ...cacheConfig,
    });

    const [oneScriptUrl, setOneScriptUrl] = useState(null);

    useEffect(() => {
        try {
            setCreatingUrl(true);
            if (isOneScriptDataError || !oneScriptData?.url) {
                setOneScriptUrl(null);
                return;
            }
            const { url: baseUrl, id: formDataId } = oneScriptData;

            const cognito = import.meta.env.VITE_COGNITO_CLIENT_ID;

            const tokens = JSON.parse(localStorage.getItem("tokens"));
            if (
                !clientId ||
                !userId ||
                !case_id ||
                !selectedGroupId ||
                !formDataId ||
                !cognito ||
                !tokens?.refresh_token ||
                !fingerprint
            ) {
                setOneScriptUrl(null);
                return;
            }

            const params = {
                client: clientId,
                user: userId,
                caso: case_id,
                group: selectedGroupId,
                grupo_activo: selectedGroupId,
                onescript: formDataId,
                cognito,
                token: tokens.refresh_token,
                finger: fingerprint,
                ...urlQueryParams,
            };

            if (parentId) {
                params.parentId = parentId;
            }

            const url = buildUrlWithParams(baseUrl, params);
            setOneScriptUrl(url);
        } catch {
            // NO-SONAR: Si ocurre un error en la creación de la URL, se devuelve `null` para no interrumpir el flujo
            setOneScriptUrl(null);
        } finally {
            setCreatingUrl(false);
        }
    }, [
        oneScriptData,
        isOneScriptDataError,
        clientId,
        userId,
        case_id,
        selectedGroupId,
        caseId,
        parentId,
        fingerprint,
        urlQueryParams,
        buildUrlWithParams,
    ]);

    return {
        oneScriptData,
        oneScriptUrl,
        showSendButton:
            !oneScriptData &&
            !oneScriptUrl &&
            !isFetchingOneScriptData &&
            !isFetchingRelationsData &&
            !creatingUrl &&
            !isLoadingRelationsData &&
            !isLoadingOneScriptData,
    };
};

export default useAdminCaseOSForm;
