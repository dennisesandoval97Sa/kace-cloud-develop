import { useMemo } from "react";
import useUserInformation from "@kace/hooks/useUserInformation";
import { useAuth } from "@/cognito-auth/AuthContext";

export function useOneScriptHandshakeConfig() {
    const { user, active_group_id } = useUserInformation();
    const { fingerprint } = useAuth();
    const tokens = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("tokens") ?? "null");
        } catch {
            return null;
        }
    }, []);

    const baseParams = useMemo(
        () => ({
            refresh_token: tokens?.refresh_token ?? null,
            fingerprint: fingerprint ?? null,
            user_id: user?.id ?? null,
            grupo_activo: active_group_id ?? null,
        }),
        [tokens?.refresh_token, fingerprint, user?.id, active_group_id],
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

    return { baseParams, handshakeTokens };
}
