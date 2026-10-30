import { useCallback } from "react";
import { useLocation } from "react-router-dom";
import useConfigAgentData from "@kace/hooks/useConfigAgentData";
import { isSafeInternalPath } from "@kace_v2/features/boards/utils/isSafeInternalPath.util";

const AGENT_CASE_PATH_PREFIX = "/agent/update/";
const FALLBACK_RETURN_ROUTE = "/agent";

const getOpenCaseId = (pathname) => {
    if (!pathname.startsWith(AGENT_CASE_PATH_PREFIX)) return null;
    const [caseId] = pathname.slice(AGENT_CASE_PATH_PREFIX.length).split("/");
    return caseId || null;
};

/**
 * Resuelve a donde volver cuando OneScript avisa que el caso abierto se guardo.
 *
 * Aplica unicamente a los casos abiertos con "Ver caso" desde el tab de tableros
 * del agente (la ruta lleva `board_id`) y solo si la configuracion general del
 * grupo tiene activo `return_to_board_on_case_saved`. En cualquier otro caso
 * devuelve `null` y quien llama mantiene su comportamiento actual.
 *
 * @returns {(incomingRoute: string) => string|null} ruta de retorno o null.
 */
const useBoardCaseReturn = () => {
    const { pathname, search, state } = useLocation();
    const { cases: configCases } = useConfigAgentData();
    const isEnabled = configCases?.return_to_board_on_case_saved ?? false;

    return useCallback(
        (incomingRoute) => {
            if (!isEnabled) return null;

            const caseId = getOpenCaseId(pathname);
            if (!caseId) return null;

            const boardId = new URLSearchParams(search).get("board_id");
            if (!boardId) return null;

            /*
             * El mensaje debe referirse al caso que esta abierto; asi no se
             * reacciona a navegaciones de otros flujos de OneScript.
             */
            if (typeof incomingRoute !== "string" || !incomingRoute.includes(`/update/${caseId}`)) return null;

            const origin = state?.boardReturnTo;
            return isSafeInternalPath(origin) ? origin : FALLBACK_RETURN_ROUTE;
        },
        [isEnabled, pathname, search, state],
    );
};

export default useBoardCaseReturn;
