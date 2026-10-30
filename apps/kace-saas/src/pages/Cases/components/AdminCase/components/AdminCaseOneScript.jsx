import { useMemo, useRef } from "react";
import { FormOneScript } from "@/components/core/FormOneScript/FormOneScript";
import PropTypes from "prop-types";
import { AdminCaseCardModules } from "./AdminCaseCardModules";
import { useOneScriptIframeHandshake } from "@kace_v2/shared/hooks/useOneScriptIframeHandshake";
import { useOneScriptHandshakeConfig } from "@kace_v2/shared/hooks/useOneScriptHandshakeConfig";
import useAdminCaseParams from "../hooks/useAdminCaseParams";
import useAdminCaseCacheData from "../hooks/useAdminCaseCacheData";

const AdminCaseOneScript = ({ oneScriptName = "", oneScriptUrl = "" }) => {
    const formRefOneScript = useRef(null);
    const { caseId, userId, parentId, urlQueryParams, roleNamespace } = useAdminCaseParams();
    const { caseCacheData } = useAdminCaseCacheData();
    const { baseParams, handshakeTokens } = useOneScriptHandshakeConfig();

    const client_id = useMemo(() => caseCacheData?.cliente_id || userId || null, [caseCacheData?.cliente_id, userId]);

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
        enabled: Boolean(oneScriptUrl),
        params: handshakeParams,
        tokens: handshakeTokens,
    });

    return (
        <div className="relative flex h-full min-h-0 w-full flex-1 flex-col">
            <AdminCaseCardModules title="globalConfigLabels.aux_casos.titulo_aux_casos" description={oneScriptName}>
                <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                    <FormOneScript
                        formRef={formRefOneScript}
                        url={oneScriptUrl}
                        isCaseUpdate={Boolean(caseId)}
                        enableBoardReturn
                    />
                </div>
            </AdminCaseCardModules>
        </div>
    );
};

AdminCaseOneScript.propTypes = {
    oneScriptName: PropTypes.string,
    oneScriptUrl: PropTypes.string,
};

export default AdminCaseOneScript;
