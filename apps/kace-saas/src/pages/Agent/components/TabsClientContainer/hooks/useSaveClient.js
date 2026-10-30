import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { formatDataBeforePost } from "../../../../../services/genericHandleSendInformation";
import { apiService } from "../../../../../utils/main";

export const getServerResponseId = (responseData) => responseData?.data?.id ?? responseData?.id;

export const buildTempClientDraftRequest = ({ dataClient, draftClientId }) => {
    const data = { ...dataClient };
    const filterValues = Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== "" && value !== undefined && value !== null),
    );
    const requestBody = formatDataBeforePost(filterValues, draftClientId, ["contactos"], {
        serverGeneratedId: !draftClientId,
    });
    if (requestBody.tipo_cliente === "Comercial") {
        requestBody.contactos = [];
    }

    return {
        endpoint: draftClientId ? `/tempclients/${draftClientId}` : "/tempclients",
        requestBody,
    };
};

const useSaveClient = () => {
    const newRegister = useRef(true);
    const draftClientIdRef = useRef(null);

    const saveClientMutation = useMutation({
        mutationFn: async ({ dataClient, clientId, isNewClient }) => {
            const draftClientId = isNewClient ? draftClientIdRef.current : clientId;
            const { endpoint, requestBody } = buildTempClientDraftRequest({ dataClient, draftClientId });

            try {
                const response = await apiService.post(endpoint, requestBody);
                if (response.status !== 200 && response.status !== 201) {
                    throw new Error("Failed to save case: " + response.statusText);
                }
                const responseId = getServerResponseId(response.data);
                if (!draftClientIdRef.current && responseId) {
                    draftClientIdRef.current = responseId;
                }
                return response.data;
            } catch (error) {
                throw new Error("Error saving case: " + error.message);
            }
        },
    });

    const saveClient = useCallback(
        async (values, clientId, isNewClient = true) => {
            try {
                if (saveClientMutation.isPending) return;
                const response = await saveClientMutation.mutateAsync({ dataClient: values, clientId, isNewClient });
                newRegister.current = false;
                return getServerResponseId(response) ?? true;
            } catch {
                // NO-SONAR: no se propaga el error para no interrumpir el flujo de la aplicación. Se devuelve `false` para indicar fallo.
                newRegister.current = false;
                return false;
            }
        },
        [saveClientMutation],
    );

    useEffect(() => {
        newRegister.current = true;
        draftClientIdRef.current = null;
    }, []);

    return {
        saveClient,
        isLoading: saveClientMutation.isLoading,
    };
};

export default useSaveClient;
