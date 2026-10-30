import { useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@kace_v2/shared/constants/query-keys.constants";
import { fetchOneScript } from "@kace_v2/shared/services/oneScript.service";
import { useOneScriptIframeHandshake } from "@kace_v2/shared/hooks/useOneScriptIframeHandshake";
import { useOneScriptHandshakeConfig } from "@kace_v2/shared/hooks/useOneScriptHandshakeConfig";

const useOneScript = (oneScriptId, defaultParams = {}) => {
    const oneScriptRef = useRef(null);
    const { baseParams, handshakeTokens } = useOneScriptHandshakeConfig();

    const { data, isLoading } = useQuery({
        queryKey: QUERY_KEYS.ONE_SCRIPT.DETAILS(oneScriptId),
        queryFn: () => fetchOneScript(oneScriptId),
        enabled: Boolean(oneScriptId),
        staleTime: 0,
        gcTime: 0,
    });

    const oneScriptURL = useMemo(() => data?.url ?? null, [data?.url]);

    const handshakeParams = useMemo(() => ({ ...baseParams, ...defaultParams }), [baseParams, defaultParams]);

    useOneScriptIframeHandshake(oneScriptRef, {
        enabled: Boolean(oneScriptURL),
        params: handshakeParams,
        tokens: handshakeTokens,
    });

    return { oneScriptRef, oneScriptURL, isLoading };
};

export default useOneScript;
