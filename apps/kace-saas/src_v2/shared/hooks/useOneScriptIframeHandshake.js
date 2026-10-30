import useUserInformation from "@/hooks/useUserInformation";
import { ensureValidAuthTokens } from "@/utils/src/services/apiService.js";
import { useEffect, useRef } from "react";

function buildTokensUpdatedPayload(tokens, params) {
    return {
        type: "KACE_TOKENS_UPDATED",
        tokens: {
            id_token: tokens.id_token,
            access_token: tokens.access_token,
            token_type: tokens.token_type,
            expires_in: tokens.expires_in,
        },
        refresh_token: params.refresh_token,
        ts: Date.now(),
    };
}

export function useOneScriptIframeHandshake(iframeRef, config) {
    const { enabled, params, tokens } = config;
    const { userCache } = useUserInformation();
    const lastPushRef = useRef(null);

    useEffect(() => {
        if (!enabled) return;

        function handler(event) {
            if (!iframeRef.current) return;
            if (event.source !== iframeRef.current.contentWindow) return;

            const messageType = event.data?.type;
            if (messageType !== "KACE_INIT_REQUEST" && messageType !== "KACE_REINIT_REQUEST") return;

            const requestId = event.data.requestId;
            const iframeOrigin = new URL(iframeRef.current.src).origin;

            if (messageType === "KACE_INIT_REQUEST") {
                iframeRef.current.contentWindow.postMessage(
                    {
                        type: "KACE_INIT_RESPONSE",
                        requestId,
                        params,
                        tokens,
                        authCognitoResponse: userCache,
                    },
                    iframeOrigin,
                );
                return;
            }

            void (async () => {
                try {
                    const activeTokens = await ensureValidAuthTokens();
                    if (!iframeRef.current) return;

                    iframeRef.current.contentWindow.postMessage(
                        {
                            type: "KACE_REINIT_RESPONSE",
                            requestId,
                            params: {
                                ...params,
                                refresh_token: activeTokens.refresh_token,
                            },
                            tokens: {
                                id_token: activeTokens.id_token,
                                access_token: activeTokens.access_token,
                                token_type: activeTokens.token_type,
                                expires_in: activeTokens.expires_in,
                            },
                            authCognitoResponse: userCache,
                        },
                        iframeOrigin,
                    );
                } catch {
                    return;
                }
            })();
        }

        window.addEventListener("message", handler);
        return () => window.removeEventListener("message", handler);
    }, [enabled, tokens, params, userCache]);

    useEffect(() => {
        if (!enabled || !iframeRef.current) return;

        const idToken = tokens?.id_token;
        const refreshToken = params?.refresh_token;

        if (!lastPushRef.current) {
            lastPushRef.current = { id_token: idToken, refresh_token: refreshToken };
            return;
        }

        const { id_token: lastId, refresh_token: lastRt } = lastPushRef.current;
        if (lastId === idToken && lastRt === refreshToken) return;

        const iframeOrigin = new URL(iframeRef.current.src).origin;
        iframeRef.current.contentWindow.postMessage(buildTokensUpdatedPayload(tokens, params), iframeOrigin);
        lastPushRef.current = { id_token: idToken, refresh_token: refreshToken };
    }, [enabled, tokens, params]);
}
