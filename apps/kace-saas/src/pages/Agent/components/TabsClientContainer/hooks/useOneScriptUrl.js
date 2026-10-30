import { useAuth } from "@/cognito-auth/AuthContext";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { useMemo, useRef } from "react";
import useGenericViewQuery from "@/hooks/useGenericViewQuery";
import { useOneScriptIframeHandshake } from "@kace_v2/shared/hooks/useOneScriptIframeHandshake";
import { useAuthTokens } from "@kace_v2/shared/hooks/useAuthTokens";

export const useOneScriptUrl = ({ formId, clientId, userId }) => {
    const formRef = useRef(null);
    const { fingerprint } = useAuth();
    const tokens = useAuthTokens();

    const { data, isLoading, error } = useGenericViewQuery({
        url: `${URL_AND_KEYS.oneScript.url}/${formId}`,
        keyQuery: URL_AND_KEYS.clients.clientForm,
        searchById: [formId],
        staleTime: 0,
        gcTime: 0,
        enabled: Boolean(formId),
    });

    const url = useMemo(() => data?.url ?? null, [data?.url]);

    const handshakeParams = useMemo(
        () => ({
            client_id: clientId ?? null,
            user_id: userId ?? null,
            refresh_token: tokens?.refresh_token ?? null,
            fingerprint: fingerprint ?? null,
        }),
        [clientId, userId, fingerprint, tokens?.refresh_token],
    );

    const handshakeTokens = useMemo(
        () => ({
            id_token: tokens?.id_token ?? null,
            access_token: tokens?.access_token ?? null,
            token_type: tokens?.token_type ?? null,
            expires_in: tokens?.expires_in ?? null,
        }),
        [tokens?.id_token, tokens?.access_token, tokens?.token_type, tokens?.expires_in],
    );

    useOneScriptIframeHandshake(formRef, {
        enabled: Boolean(url),
        params: handshakeParams,
        tokens: handshakeTokens,
    });

    return { formRef, url, isLoading, error };
};
