import { useMemo, useRef } from "react";
import useAdminCaseParams from "@/pages/Cases/components/AdminCase/hooks/useAdminCaseParams";
import useGenericViewQuery from "@/hooks/useGenericViewQuery";
import useConfigAgentData from "@/hooks/useConfigAgentData";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import useAdminCaseCacheData from "@/pages/Cases/components/AdminCase/hooks/useAdminCaseCacheData";
import { useOneScriptIframeHandshake } from "@kace_v2/shared/hooks/useOneScriptIframeHandshake";
import { useOneScriptHandshakeConfig } from "@kace_v2/shared/hooks/useOneScriptHandshakeConfig";

const useAdminCaseOneScriptKace = () => {
    const formRefOneScript = useRef(null);
    const { cases } = useConfigAgentData();
    const { caseId, userId, parentId, urlQueryParams, roleNamespace } = useAdminCaseParams();
    const { caseCacheData } = useAdminCaseCacheData();
    const { baseParams, handshakeTokens } = useOneScriptHandshakeConfig();

    const oneScriptBaseFormId = useMemo(() => cases?.cases_one_script_base_form ?? null, [cases]);
    const client_id = useMemo(() => caseCacheData?.cliente_id || userId || null, [caseCacheData?.cliente_id, userId]);

    const { data, isLoading } = useGenericViewQuery({
        url: `${URL_AND_KEYS.oneScript.url}/${oneScriptBaseFormId}`,
        keyQuery: URL_AND_KEYS.helps.key,
        searchById: [oneScriptBaseFormId],
        staleTime: 0,
        gcTime: 0,
        enabled: Boolean(oneScriptBaseFormId),
    });

    const oneScriptURL = useMemo(() => data?.url ?? null, [data?.url]);

    const handshakeParams = useMemo(
        () => ({
            ...baseParams,
            case_id: caseId ?? null,
            client_id: client_id ?? null,
            parent_id: parentId ?? null,
            ...urlQueryParams,
            role_namespace: roleNamespace,
        }),
        [baseParams, caseId, client_id, parentId, urlQueryParams, roleNamespace],
    );

    useOneScriptIframeHandshake(formRefOneScript, {
        enabled: Boolean(oneScriptURL),
        params: handshakeParams,
        tokens: handshakeTokens,
    });

    return { formRefOneScript, oneScriptURL, isLoading, caseId };
};

export default useAdminCaseOneScriptKace;
