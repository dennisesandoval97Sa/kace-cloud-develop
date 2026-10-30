import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { TYPE_APPLICATION } from "@kace/utils";
import useUserInformation from "@/hooks/useUserInformation";
import { setApplicationSelected } from "@/redux/state/applicationSelectedSlice";

const AccessMiddleware = ({ children }) => {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const configAgent = useSelector((s) => s.generalSetup.configAgent);
    const { permissionsAdmin, permissionsAgent } = useUserInformation();

    const hasAccessAdmin = Boolean(permissionsAdmin?.find((p) => p.module_id === "access-admin")?.granted);
    const hasAccessAgent = Boolean(permissionsAgent?.find((p) => p.module_id === "access-agent")?.granted);
    const canAccessAdmin = configAgent != null && hasAccessAdmin;

    useEffect(() => {
        if (configAgent == null) return;

        const isAdminPath = !pathname.startsWith("/agent");
        if (isAdminPath) {
            if (!canAccessAdmin) {
                navigate(hasAccessAgent ? "/agent" : "/access-control", { replace: true });
                if (hasAccessAgent) dispatch(setApplicationSelected(TYPE_APPLICATION.AGENT));
                return;
            }
        } else {
            if (!hasAccessAgent) {
                navigate(canAccessAdmin ? "/dashboard" : "/access-control", { replace: true });
                if (canAccessAdmin) dispatch(setApplicationSelected(TYPE_APPLICATION.ADMIN));
                return;
            }
        }
        dispatch(setApplicationSelected(isAdminPath ? TYPE_APPLICATION.ADMIN : TYPE_APPLICATION.AGENT));
    }, [pathname, configAgent, canAccessAdmin, hasAccessAdmin, hasAccessAgent, dispatch, navigate]);

    return children;
};

export default AccessMiddleware;
