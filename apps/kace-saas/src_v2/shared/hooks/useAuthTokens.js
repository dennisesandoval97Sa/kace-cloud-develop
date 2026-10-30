import { useCallback, useEffect, useState } from "react";
import { TOKEN_SYNC_CHANNEL_NAME } from "@/utils/cognitoTokenRefreshCoordinator.js";

function readTokensFromLocalStorage() {
    try {
        return JSON.parse(localStorage.getItem("tokens") ?? "null");
    } catch {
        return null;
    }
}

export function useAuthTokens() {
    const [tokens, setTokens] = useState(() => readTokensFromLocalStorage());

    const syncFromStorage = useCallback(() => {
        setTokens(readTokensFromLocalStorage());
    }, []);

    useEffect(() => {
        function onStorage(event) {
            if (event.key === "tokens") {
                syncFromStorage();
            }
        }

        let channel = null;
        if (typeof BroadcastChannel !== "undefined") {
            channel = new BroadcastChannel(TOKEN_SYNC_CHANNEL_NAME);
            channel.onmessage = (event) => {
                if (event.data?.type === "tokens-updated") {
                    syncFromStorage();
                }
            };
        }

        window.addEventListener("storage", onStorage);
        return () => {
            window.removeEventListener("storage", onStorage);
            channel?.close();
        };
    }, [syncFromStorage]);

    return tokens;
}
