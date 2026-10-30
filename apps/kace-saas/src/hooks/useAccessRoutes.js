import { useMemo } from "react";
import useUserInformation from "./useUserInformation";
import { routes } from "@/routes/routes";
import useConfigAgentData from "./useConfigAgentData";

const validateSinglePermission = ({ moduleId, permissions }, permissionsStack) => {
    return permissionsStack.some(
        (perm) =>
            ((Array.isArray(moduleId) && moduleId.includes(perm.module_id)) || perm.module_id === moduleId) &&
            permissions.includes(perm.name) &&
            perm.granted,
    );
};

const validatePermission = (permRequirements, permissionsStack) => {
    if (Array.isArray(permRequirements)) {
        return permRequirements.some((req) => validateSinglePermission(req, permissionsStack));
    }
    return validateSinglePermission(permRequirements, permissionsStack);
};

const isHiddenMenuEntry = (entry, hiddenMenus) => {
    const entryId = entry.to || entry.name;
    if (entryId && hiddenMenus.includes(entryId)) return true;
    if (entry.to === "/boards") {
        return hiddenMenus.includes(entry.name) || hiddenMenus.includes("/boards/create");
    }
    return false;
};

export const useAccessRoutes = () => {
    const { permissionsAdmin } = useUserInformation();

    const { hidden_menus: hiddenMenus = [] } = useConfigAgentData();

    const accessRoutes = useMemo(() => {
        if (!routes || !Array.isArray(routes) || routes.length === 0) {
            return null;
        }

        const response = [];

        routes.forEach((route) => {
            if (isHiddenMenuEntry(route, hiddenMenus)) return;

            const currentRouteItems = route.items;

            if (currentRouteItems && Array.isArray(currentRouteItems)) {
                const filteredItems = currentRouteItems.filter((item) => {
                    if (isHiddenMenuEntry(item, hiddenMenus)) return false;

                    return !item.permissions || validatePermission(item.permissions, permissionsAdmin);
                });

                if (filteredItems.length === 0) return;

                const processedRoute = { ...route, items: filteredItems };

                if (!route.permissions || validatePermission(route.permissions, permissionsAdmin)) {
                    response.push(processedRoute);
                }
                return;
            }

            if (!route.permissions || validatePermission(route.permissions, permissionsAdmin)) {
                response.push(route);
            }
        });

        return response.filter(Boolean);
    }, [permissionsAdmin, routes, hiddenMenus]);

    return { accessRoutes };
};
