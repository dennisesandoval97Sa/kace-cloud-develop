import { useMemo, useRef } from "react";
import useAdminCaseParams from "@/pages/Cases/components/AdminCase/hooks/useAdminCaseParams";
import useGenericViewQuery from "@/hooks/useGenericViewQuery";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { useOneScriptIframeHandshake } from "@kace_v2/shared/hooks/useOneScriptIframeHandshake";
import { useOneScriptHandshakeConfig } from "@kace_v2/shared/hooks/useOneScriptHandshakeConfig";

const useAdminCaseExpressCase = () => {
    const formRefOneScript = useRef(null);
    const { oneScriptFormId, urlQueryParams, roleNamespace } = useAdminCaseParams();
    const { baseParams, handshakeTokens } = useOneScriptHandshakeConfig();

    const { data, isLoading } = useGenericViewQuery({
        url: `${URL_AND_KEYS.oneScript.url}/${oneScriptFormId}`,
        keyQuery: URL_AND_KEYS.oneScript.key,
        searchById: [oneScriptFormId],
        staleTime: 0,
        gcTime: 0,
        enabled: Boolean(oneScriptFormId),
    });

    const oneScriptUrl = useMemo(() => data?.url ?? null, [data?.url]);

    const handshakeParams = useMemo(
        () => ({ ...baseParams, ...urlQueryParams, role_namespace: roleNamespace }),
        [baseParams, urlQueryParams, roleNamespace],
    );

    useOneScriptIframeHandshake(formRefOneScript, {
        enabled: Boolean(oneScriptUrl),
        params: handshakeParams,
        tokens: handshakeTokens,
    });

    return { formRefOneScript, oneScriptUrl, isLoading };
};

export default useAdminCaseExpressCase;
