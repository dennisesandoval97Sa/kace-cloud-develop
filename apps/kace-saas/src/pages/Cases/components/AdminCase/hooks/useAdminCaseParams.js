import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMemo } from "react";

const useAdminCaseParams = () => {
    const navigation = useNavigate();
    const { search, pathname } = useLocation();
    const { userId, caseId } = useParams();

    const isAdmin = useMemo(() => {
        return !pathname.includes("/agent");
    }, [pathname]);

    // Namespace de rol de la vista: OneScript evalúa en él los permisos de rol (CaseReclassify).
    const roleNamespace = isAdmin ? "administrador" : "agente";

    const extraParam = useMemo(() => {
        const queryParams = new URLSearchParams(search);
        return queryParams.get("action");
    }, [search]);

    const parentId = useMemo(() => {
        const queryParams = new URLSearchParams(search);
        const parent_id = queryParams.get("parent_id");
        return parent_id && parent_id !== "null" ? parent_id : null;
    }, [search]);

    const oneScriptFormId = useMemo(() => {
        const queryParams = new URLSearchParams(search);
        const form_id = queryParams.get("form_id");
        return form_id && form_id !== "null" ? form_id : null;
    }, [search]);

    const interactionId = useMemo(() => {
        const queryParams = new URLSearchParams(search);
        const interaction_id = queryParams.get("interaction_id");
        return interaction_id && interaction_id !== "null" ? interaction_id : null;
    }, [search]);

    const urlQueryParams = useMemo(() => {
        const queryParams = new URLSearchParams(search);
        const result = {};
        const omitKeys = ["action", "parent_id"];
        queryParams.forEach((value, key) => {
            if (!omitKeys.includes(key)) {
                result[key] = value;
            }
        });
        return result;
    }, [search]);

    const navigateToPath = (clientId) => {
        const id = userId || clientId;
        const navigatePath = pathname.includes("/agent") && id ? `/agent/${id}` : -1;
        navigation(navigatePath);
    };

    return {
        extraParam,
        caseId,
        userId,
        parentId,
        oneScriptFormId,
        interactionId,
        urlQueryParams,
        isAdmin,
        roleNamespace,
        navigateToPath,
    };
};

export default useAdminCaseParams;
